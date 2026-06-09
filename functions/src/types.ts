// types.ts
// Belle Trouvé — Cloud Functions shared TypeScript interfaces

export interface FeedItem {
  id: string;
  title: string;
  brand: string;
  price: number;
  imageURL: string;
  affiliateURL: string;
  platform: Platform;
  category: Category;
  subcategory: string;
  sourceURL: string;
  sourcePlatformId: string;
  fetchedAt: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp;
  isActive: boolean;
  engagementScore: number;
  trendingTags: string[];
}

export interface FetchMetadata {
  platform: Platform;
  jobType: string;
  lastFetchedAt: FirebaseFirestore.Timestamp;
  itemsFetched: number;
  itemsWritten: number;
  status: "success" | "error" | "partial";
  errorMessage: string;
  creditsUsed: number;
}

export type Platform = "instagram" | "tiktok" | "pinterest" | "curated";

export type Category =
  | "Accessories"
  | "Apparel"
  | "Beauty & Wellness"
  | "Handbags"
  | "Jewelry"
  | "Shoes"
  | "Unknown";

export interface RawInstagramPost {
  id: string;
  shortcode: string;
  display_url: string;
  thumbnail_url?: string;
  caption?: string;
  like_count: number;
  timestamp: number;
  permalink?: string;
  media_type?: string;
}

export interface RawTikTokPost {
  id: string;
  desc: string;
  video?: { cover: string; playAddr?: string };
  stats?: { diggCount: number; shareCount: number; commentCount: number; playCount: number };
  createTime: number;
  author?: { uniqueId: string; nickname: string };
}

export interface RawPinterestPin {
  id: string;
  title?: string;
  description?: string;
  images?: { orig?: { url: string }; "736x"?: { url: string } };
  save_count?: number;
  link?: string;
  dominant_color?: string;
}

export interface GeminiExtractionResult {
  title: string;
  brand: string;
  price: number;
  category: Category;
  subcategory: string;
  trendingTags: string[];
  isFashionRelated: boolean;
}
