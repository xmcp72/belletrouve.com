// instagram.ts
// Belle Trouvé — ScrapeCreators Instagram fetcher

import axios from "axios";
import {RawInstagramPost} from "../types";

const BASE_URL = "https://api.scrapecreators.com";

export async function fetchInstagramHashtagPosts(
  apiKey: string,
  hashtag: string,
  limit = 50
): Promise<RawInstagramPost[]> {
  try {
    const response = await axios.get(`${BASE_URL}/v1/instagram/search/hashtag`, {
      headers: {"x-api-key": apiKey},
      params: {hashtag, limit},
      timeout: 30000,
    });
    const posts: RawInstagramPost[] = response.data?.posts || response.data?.data || [];
    return posts.slice(0, limit);
  } catch (err) {
    console.error(`Instagram hashtag fetch error (${hashtag}):`, err);
    return [];
  }
}

export async function fetchInstagramUserPosts(
  apiKey: string,
  username: string,
  limit = 20
): Promise<RawInstagramPost[]> {
  try {
    const response = await axios.get(`${BASE_URL}/v2/instagram/user/posts`, {
      headers: {"x-api-key": apiKey},
      params: {handle: username, limit},
      timeout: 30000,
    });
    const posts: RawInstagramPost[] = response.data?.posts || response.data?.data || [];
    return posts.slice(0, limit);
  } catch (err) {
    console.error(`Instagram user fetch error (${username}):`, err);
    return [];
  }
}

// ── Apparel ──────────────────────────────────────────────────────────────────
export const APPAREL_HASHTAGS = [
  "womensfashion", "ootd", "outfitoftheday", "styleinspo",
  "minidress", "maxidress", "wrapDress", "linendress",
  "trenchcoat", "blazerstyle", "casualchic", "streetstyle",
];

// ── Shoes ─────────────────────────────────────────────────────────────────────
export const SHOES_HASHTAGS = [
  "womensshoes", "heels", "balletflats", "loaferstyle",
  "sneakersfashion", "sandalsseason", "mules", "booties",
];

// ── Handbags ──────────────────────────────────────────────────────────────────
export const HANDBAGS_HASHTAGS = [
  "handbag", "designerbag", "toteBAG", "shoulderbag",
  "minibag", "luxuryhandbag", "bucketbag", "crossbodybag",
];

// ── Jewelry ───────────────────────────────────────────────────────────────────
export const JEWELRY_HASHTAGS = [
  "jewelryofinstagram", "goldjewelry", "goldhoops", "statementnecklace",
  "stackingrings", "pearljewelry", "minimalistjewelry", "earringoftheday",
];

// ── Accessories ───────────────────────────────────────────────────────────────
export const ACCESSORIES_HASHTAGS = [
  "sunglasses", "silkscarf", "fashionhat", "beltbag",
  "hairaccessories", "luxuryaccessories", "scarfstyle", "capstyle",
];

// ── Beauty & Wellness ─────────────────────────────────────────────────────────
export const BEAUTY_HASHTAGS = [
  "skincareroutine", "makeuplovers", "sephorahaul", "glowskin",
  "fragrancecollection", "lipcombo", "nailinspo", "haircareRoutine",
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

// ── Curated fashion accounts ──────────────────────────────────────────────────
export const FASHION_ACCOUNTS = [
  "songofstyle", "wendyslookbook", "aimeesongsong",
  "chiaraferragni", "leandramcohen", "weworewhat",
  "sincerelyjules", "atlanticpacific", "gary.pepper",
  "styleheroine",
];
