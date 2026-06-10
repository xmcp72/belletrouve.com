// tiktok.ts
// Belle Trouvé — ScrapeCreators TikTok fetcher

import axios from "axios";
import {RawTikTokPost} from "../types";

const BASE_URL = "https://api.scrapecreators.com";

export async function fetchTikTokHashtagPosts(
  apiKey: string,
  hashtag: string,
  limit = 20
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
  limit = 12
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
  limit = 20
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

// Fashion hashtags to rotate through on each fetch run
export const FASHION_HASHTAGS = [
  "ootd",
  "fashiontiktok",
  "outfitinspo",
  "grwm",
  "stylecheck",
  "fashionhaul",
  "luxuryfashion",
  "outfitoftheday",
];

// Curated TikTok fashion accounts
export const FASHION_ACCOUNTS = [
  "avenuestyle",
  "tezzamb",
  "lelepons",
  "brittany.xavier",
  "natalieborges",
];
