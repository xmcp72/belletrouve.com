// instagram.ts
// Belle Trouvé — ScrapeCreators Instagram fetcher

import axios from "axios";
import {RawInstagramPost} from "../types";

const BASE_URL = "https://api.scrapecreators.com";

export async function fetchInstagramHashtagPosts(
  apiKey: string,
  hashtag: string,
  limit = 20
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
  limit = 12
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

// Fashion hashtags to rotate through on each fetch run
export const FASHION_HASHTAGS = [
  "ootd",
  "fashionstyle",
  "womensfashion",
  "outfitoftheday",
  "styleinspo",
  "fashionblogger",
  "luxuryfashion",
  "streetstyle",
];

// Curated fashion accounts to pull from
export const FASHION_ACCOUNTS = [
  "songofstyle",
  "wendyslookbook",
  "aimeesongsong",
  "chiaraferragni",
  "leandramcohen",
];
