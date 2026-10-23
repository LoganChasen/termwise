import { join } from "node:path";
import { cookies } from "next/headers";
import { dayKey } from "../lib/dates";
import { seedDemo } from "../demo/seed";
import { getStore, Store } from "./db";
import { buildAppData, type AppData } from "./model";
import { feedUrl } from "./sync";

export const DEMO_COOKIE = "tw-demo";

let demo: Store | null = null;

/** The demo store, re-seeded once a day so it always looks mid-semester. */
export function getDemoStore(now = new Date()): Store {
  demo ??= new Store(process.env.TERMWISE_DEMO_DB ?? join(process.cwd(), "data", "demo.db"));
  if (demo.getSetting("demoSeededFor") !== dayKey(now)) seedDemo(demo, now);
  return demo;
}

export async function currentMode(): Promise<"real" | "demo"> {
  const jar = await cookies();
  return jar.get(DEMO_COOKIE)?.value === "1" ? "demo" : "real";
}

export async function currentStore(): Promise<{ store: Store; mode: "real" | "demo" }> {
  const mode = await currentMode();
  return { store: mode === "demo" ? getDemoStore() : getStore(), mode };
}

/** Everything a page needs, for whichever mode is active. */
export async function loadAppData(): Promise<AppData> {
  const { store, mode } = await currentStore();
  return buildAppData(store, { mode, feedConnected: mode === "demo" || !!feedUrl(store) });
}
