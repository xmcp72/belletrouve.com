// tiktok.ts
// Belle Trouvé — ScrapeCreators TikTok fetcher

import axios from "axios";
import {RawTikTokPost} from "../types";

const BASE_URL = "https://api.scrapecreators.com";

export async function fetchTikTokHashtagPosts(
  apiKey: string,
  hashtag: string,
  limit = 50
): Promise<RawTikTokPost[]> {
  try {
    const response = await axios.get(`${BASE_URL}/v1/tiktok/search/hashtag`, {
      headers: {"x-api-key": apiKey},
      params: {hashtag, limit},
      timeout: 30000,
    });
    const posts: RawTikTokPost[] = response.data?.aweme_list || response.data?.posts || response.data?.data || [];
    return posts.slice(0, limit);
  } catch (err) {
    console.error(`TikTok hashtag fetch error (${hashtag}):`, err);
    return [];
  }
}

export async function fetchTikTokUserPosts(
  apiKey: string,
  username: string,
  limit = 20
): Promise<RawTikTokPost[]> {
  try {
    const response = await axios.get(`${BASE_URL}/v3/tiktok/profile/videos`, {
      headers: {"x-api-key": apiKey},
      params: {handle: username, limit},
      timeout: 30000,
    });
    const posts: RawTikTokPost[] = response.data?.aweme_list || response.data?.posts || response.data?.data || [];
    return posts.slice(0, limit);
  } catch (err) {
    console.error(`TikTok user fetch error (${username}):`, err);
    return [];
  }
}

export async function fetchTikTokTrendingPosts(
  apiKey: string,
  limit = 50
): Promise<RawTikTokPost[]> {
  try {
    const response = await axios.get(`${BASE_URL}/v1/tiktok/get-trending-feed`, {
      headers: {"x-api-key": apiKey},
      params: {limit},
      timeout: 30000,
    });
    const posts: RawTikTokPost[] = response.data?.aweme_list || response.data?.posts || response.data?.data || [];
    return posts.slice(0, limit);
  } catch (err) {
    console.error("TikTok trending fetch error:", err);
    return [];
  }
}

// ── Apparel ───────────────────────────────────────────────────────────────────
export const APPAREL_HASHTAGS = [
  "womensfashion", "ootd", "outfitcheck", "styleinspo",
  "minidress", "summeroutfit", "casualoutfit", "trenchcoat",
];

// ── Shoes ─────────────────────────────────────────────────────────────────────
export const SHOES_HASHTAGS = [
  "shoesoftiktok", "heels", "balletflats", "loafers",
  "sneakers", "sandals", "bootseason", "mules",
];

// ── Handbags ──────────────────────────────────────────────────────────────────
export const HANDBAGS_HASHTAGS = [
  "handbag", "designerbag", "bagtok", "luxurybag",
  "totebag", "minibag", "shoulderbag", "whatsinmybag",
];

// ── Jewelry ───────────────────────────────────────────────────────────────────
export const JEWELRY_HASHTAGS = [
  "jewelry", "goldjewelry", "goldhoops", "necklace",
  "rings", "earrings", "jewelrytok", "pearljewelry",
];

// ── Accessories ───────────────────────────────────────────────────────────────
export const ACCESSORIES_HASHTAGS = [
  "sunglasses", "scarf", "fashionhat", "hairaccessories",
  "beltbag", "accessoriescheck", "silkscarf", "capstyle",
];

// ── Beauty & Wellness ─────────────────────────────────────────────────────────
export const BEAUTY_HASHTAGS = [
  "skincare", "grwm", "makeuptutorial", "sephorafinds",
  "perfumetok", "nailart", "glowup", "beautytok",
];

// ── All hashtags combined ─────────────────────────────────────────────────────
export const ALL_FASHION_HASHTAGS: Array<{hashtag: string; category: string}> = [
  ...APPAREL_HASHTAGS.map((h) => ({hashtag: h, category: "apparel"})),
  ...SHOES_HASHTAGS.map((h) => ({hashtag: h, category: "shoes"})),
  ...HANDBAGS_HASHTAGS.map((h) => ({hashtag: h, category: "handbags"})),
  ...JEWELRY_HASHTAGS.map((h) => ({hashtag: h, category: "jewelry"})),
  ...ACCESSORIES_HASHTAGS.map((h) => ({hashtag: h, category: "accessories"})),
  ...BEAUTY_HASHTAGS.map((h) => ({hashtag: h, category: "beauty"})),
];

// ── Curated TikTok fashion accounts ──────────────────────────────────────────
export const FASHION_ACCOUNTS = [
  "avenuestyle", "tezzamb", "brittany.xavier",
  "natalieborges", "farahdhukai", "hindash",
  "makeupbyariel", "glamzilla", "chrisspy",
];
