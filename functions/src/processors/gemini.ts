// gemini.ts
// Belle Trouvé — Gemini Vision extraction processor

import {GoogleGenAI} from "@google/genai";
import {GeminiExtractionResult, Category} from "../types";
import axios from "axios";

const PROJECT_ID = "chic-vivo";
const LOCATION = "us-central1";
const MODEL = "gemini-2.5-flash";

const ai = new GoogleGenAI({vertexai: true, project: PROJECT_ID, location: LOCATION});

const SYSTEM_INSTRUCTION = "You are a fashion product extraction assistant for Belle Trouvé, a women's fashion discovery app. Given an image and optional caption from a social media post, extract structured product information. You MUST respond with valid JSON only, no markdown, no explanation, no preamble. JSON schema: {title: product name, brand: brand name if identifiable else empty string, price: numeric price if mentioned else 0, category: one of exactly Accessories or Apparel or Beauty and Wellness or Handbags or Jewelry or Shoes or Unknown, subcategory: relevant subcategory else empty string, trendingTags: array of 0-4 relevant trend tags, isFashionRelated: true if fashion product or beauty item false otherwise}. If the post is not about a specific fashion product set isFashionRelated to false.";

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
    // Pinterest CDN is accessible by Vertex AI directly.
    // Instagram and TikTok CDNs block Vertex AI — download bytes first.
    let imagePart: object;

    if (platform === "pinterest") {
      imagePart = {fileData: {mimeType: "image/jpeg", fileUri: imageURL}};
    } else {
      const imageData = await fetchImageAsBase64(imageURL);
      if (!imageData) return fallback;
      imagePart = {inlineData: {mimeType: imageData.mimeType, data: imageData.base64}};
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      config: {systemInstruction: SYSTEM_INSTRUCTION},
      contents: [{
        role: "user",
        parts: [
          imagePart,
          {text: "Caption: " + (caption || "(no caption)") + "\n\nExtract the fashion product information from this image and caption."},
        ],
      }],
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
