// index.ts
// Belle Trouvé — Cloud Functions entry points
// Session 24: Split into per-platform functions, each with own 540s window

import * as admin from "firebase-admin";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onRequest} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import {extractProductData} from "./processors/gemini";
import {
  fetchInstagramHashtagPosts,
  ALL_FASHION_HASHTAGS as IG_HASHTAGS,
} from "./fetchers/instagram";
import {
  fetchTikTokHashtagPosts,
  ALL_FASHION_HASHTAGS as TT_HASHTAGS,
} from "./fetchers/tiktok";
import {
  fetchPinterestSearchPins,
  ALL_FASHION_QUERIES as PT_QUERIES,
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

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Shared function config
// ─────────────────────────────────────────────────────────────────────────────

const COMMON_CONFIG = {
  region: "us-central1" as const,
  timeoutSeconds: 540,
  memory: "1GiB" as const,
  secrets: [SCRAPECREATORS_API_KEY],
};

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Instagram (scheduled + manual)
// ─────────────────────────────────────────────────────────────────────────────

export const fetchInstagram = onSchedule(
  {
    ...COMMON_CONFIG,
    schedule: "0 7 */2 * *", // 7am UTC every 2 days
  },
  async () => {
    const apiKey = SCRAPECREATORS_API_KEY.value();
    console.log("Scheduled: starting Instagram fetch...");
    await runInstagramFetch(apiKey);
  }
);

export const manualFetchInstagram = onRequest(
  COMMON_CONFIG,
  async (req, res) => {
    if (req.query.token !== "belletrouve-dev") {
      res.status(401).send("Unauthorized");
      return;
    }
    const apiKey = SCRAPECREATORS_API_KEY.value();
    console.log("Manual: starting Instagram fetch...");
    const result = await runInstagramFetch(apiKey);
    res.json(result);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - TikTok (scheduled + manual)
// ─────────────────────────────────────────────────────────────────────────────

export const fetchTikTok = onSchedule(
  {
    ...COMMON_CONFIG,
    schedule: "30 7 */2 * *", // 7:30am UTC every 2 days (30 min after Instagram)
  },
  async () => {
    const apiKey = SCRAPECREATORS_API_KEY.value();
    console.log("Scheduled: starting TikTok fetch...");
    await runTikTokFetch(apiKey);
  }
);

export const manualFetchTikTok = onRequest(
  COMMON_CONFIG,
  async (req, res) => {
    if (req.query.token !== "belletrouve-dev") {
      res.status(401).send("Unauthorized");
      return;
    }
    const apiKey = SCRAPECREATORS_API_KEY.value();
    console.log("Manual: starting TikTok fetch...");
    const result = await runTikTokFetch(apiKey);
    res.json(result);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Pinterest (scheduled + manual)
// ─────────────────────────────────────────────────────────────────────────────

export const fetchPinterest = onSchedule(
  {
    ...COMMON_CONFIG,
    schedule: "0 8 */2 * *", // 8:00am UTC every 2 days (1 hr after Instagram)
  },
  async () => {
    const apiKey = SCRAPECREATORS_API_KEY.value();
    console.log("Scheduled: starting Pinterest fetch...");
    await runPinterestFetch(apiKey);
  }
);

export const manualFetchPinterest = onRequest(
  COMMON_CONFIG,
  async (req, res) => {
    if (req.query.token !== "belletrouve-dev") {
      res.status(401).send("Unauthorized");
      return;
    }
    const apiKey = SCRAPECREATORS_API_KEY.value();
    console.log("Manual: starting Pinterest fetch...");
    const result = await runPinterestFetch(apiKey);
    res.json(result);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Expire old items (scheduled daily + manual)
// ─────────────────────────────────────────────────────────────────────────────

export const expireOldItems = onSchedule(
  {
    ...COMMON_CONFIG,
    schedule: "0 9 */2 * *", // 9:00am UTC every 2 days (after all fetches)
  },
  async () => {
    console.log("Scheduled: expiring old items...");
    const expired = await deactivateExpiredItems();
    console.log(`Expired ${expired} items`);
  }
);

export const manualExpire = onRequest(
  COMMON_CONFIG,
  async (req, res) => {
    if (req.query.token !== "belletrouve-dev") {
      res.status(401).send("Unauthorized");
      return;
    }
    console.log("Manual: expiring old items...");
    const expired = await deactivateExpiredItems();
    res.json({expired});
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Legacy combined manual trigger (kept for backward compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export const manualFetch = onRequest(
  COMMON_CONFIG,
  async (req, res) => {
    if (req.query.token !== "belletrouve-dev") {
      res.status(401).send("Unauthorized");
      return;
    }
    // This now only runs Instagram to avoid timeout — use per-platform endpoints instead
    const apiKey = SCRAPECREATORS_API_KEY.value();
    console.log("Legacy manualFetch: running Instagram only. Use per-platform endpoints.");
    const result = await runInstagramFetch(apiKey);
    res.json({
      note: "Legacy endpoint — runs Instagram only. Use /manualFetchTikTok and /manualFetchPinterest for other platforms.",
      instagram: result,
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// MARK: - Platform fetch implementations
// ─────────────────────────────────────────────────────────────────────────────

async function runInstagramFetch(apiKey: string) {
  const result = {fetched: 0, written: 0, status: "success", error: ""};
  try {
    console.log(`Fetching ${IG_HASHTAGS.length} Instagram hashtags in parallel...`);
    const igBatches = await Promise.all(
      IG_HASHTAGS.map(({hashtag}) => fetchInstagramHashtagPosts(apiKey, hashtag, 50))
    );
    const allIgPosts = igBatches.flat();
    result.fetched = allIgPosts.length;
    console.log(`Instagram: fetched ${allIgPosts.length} raw posts`);

    const feedItems: FeedItem[] = [];
    await Promise.all(
      allIgPosts.map(async (post) => {
        const imageURL = post.display_url || post.thumbnail_url || "";
        if (!imageURL) return;
        const gemini = await extractProductData(imageURL, post.caption || "", "instagram");
        if (!gemini.isFashionRelated) return;
        feedItems.push(normalizeInstagramPost(post, gemini));
      })
    );

    result.written = await writeFeedItems(feedItems);
    await writeFetchMetadata({
      platform: "instagram",
      jobType: "hashtag_matrix",
      itemsFetched: result.fetched,
      itemsWritten: result.written,
      status: "success",
      errorMessage: "",
      creditsUsed: IG_HASHTAGS.length,
    });
    console.log(`Instagram: wrote ${result.written} items`);
  } catch (err) {
    result.status = "error";
    result.error = String(err);
    console.error("Instagram fetch failed:", err);
    await writeFetchMetadata({
      platform: "instagram",
      jobType: "hashtag_matrix",
      itemsFetched: 0,
      itemsWritten: 0,
      status: "error",
      errorMessage: String(err),
      creditsUsed: 0,
    });
  }
  return result;
}

async function runTikTokFetch(apiKey: string) {
  const result = {fetched: 0, written: 0, status: "success", error: ""};
  try {
    console.log(`Fetching ${TT_HASHTAGS.length} TikTok hashtags in parallel...`);
    const ttBatches = await Promise.all(
      TT_HASHTAGS.map(({hashtag}) => fetchTikTokHashtagPosts(apiKey, hashtag, 50))
    );
    const allTtPosts = ttBatches.flat();
    result.fetched = allTtPosts.length;
    console.log(`TikTok: fetched ${allTtPosts.length} raw posts`);

    const feedItems: FeedItem[] = [];
    await Promise.all(
      allTtPosts.map(async (post) => {
        const imageURL = (post.video?.cover as any)?.url_list?.[0] || post.video?.cover || "";
        if (!imageURL) return;
        const gemini = await extractProductData(imageURL, post.desc || "", "tiktok");
        if (!gemini.isFashionRelated) return;
        feedItems.push(normalizeTikTokPost(post, gemini));
      })
    );

    result.written = await writeFeedItems(feedItems);
    await writeFetchMetadata({
      platform: "tiktok",
      jobType: "hashtag_matrix",
      itemsFetched: result.fetched,
      itemsWritten: result.written,
      status: "success",
      errorMessage: "",
      creditsUsed: TT_HASHTAGS.length,
    });
    console.log(`TikTok: wrote ${result.written} items`);
  } catch (err) {
    result.status = "error";
    result.error = String(err);
    console.error("TikTok fetch failed:", err);
    await writeFetchMetadata({
      platform: "tiktok",
      jobType: "hashtag_matrix",
      itemsFetched: 0,
      itemsWritten: 0,
      status: "error",
      errorMessage: String(err),
      creditsUsed: 0,
    });
  }
  return result;
}

async function runPinterestFetch(apiKey: string) {
  const result = {fetched: 0, written: 0, status: "success", error: ""};
  try {
    console.log(`Fetching ${PT_QUERIES.length} Pinterest queries in parallel...`);
    const ptBatches = await Promise.all(
      PT_QUERIES.map(({query}) => fetchPinterestSearchPins(apiKey, query, 50))
    );
    const allPins = ptBatches.flat();
    result.fetched = allPins.length;
    console.log(`Pinterest: fetched ${allPins.length} raw pins`);

    const feedItems: FeedItem[] = [];
    await Promise.all(
      allPins.map(async (pin) => {
        const imageURL = pin.images?.["736x"]?.url || pin.images?.orig?.url || "";
        if (!imageURL) return;
        const gemini = await extractProductData(
          imageURL,
          `${pin.title || ""} ${pin.description || ""}`.trim()
        );
        if (!gemini.isFashionRelated) return;
        feedItems.push(normalizePinterestPin(pin, gemini));
      })
    );

    result.written = await writeFeedItems(feedItems);
    await writeFetchMetadata({
      platform: "pinterest",
      jobType: "search_matrix",
      itemsFetched: result.fetched,
      itemsWritten: result.written,
      status: "success",
      errorMessage: "",
      creditsUsed: PT_QUERIES.length,
    });
    console.log(`Pinterest: wrote ${result.written} items`);
  } catch (err) {
    result.status = "error";
    result.error = String(err);
    console.error("Pinterest fetch failed:", err);
    await writeFetchMetadata({
      platform: "pinterest",
      jobType: "search_matrix",
      itemsFetched: 0,
      itemsWritten: 0,
      status: "error",
      errorMessage: String(err),
      creditsUsed: 0,
    });
  }
  return result;
}
