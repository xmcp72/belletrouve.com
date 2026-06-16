// pinterest.ts
// Belle Trouvé — ScrapeCreators Pinterest fetcher

import axios from "axios";
import {RawPinterestPin} from "../types";

const BASE_URL = "https://api.scrapecreators.com/v1";

export async function fetchPinterestSearchPins(
  apiKey: string,
  query: string,
  limit = 50
): Promise<RawPinterestPin[]> {
  try {
    const response = await axios.get(`${BASE_URL}/pinterest/search`, {
      headers: {"x-api-key": apiKey},
      params: {query, limit},
      timeout: 30000,
    });
    const pins: RawPinterestPin[] = response.data?.pins || response.data?.data || [];
    return pins.slice(0, limit);
  } catch (err) {
    console.error(`Pinterest search fetch error (${query}):`, err);
    return [];
  }
}

export async function fetchPinterestBoardPins(
  apiKey: string,
  boardUrl: string,
  limit = 50
): Promise<RawPinterestPin[]> {
  try {
    const response = await axios.get(`${BASE_URL}/pinterest/board`, {
      headers: {"x-api-key": apiKey},
      params: {board_url: boardUrl, limit},
      timeout: 30000,
    });
    const pins: RawPinterestPin[] = response.data?.pins || response.data?.data || [];
    return pins.slice(0, limit);
  } catch (err) {
    console.error(`Pinterest board fetch error (${boardUrl}):`, err);
    return [];
  }
}

// ── Apparel ───────────────────────────────────────────────────────────────────
export const APPAREL_QUERIES = [
  "women summer dress 2026", "linen midi dress outfit",
  "wrap dress style", "trench coat women outfit",
  "blazer outfit women", "street style women 2026",
  "minimalist outfit women", "chic casual women outfit",
];

// ── Shoes ─────────────────────────────────────────────────────────────────────
export const SHOES_QUERIES = [
  "women shoes 2026 trends", "ballet flats outfit",
  "loafers women style", "block heel sandals",
  "designer heels women", "sneakers women fashion",
  "mules women summer", "knee high boots women",
];

// ── Handbags ──────────────────────────────────────────────────────────────────
export const HANDBAGS_QUERIES = [
  "luxury handbags women", "designer tote bag",
  "mini bag trend 2026", "shoulder bag women style",
  "bucket bag outfit", "crossbody bag women",
  "quilted handbag", "leather handbag women",
];

// ── Jewelry ───────────────────────────────────────────────────────────────────
export const JEWELRY_QUERIES = [
  "gold jewelry women", "gold hoop earrings",
  "layered necklaces", "stacking rings women",
  "pearl jewelry trend", "statement earrings",
  "minimalist jewelry gold", "diamond tennis bracelet",
];

// ── Accessories ───────────────────────────────────────────────────────────────
export const ACCESSORIES_QUERIES = [
  "women sunglasses 2026", "silk scarf outfit women",
  "fashion hat women", "hair accessories trend",
  "belt bag women", "luxury accessories women",
  "wide brim hat outfit", "cat eye sunglasses women",
];

// ── Beauty & Wellness ─────────────────────────────────────────────────────────
export const BEAUTY_QUERIES = [
  "skincare routine products", "luxury perfume women",
  "makeup look 2026", "nail art ideas",
  "clean beauty products", "sephora must haves",
  "hair care women", "glowy skin routine",
];

// ── All queries combined ──────────────────────────────────────────────────────
export const ALL_FASHION_QUERIES: Array<{query: string; category: string}> = [
  ...APPAREL_QUERIES.map((q) => ({query: q, category: "apparel"})),
  ...SHOES_QUERIES.map((q) => ({query: q, category: "shoes"})),
  ...HANDBAGS_QUERIES.map((q) => ({query: q, category: "handbags"})),
  ...JEWELRY_QUERIES.map((q) => ({query: q, category: "jewelry"})),
  ...ACCESSORIES_QUERIES.map((q) => ({query: q, category: "accessories"})),
  ...BEAUTY_QUERIES.map((q) => ({query: q, category: "beauty"})),
];

// ── Curated Pinterest boards ──────────────────────────────────────────────────
export const FASHION_BOARDS = [
  "https://www.pinterest.com/songofstyle/style/",
  "https://www.pinterest.com/nordstrom/women-fashion/",
  "https://www.pinterest.com/refinery29/style/",
  "https://www.pinterest.com/voguemagazine/fashion/",
  "https://www.pinterest.com/harpersbazaar/style/",
];
