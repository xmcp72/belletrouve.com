// normalizer.ts
// Belle Trouvé — Maps raw scraped posts into FeedItem shape

import * as admin from "firebase-admin";
import {
  FeedItem,
  RawInstagramPost,
  RawTikTokPost,
  RawPinterestPin,
  GeminiExtractionResult,
} from "./types";

const EXPIRY_HOURS = 48;

function expiryTimestamp(): admin.firestore.Timestamp {
  const d = new Date();
  d.setHours(d.getHours() + EXPIRY_HOURS);
  return admin.firestore.Timestamp.fromDate(d);
}

export function normalizeInstagramPost(
  post: RawInstagramPost,
  gemini: GeminiExtractionResult
): FeedItem {
  const imageURL = post.display_url || post.thumbnail_url || "";
  const sourceURL = post.permalink ?
    post.permalink :
    `https://www.instagram.com/p/${post.shortcode}/`;

  return {
    id: `instagram_${post.id}`,
    title: gemini.title,
    brand: gemini.brand,
    price: gemini.price,
    imageURL,
    affiliateURL: "",
    platform: "instagram",
    category: gemini.category,
    subcategory: gemini.subcategory,
    sourceURL,
    sourcePlatformId: post.id,
    fetchedAt: admin.firestore.Timestamp.now(),
    expiresAt: expiryTimestamp(),
    isActive: true,
    engagementScore: post.like_count || 0,
    trendingTags: gemini.trendingTags,
  };
}

export function normalizeTikTokPost(
  post: RawTikTokPost,
  gemini: GeminiExtractionResult
): FeedItem {
  const imageURL = post.video?.cover || "";
  const sourceURL = post.author ?
    `https://www.tiktok.com/@${post.author.uniqueId}/video/${post.id}` :
    `https://www.tiktok.com/video/${post.id}`;
  const engagementScore =
    (post.stats?.diggCount || 0) + (post.stats?.playCount || 0) / 100;

  return {
    id: `tiktok_${post.id}`,
    title: gemini.title,
    brand: gemini.brand,
    price: gemini.price,
    imageURL,
    affiliateURL: "",
    platform: "tiktok",
    category: gemini.category,
    subcategory: gemini.subcategory,
    sourceURL,
    sourcePlatformId: post.id,
    fetchedAt: admin.firestore.Timestamp.now(),
    expiresAt: expiryTimestamp(),
    isActive: true,
    engagementScore,
    trendingTags: gemini.trendingTags,
  };
}

export function normalizePinterestPin(
  pin: RawPinterestPin,
  gemini: GeminiExtractionResult
): FeedItem {
  const imageURL =
    pin.images?.["736x"]?.url || pin.images?.orig?.url || "";
  const sourceURL = `https://www.pinterest.com/pin/${pin.id}/`;

  return {
    id: `pinterest_${pin.id}`,
    title: gemini.title || pin.title || "",
    brand: gemini.brand,
    price: gemini.price,
    imageURL,
    affiliateURL: pin.link || "",
    platform: "pinterest",
    category: gemini.category,
    subcategory: gemini.subcategory,
    sourceURL,
    sourcePlatformId: pin.id,
    fetchedAt: admin.firestore.Timestamp.now(),
    expiresAt: expiryTimestamp(),
    isActive: true,
    engagementScore: pin.save_count || 0,
    trendingTags: gemini.trendingTags,
  };
}
