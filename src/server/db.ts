import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { diffFeed } from "../lib/diff";
import type { Course, FeedItem, ParsedFeed, StoredItem, UpdateEvent } from "../lib/types";

/**
 * Local storage in data/termwise.db (gitignored). Server-only.
 * Set TERMWISE_DB=":memory:" for tests.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY, label TEXT NOT NULL, name TEXT NOT NULL, color_index INTEGER NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS items (
  uid TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, course_id TEXT,
  start TEXT NOT NULL, end TEXT, all_day INTEGER NOT NULL, url TEXT,
  first_seen TEXT NOT NULL, done_at TEXT, estimate_override REAL, removed_at TEXT
);
CREATE TABLE IF NOT EXISTS updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, at TEXT NOT NULL, uid TEXT,
  course_id TEXT, title TEXT NOT NULL, before TEXT, after TEXT
);
CREATE TABLE IF NOT EXISTS docs (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
`;

export interface ItemState {
  doneAt: string | null;
  estimateOverride: number | null;
}

export class Store {
  readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(SCHEMA);
  }

  // ---------- settings ----------
  getSetting(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }
  setSetting(key: string, value: string | null): void {
    if (value === null) this.db.prepare("DELETE FROM settings WHERE key = ?").run(key);
    else this.db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
  }

  // ---------- JSON documents (syllabi, grades, ...) ----------
  getDoc<T>(key: string): T | null {
    const row = this.db.prepare("SELECT value FROM docs WHERE key = ?").get(key) as { value: string } | undefined;
    return row ? (JSON.parse(row.value) as T) : null;
  }
  setDoc(key: string, value: unknown, now = new Date()): void {
    this.db
      .prepare("INSERT INTO docs (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
      .run(key, JSON.stringify(value), now.toISOString());
  }
  listDocs<T>(prefix: string): { key: string; value: T }[] {
    const rows = this.db.prepare("SELECT key, value FROM docs WHERE key LIKE ? ORDER BY key").all(`${prefix}%`) as { key: string; value: string }[];
    return rows.map((r) => ({ key: r.key, value: JSON.parse(r.value) as T }));
  }

  // ---------- courses ----------
  listCourses(): (Course & { hidden: boolean })[] {
    const rows = this.db.prepare("SELECT * FROM courses ORDER BY color_index").all() as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id), label: String(r.label), name: String(r.name), colorIndex: Number(r.color_index), hidden: !!r.hidden,
    }));
  }
  /** Adds new courses; keeps names/colors the user already edited. */
  upsertCourses(courses: Course[]): void {
    const count = (this.db.prepare("SELECT COUNT(*) AS n FROM courses").get() as { n: number }).n;
    let next = count;
    const insert = this.db.prepare("INSERT INTO courses (id, label, name, color_index) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET label = excluded.label");
    for (const c of courses) {
      const exists = this.db.prepare("SELECT 1 FROM courses WHERE id = ?").get(c.id);
      insert.run(c.id, c.label, c.name, exists ? 0 : next++);
    }
  }
  updateCourse(id: string, patch: { name?: string; hidden?: boolean; colorIndex?: number }): void {
    if (patch.name !== undefined) this.db.prepare("UPDATE courses SET name = ? WHERE id = ?").run(patch.name, id);
    if (patch.hidden !== undefined) this.db.prepare("UPDATE courses SET hidden = ? WHERE id = ?").run(patch.hidden ? 1 : 0, id);
    if (patch.colorIndex !== undefined) this.db.prepare("UPDATE courses SET color_index = ? WHERE id = ?").run(patch.colorIndex, id);
  }

  // ---------- items ----------
  listItems({ includeRemoved = false } = {}): StoredItem[] {
    const sql = includeRemoved ? "SELECT * FROM items ORDER BY start" : "SELECT * FROM items WHERE removed_at IS NULL ORDER BY start";
    return (this.db.prepare(sql).all() as Record<string, unknown>[]).map(toItem);
  }
  setDone(uid: string, done: boolean, now = new Date()): void {
    const doneAt = done ? now.toISOString() : null;
    const r = this.db.prepare("UPDATE items SET done_at = ? WHERE uid = ?").run(doneAt, uid);
    if (r.changes === 0) this.setItemState(uid, { doneAt });
  }
  setEstimate(uid: string, hours: number | null): void {
    const r = this.db.prepare("UPDATE items SET estimate_override = ? WHERE uid = ?").run(hours, uid);
    if (r.changes === 0) this.setItemState(uid, { estimateOverride: hours });
  }

  /** Done/estimate state for items that aren't in the feed (exams from a syllabus). */
  getItemState(uid: string): ItemState {
    return this.getDoc<ItemState>(`itemstate:${uid}`) ?? { doneAt: null, estimateOverride: null };
  }
  private setItemState(uid: string, patch: Partial<ItemState>): void {
    this.setDoc(`itemstate:${uid}`, { ...this.getItemState(uid), ...patch });
  }

  /**
   * Store a freshly fetched feed and record what changed. The very first sync is
   * the baseline, so it doesn't flood the Updates feed with "added" rows.
   */
  applyFeed(feed: ParsedFeed, now = new Date()): UpdateEvent[] {
    const at = now.toISOString();
    const prev: FeedItem[] = this.listItems();
    const isFirst = (this.db.prepare("SELECT COUNT(*) AS n FROM items").get() as { n: number }).n === 0;
    const updates = isFirst ? [] : diffFeed(prev, feed.items, now);

    this.db.exec("BEGIN");
    try {
      this.upsertCourses(feed.courses);
      const upsert = this.db.prepare(`
        INSERT INTO items (uid, kind, title, course_id, start, end, all_day, url, first_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(uid) DO UPDATE SET kind = excluded.kind, title = excluded.title, course_id = excluded.course_id,
          start = excluded.start, end = excluded.end, all_day = excluded.all_day, url = excluded.url, removed_at = NULL`);
      for (const i of feed.items) upsert.run(i.uid, i.kind, i.title, i.courseId, i.start, i.end, i.allDay ? 1 : 0, i.url, at);
      const markRemoved = this.db.prepare("UPDATE items SET removed_at = ? WHERE uid = ?");
      for (const u of updates) if (u.kind === "removed" && u.uid) markRemoved.run(at, u.uid);
      this.addUpdates(updates);
      this.setSetting("lastSyncAt", at);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    return updates;
  }

  // ---------- updates ----------
  addUpdates(updates: UpdateEvent[]): void {
    const ins = this.db.prepare("INSERT INTO updates (kind, at, uid, course_id, title, before, after) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const u of updates) ins.run(u.kind, u.at, u.uid, u.courseId, u.title, u.before, u.after);
  }
  listUpdates(limit = 200): (UpdateEvent & { id: number })[] {
    const rows = this.db.prepare("SELECT * FROM updates ORDER BY at DESC, id DESC LIMIT ?").all(limit) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: Number(r.id),
      kind: r.kind as UpdateEvent["kind"],
      at: String(r.at),
      uid: (r.uid as string | null) ?? null,
      courseId: (r.course_id as string | null) ?? null,
      title: String(r.title),
      before: (r.before as string | null) ?? null,
      after: (r.after as string | null) ?? null,
    }));
  }
}

function toItem(r: Record<string, unknown>): StoredItem {
  return {
    uid: String(r.uid),
    kind: r.kind as StoredItem["kind"],
    title: String(r.title),
    courseId: (r.course_id as string | null) ?? null,
    start: String(r.start),
    end: (r.end as string | null) ?? null,
    allDay: !!r.all_day,
    url: (r.url as string | null) ?? null,
    firstSeen: String(r.first_seen),
    doneAt: (r.done_at as string | null) ?? null,
    estimateOverride: r.estimate_override == null ? null : Number(r.estimate_override),
    removedAt: (r.removed_at as string | null) ?? null,
  };
}

let store: Store | null = null;

/** The app-wide store. */
export function getStore(): Store {
  store ??= new Store(process.env.TERMWISE_DB ?? join(process.cwd(), "data", "termwise.db"));
  return store;
}
