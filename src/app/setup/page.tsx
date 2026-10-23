import { currentStore, loadAppData } from "@/server/mode";
import { feedUrl } from "@/server/sync";
import { SetupView } from "@/views/setup/SetupView";

/** "https://canvas.emory.edu/feeds/calendars/user_abc123.ics" → "canvas.emory.edu/feeds/calendars/user_ab••••.ics" (the link is a secret). */
function maskFeed(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/");
    const last = parts.pop() ?? "";
    const masked = last.length > 10 ? `${last.slice(0, 7)}••••${last.slice(-4)}` : "••••";
    return `${u.host}${parts.join("/")}/${masked}`;
  } catch {
    return "Saved link";
  }
}

export default async function Page() {
  const data = await loadAppData();
  const { store, mode } = await currentStore();
  const semesterSaved = !!(store.getSetting("semesterStart") && store.getSetting("semesterEnd"));
  const feedLink = mode === "demo" ? null : maskFeed(feedUrl(store));
  return <SetupView data={data} semesterSaved={semesterSaved} feedLink={feedLink} />;
}
