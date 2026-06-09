// gemini.ts
// Belle Trouvé — Gemini Vision extraction processor

import {GoogleGenAI} from "@google/genai";
import {GeminiExtractionResult, Category} from "../types";

const PROJECT_ID = "chic-vivo";
const LOCATION = "us-central1";
const MODEL = "gemini-2.5-flash";

const ai = new GoogleGenAI({vertexai: true, project: PROJECT_ID, location: LOCATION});

const SYSTEM_INSTRUCTION = "You are a fashion product extraction assistant for Belle Trouvé, a women's fashion discovery app. Given an image and optional caption from a social media post, extract structured product information. You MUST respond with valid JSON only, no markdown, no explanation, no preamble. JSON schema: {title: product name, brand: brand name if identifiable else empty string, price: numeric price if mentioned else 0, category: one of exactly Accessories or Apparel or Beauty and Wellness or Handbags or Jewelry or Shoes or Unknown, subcategory: relevant subcategory else empty string, trendingTags: array of 0-4 relevant trend tags, isFashionRelated: true if fashion product or beauty item false otherwise}. If the post is not about a specific fashion product set isFashionRelated to false.";

export async function extractProductData(
  imageURL: string,
  caption: string
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
    const response = await ai.models.generateContent({
      model: MODEL,
      config: {systemInstruction: SYSTEM_INSTRUCTION},
      contents: [{
        role: "user",
        parts: [
          {fileData: {mimeType: "image/jpeg", fileUri: imageURL}},
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
