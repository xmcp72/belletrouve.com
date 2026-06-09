// writer.ts
// Belle Trouvé — Firestore write logic

import * as admin from "firebase-admin";
import {FeedItem, FetchMetadata} from "./types";

const db = () => admin.firestore();

export async function writeFeedItems(items: FeedItem[]): Promise<number> {
  if (items.length === 0) return 0;

  const batch = db().batch();
  let count = 0;

  for (const item of items) {
    const ref = db().collection("feed_items").doc(item.id);
    batch.set(ref, item, {merge: false});
    count++;

    // Firestore batch limit is 500 — commit and start new batch if needed
    if (count % 499 === 0) {
      await batch.commit();
    }
  }

  await batch.commit();
  return count;
}

export async function writeFetchMetadata(
  metadata: Omit<FetchMetadata, "lastFetchedAt">
): Promise<void> {
  const docId = `${metadata.platform}_${metadata.jobType}`;
  await db()
    .collection("fetch_metadata")
    .doc(docId)
    .set(
      {
        ...metadata,
        lastFetchedAt: admin.firestore.Timestamp.now(),
      },
      {merge: true}
    );
}

export async function deactivateExpiredItems(): Promise<number> {
  const now = admin.firestore.Timestamp.now();
  const snapshot = await db()
    .collection("feed_items")
    .where("expiresAt", "<=", now)
    .where("isActive", "==", true)
    .limit(500)
    .get();

  if (snapshot.empty) return 0;

  const batch = db().batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, {isActive: false});
  });
  await batch.commit();
  return snapshot.size;
}
