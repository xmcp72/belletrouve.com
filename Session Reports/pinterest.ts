// pinterest.ts
// Belle Trouvé — ScrapeCreators Pinterest fetcher

import axios from "axios";
import {RawPinterestPin} from "../types";

const BASE_URL = "https://api.scrapecreators.com/v1";

export async function fetchPinterestSearchPins(
  apiKey: string,
  query: string,
  limit = 20
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
  limit = 20
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

// Fashion search queries to rotate through on each fetch run
export const FASHION_QUERIES = [
  "women fashion outfit",
  "luxury handbags",
  "summer style 2026",
  "minimalist fashion",
  "street style women",
  "designer shoes women",
  "jewelry trends",
  "capsule wardrobe",
];

// Curated Pinterest boards
export const FASHION_BOARDS = [
  "https://www.pinterest.com/songofstyle/style/",
  "https://www.pinterest.com/nordstrom/women-fashion/",
  "https://www.pinterest.com/refinery29/style/",
];
