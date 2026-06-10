// index.ts
// Belle Trouvé — Cloud Functions entry points

import * as admin from "firebase-admin";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onRequest} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import {extractProductData} from "./processors/gemini";
import {
  fetchInstagramHashtagPosts,
  FASHION_HASHTAGS as IG_HASHTAGS,
} from "./fetchers/instagram";
import {
  fetchTikTokHashtagPosts,
  FASHION_HASHTAGS as TT_HASHTAGS,
} from "./fetchers/tiktok";
import {
  fetchPinterestSearchPins,
  FASHION_QUERIES as PT_QUERIES,
} from "./fetchers/pinterest";
import {
  normalizeInstagramPost,
  normalizeTikTokPost,
  normalizePinterestPin,
} from "./normalizer";
import {writeFeedItems, writeFetchMetadata, deactivateExpiredItems} from "./writer";
import {FeedItem} from "./types";

admin.initializeApp();

const SCRAPECREATORS_API_KEY = defineSecret("SCRAPECREATORS_API_KEY");

// ─────────────────────────────────────────
// MARK: - Scheduled Fetcher (every 6 hours)
// ─────────────────────────────────────────

export const fetchFashionContent = onSchedule(
  {
    schedule: "every 6 hours",
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "512MiB",
    secrets: [SCRAPECREATORS_API_KEY],
  },
  async () => {
    const apiKey = SCRAPECREATORS_API_KEY.value();
    console.log("Starting Belle Trouvé fashion content fetch...");

    await runFetchJob(apiKey);
  }
);

// ─────────────────────────────────────────
// MARK: - Manual Trigger (for testing)
// ─────────────────────────────────────────

export const manualFetch = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "512MiB",
    secrets: [SCRAPECREATORS_API_KEY],
  },
  async (req, res) => {
    // Simple auth check — require a query param token in dev
    if (req.query.token !== "belletrouve-dev") {
      res.status(401).send("Unauthorized");
      return;
    }

    const apiKey = SCRAPECREATORS_API_KEY.value();
    console.log("Manual fetch triggered...");

    const result = await runFetchJob(apiKey);
    res.json(result);
  }
);

// ─────────────────────────────────────────
// MARK: - Core Fetch Job
// ─────────────────────────────────────────

async function runFetchJob(apiKey: string) {
  const results = {
    instagram: {fetched: 0, written: 0},
    tiktok: {fetched: 0, written: 0},
    pinterest: {fetched: 0, written: 0},
    expired: 0,
  };

  // --- Instagram ---
  try {
    const hashtag = IG_HASHTAGS[Math.floor(Math.random() * IG_HASHTAGS.length)];
    console.log(`Fetching Instagram hashtag: #${hashtag}`);
    const rawPosts = await fetchInstagramHashtagPosts(apiKey, hashtag, 20);
    results.instagram.fetched = rawPosts.length;

    const feedItems: FeedItem[] = [];
    for (const post of rawPosts) {
      const imageURL = post.display_url || post.thumbnail_url || "";
      if (!imageURL) continue;
      const gemini = await extractProductData(imageURL, post.caption || "", "instagram");
      if (!gemini.isFashionRelated) continue;
      feedItems.push(normalizeInstagramPost(post, gemini));
    }

    results.instagram.written = await writeFeedItems(feedItems);
    await writeFetchMetadata({
      platform: "instagram",
      jobType: `hashtag_${hashtag}`,
      itemsFetched: results.instagram.fetched,
      itemsWritten: results.instagram.written,
      status: "success",
      errorMessage: "",
      creditsUsed: rawPosts.length,
    });
  } catch (err) {
    console.error("Instagram fetch job failed:", err);
    await writeFetchMetadata({
      platform: "instagram",
      jobType: "hashtag",
      itemsFetched: 0,
      itemsWritten: 0,
      status: "error",
      errorMessage: String(err),
      creditsUsed: 0,
    });
  }

  // --- TikTok ---
  try {
    const hashtag = TT_HASHTAGS[Math.floor(Math.random() * TT_HASHTAGS.length)];
    console.log(`Fetching TikTok hashtag: #${hashtag}`);
    const rawPosts = await fetchTikTokHashtagPosts(apiKey, hashtag, 20);
    results.tiktok.fetched = rawPosts.length;

    const feedItems: FeedItem[] = [];
    for (const post of rawPosts) {
      const imageURL = (post.video?.cover as any)?.url_list?.[0] || post.video?.cover || "";
      if (!imageURL) continue;
      const gemini = await extractProductData(imageURL, post.desc || "", "tiktok");
      if (!gemini.isFashionRelated) continue;
      feedItems.push(normalizeTikTokPost(post, gemini));
    }

    results.tiktok.written = await writeFeedItems(feedItems);
    await writeFetchMetadata({
      platform: "tiktok",
      jobType: `hashtag_${hashtag}`,
      itemsFetched: results.tiktok.fetched,
      itemsWritten: results.tiktok.written,
      status: "success",
      errorMessage: "",
      creditsUsed: rawPosts.length,
    });
  } catch (err) {
    console.error("TikTok fetch job failed:", err);
    await writeFetchMetadata({
      platform: "tiktok",
      jobType: "hashtag",
      itemsFetched: 0,
      itemsWritten: 0,
      status: "error",
      errorMessage: String(err),
      creditsUsed: 0,
    });
  }

  // --- Pinterest ---
  try {
    const query = PT_QUERIES[Math.floor(Math.random() * PT_QUERIES.length)];
    console.log(`Fetching Pinterest query: "${query}"`);
    const rawPins = await fetchPinterestSearchPins(apiKey, query, 20);
    results.pinterest.fetched = rawPins.length;

    const feedItems: FeedItem[] = [];
    for (const pin of rawPins) {
      const imageURL = pin.images?.["736x"]?.url || pin.images?.orig?.url || "";
      if (!imageURL) continue;
      const gemini = await extractProductData(
        imageURL,
        `${pin.title || ""} ${pin.description || ""}`.trim()
      );
      if (!gemini.isFashionRelated) continue;
      feedItems.push(normalizePinterestPin(pin, gemini));
    }

    results.pinterest.written = await writeFeedItems(feedItems);
    await writeFetchMetadata({
      platform: "pinterest",
      jobType: `search_${query.replace(/\s+/g, "_")}`,
      itemsFetched: results.pinterest.fetched,
      itemsWritten: results.pinterest.written,
      status: "success",
      errorMessage: "",
      creditsUsed: rawPins.length,
    });
  } catch (err) {
    console.error("Pinterest fetch job failed:", err);
    await writeFetchMetadata({
      platform: "pinterest",
      jobType: "search",
      itemsFetched: 0,
      itemsWritten: 0,
      status: "error",
      errorMessage: String(err),
      creditsUsed: 0,
    });
  }

  // --- Expire old items ---
  results.expired = await deactivateExpiredItems();
  console.log("Fetch job complete:", results);
  return results;
}
