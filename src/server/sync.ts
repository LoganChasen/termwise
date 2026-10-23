import { parseFeed } from "../lib/ics";
import type { UpdateEvent } from "../lib/types";
import { getStore, type Store } from "./db";

/** Don't refetch more often than this unless forced. */
const MIN_SYNC_INTERVAL_MS = 10 * 60 * 1000;

export class FeedError extends Error {}

/** The feed link from setup, falling back to CANVAS_FEED_URL in .env.local. */
export function feedUrl(store: Store = getStore()): string | null {
  const url = store.getSetting("feedUrl") ?? process.env.CANVAS_FEED_URL ?? null;
  return url ? url.trim().replace(/^webcal:\/\//i, "https://") : null;
}

/** Fetch the Canvas feed and store it. Returns the changes found, or null if skipped. */
export async function syncFeed({ force = false, store = getStore(), now = new Date() } = {}): Promise<UpdateEvent[] | null> {
  const url = feedUrl(store);
  if (!url) throw new FeedError("No calendar feed connected yet.");
  const last = store.getSetting("lastSyncAt");
  if (!force && last && now.getTime() - new Date(last).getTime() < MIN_SYNC_INTERVAL_MS) return null;

  let body: string;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "Termwise (personal dashboard)" } });
    if (!res.ok) throw new FeedError(`Canvas answered ${res.status}. Check that the calendar feed link is right.`);
    body = await res.text();
  } catch (e) {
    if (e instanceof FeedError) throw e;
    throw new FeedError("Couldn't reach the calendar feed. Check your internet connection.");
  }
  if (!body.includes("BEGIN:VCALENDAR")) throw new FeedError("That link didn't return a calendar. Copy the Calendar Feed link from Canvas again.");
  return store.applyFeed(parseFeed(body), now);
}
