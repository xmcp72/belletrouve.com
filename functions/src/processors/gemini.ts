// gemini.ts
// Belle Trouvé — Gemini Vision extraction processor

import {GoogleGenAI} from "@google/genai";
import {GeminiExtractionResult, Category} from "../types";
import axios from "axios";

const PROJECT_ID = "chic-vivo";
const LOCATION = "us-central1";
const MODEL = "gemini-2.5-flash";

const ai = new GoogleGenAI({vertexai: true, project: PROJECT_ID, location: LOCATION});

const SYSTEM_INSTRUCTION = `You are a fashion product extraction assistant for Belle Trouvé, a women's fashion discovery app.

Given an image and optional caption from a social media post, your job is to determine whether this post features a specific, shoppable women's fashion or beauty product, and if so, extract structured data about it.

STRICT FILTERING RULES — set isFashionRelated to false if ANY of these apply:
- The post features men's clothing, men's shoes, or men's accessories (even if women also appear)
- The post is a lifestyle photo with no identifiable shoppable product (e.g. someone sitting at a cafe, travel photos, food)
- The post is a haul video thumbnail or GRWM thumbnail with no single clear product
- The post shows workout/gym wear or athletic apparel not suitable for everyday fashion
- The post is an ad graphic, text overlay only, or brand logo without a product
- The post features children's clothing
- The primary subject is a person's face with no visible fashion product
- The image is too low quality or obscured to identify a product

SET isFashionRelated to true ONLY if:
- A specific women's fashion item OR beauty/skincare/fragrance product is clearly visible and identifiable
- The item appears shoppable (not a costume, uniform, or purely artistic piece)

CATEGORY RULES — assign exactly one:
- Apparel: dresses, tops, skirts, pants, coats, jackets, sets, loungewear
- Shoes: all footwear
- Handbags: bags, purses, clutches, totes
- Jewelry: necklaces, earrings, rings, bracelets, anklets
- Accessories: sunglasses, scarves, hats, belts, hair accessories, wallets
- Beauty and Wellness: skincare, makeup, fragrance, nail products, haircare products
- Unknown: only if truly uncategorizable but still fashion-related

TRENDING TAGS — assign 2-4 short trend tags relevant to current fashion (e.g. "quiet luxury", "coastal grandmother", "ballet core", "mob wife", "office siren"). Leave empty if none apply.

You MUST respond with valid JSON only. No markdown, no explanation, no preamble.

JSON schema:
{
  "title": "specific product name (e.g. Gold Chunky Hoop Earrings, not just Earrings)",
  "brand": "brand name if clearly identifiable, else empty string",
  "price": numeric price if mentioned in caption else 0,
  "category": "Accessories | Apparel | Beauty and Wellness | Handbags | Jewelry | Shoes | Unknown",
  "subcategory": "specific subcategory e.g. Midi Dress, Tote Bag, Gold Hoops",
  "trendingTags": ["tag1", "tag2"],
  "isFashionRelated": true or false
}`;

// Download image bytes and return as base64 with mime type
async function fetchImageAsBase64(
  imageURL: string
): Promise<{base64: string; mimeType: string} | null> {
  try {
    const response = await axios.get(imageURL, {
      responseType: "arraybuffer",
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BelleTrouve/1.0)",
      },
    });
    const base64 = Buffer.from(response.data).toString("base64");
    const contentType = String(response.headers["content-type"] || "image/jpeg");
    const mimeType = contentType.split(";")[0].trim();
    return {base64, mimeType};
  } catch (err) {
    console.error("Image download error:", err);
    return null;
  }
}

export async function extractProductData(
  imageURL: string,
  caption: string,
  platform = "pinterest"
): Promise<GeminiExtractionResult> {
  const fallback: GeminiExtractionResult = {
    title: "",
    brand: "",
    price: 0,
    category: "Unknown" as Category,
    subcategory: "",
    trendingTags: [],
    isFashionRelated: false,
  };

  try {
    // Build content parts based on platform and image availability
    const captionText =
      "Caption: " +
      (caption || "(no caption)") +
      "\n\nExtract the fashion product information" +
      (platform === "tiktok" ? " from this caption (no image available)" : " from this image and caption") +
      ". Remember: set isFashionRelated to false for men's items, lifestyle photos without a clear shoppable product, or low-quality images.";

    let parts: object[];

    if (platform === "pinterest") {
      // Pinterest CDN is accessible by Vertex AI directly via URL
      parts = [
        {fileData: {mimeType: "image/jpeg", fileUri: imageURL}},
        {text: captionText},
      ];
    } else if (platform === "tiktok") {
      // TikTok CDN blocks both Vertex AI direct access and server-side downloads.
      // Fall back to caption-only extraction — still useful for categorization.
      if (!caption || caption.trim() === "") {
        console.log("TikTok post has no caption and image is inaccessible — skipping.");
        return fallback;
      }
      console.log("TikTok: using caption-only extraction (CDN blocked).");
      parts = [{text: captionText}];
    } else {
      // Instagram: attempt image download, fall back to caption-only if it fails
      const imageData = await fetchImageAsBase64(imageURL);
      if (imageData) {
        parts = [
          {inlineData: {mimeType: imageData.mimeType, data: imageData.base64}},
          {text: captionText},
        ];
      } else {
        if (!caption || caption.trim() === "") {
          console.log("Instagram: image download failed and no caption — skipping.");
          return fallback;
        }
        console.log("Instagram: image download failed, falling back to caption-only.");
        parts = [{text: captionText}];
      }
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      config: {systemInstruction: SYSTEM_INSTRUCTION},
      contents: [{role: "user", parts}],
    });

    const text = response.text ?? "";
    if (!text) return fallback;

    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as GeminiExtractionResult;
    return parsed;
  } catch (err) {
    console.error("Gemini extraction error:", err);
    return fallback;
  }
}
