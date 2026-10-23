"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { parseGradesPaste } from "@/lib/ai/gradesPaste";
import { extractSyllabus } from "@/lib/ai/syllabus";
import { diffGrades } from "@/lib/diff";
import { parseFeed } from "@/lib/ics";
import type { CourseGrades, SyllabusInfo } from "@/lib/types";
import { gradesKey, syllabusKey } from "@/server/model";
import { currentStore, DEMO_COOKIE } from "@/server/mode";
import { feedUrl, FeedError, syncFeed } from "@/server/sync";

/**
 * Server actions: every write the UI makes goes through here.
 * Each returns { ok: true, ... } or { ok: false, error } with a message fit to show.
 */
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function done() {
  revalidatePath("/", "layout");
}

function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
}

export async function syncNow(): Promise<Result<{ changes: number }>> {
  const { store, mode } = await currentStore();
  if (mode === "demo") return { ok: true, changes: 0 };
  try {
    const updates = await syncFeed({ force: true, store });
    done();
    return { ok: true, changes: updates?.length ?? 0 };
  } catch (e) {
    return fail(e);
  }
}

/** Background refresh on page load: only fetches if the last sync is stale. */
export async function syncIfStale(): Promise<Result<{ changes: number }>> {
  const { store, mode } = await currentStore();
  if (mode === "demo" || !feedUrl(store)) return { ok: true, changes: 0 };
  try {
    const updates = await syncFeed({ store });
    if (updates) done();
    return { ok: true, changes: updates?.length ?? 0 };
  } catch (e) {
    return fail(e);
  }
}

export async function setDone(uid: string, isDone: boolean): Promise<Result> {
  const { store } = await currentStore();
  store.setDone(uid, isDone);
  done();
  return { ok: true };
}

export async function setEstimate(uid: string, hours: number | null): Promise<Result> {
  if (hours !== null && (!Number.isFinite(hours) || hours < 0 || hours > 100)) return { ok: false, error: "Hours must be between 0 and 100." };
  const { store } = await currentStore();
  store.setEstimate(uid, hours);
  done();
  return { ok: true };
}

/** Called when the Updates page is opened, so "new since last visit" resets next time. */
export async function markSeen(): Promise<Result> {
  const { store } = await currentStore();
  store.setSetting("lastSeenAt", new Date().toISOString());
  return { ok: true };
}

export async function setDemo(on: boolean): Promise<Result> {
  const jar = await cookies();
  if (on) jar.set(DEMO_COOKIE, "1", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  else jar.delete(DEMO_COOKIE);
  done();
  return { ok: true };
}

export async function updateCourse(id: string, patch: { name?: string; hidden?: boolean; colorIndex?: number }): Promise<Result> {
  const { store } = await currentStore();
  if (patch.name !== undefined && !patch.name.trim()) return { ok: false, error: "Course name can't be empty." };
  store.updateCourse(id, { ...patch, name: patch.name?.trim() });
  done();
  return { ok: true };
}

// ---------- Setup ----------

/** Check a calendar feed link and save it. Returns the courses found. */
export async function connectFeed(url: string): Promise<Result<{ courses: number; items: number }>> {
  const { store, mode } = await currentStore();
  if (mode === "demo") return { ok: false, error: "Turn off demo mode to connect your own calendar." };
  const clean = url.trim().replace(/^webcal:\/\//i, "https://");
  if (!/^https:\/\/[^ ]+\.ics(\?|$)|^https:\/\/[^ ]+\/feeds\/calendars\//i.test(clean)) {
    return { ok: false, error: "That doesn't look like a Canvas calendar feed link. It should end in .ics." };
  }
  try {
    const res = await fetch(clean, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return { ok: false, error: `Canvas answered ${res.status}. Copy the Calendar Feed link again.` };
    const feed = parseFeed(await res.text());
    store.setSetting("feedUrl", clean);
    store.applyFeed(feed);
    done();
    return { ok: true, courses: feed.courses.length, items: feed.items.length };
  } catch (e) {
    return fail(e instanceof FeedError ? e : new Error("Couldn't load that link. Check it and your internet connection."));
  }
}

export async function saveSemester(start: string, end: string): Promise<Result> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end <= start) {
    return { ok: false, error: "Pick a start date before the end date." };
  }
  const { store } = await currentStore();
  store.setSetting("semesterStart", start);
  store.setSetting("semesterEnd", end);
  done();
  return { ok: true };
}

export async function finishSetup(): Promise<Result> {
  const { store } = await currentStore();
  store.setSetting("setupDone", "1");
  done();
  return { ok: true };
}

/** Read an uploaded syllabus (PDF or .txt) with Claude. Nothing is saved until saveSyllabus. */
export async function readSyllabus(form: FormData): Promise<Result<{ info: SyllabusInfo }>> {
  const file = form.get("file");
  const courseId = String(form.get("courseId") ?? "");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a syllabus file first." };
  if (file.size > 25 * 1024 * 1024) return { ok: false, error: "That file is over 25 MB. Try a smaller PDF." };
  const { store } = await currentStore();
  const course = store.listCourses().find((c) => c.id === courseId);
  if (!course) return { ok: false, error: "Unknown course." };
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isText = file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name);
  if (!isPdf && !isText) return { ok: false, error: "Upload a PDF or a .txt file. (In Word or Google Docs: File → Download → PDF.)" };
  const data = Buffer.from(await file.arrayBuffer());
  const semester = { start: store.getSetting("semesterStart") ?? "", end: store.getSetting("semesterEnd") ?? "" };
  try {
    const info = await extractSyllabus({
      file: isPdf ? { kind: "pdf", data } : { kind: "text", text: data.toString("utf8") },
      courseName: course.name,
      semester,
    });
    return { ok: true, info };
  } catch (e) {
    return fail(e);
  }
}

export async function saveSyllabus(courseId: string, info: SyllabusInfo): Promise<Result> {
  const { store } = await currentStore();
  store.setDoc(syllabusKey(courseId), info);
  done();
  return { ok: true };
}

/** Parse a Canvas Grades page paste with Claude, record newly posted grades, and save. */
export async function saveGradesPaste(courseId: string, text: string): Promise<Result<{ entries: number; posted: number }>> {
  const { store, mode } = await currentStore();
  if (mode === "demo") return { ok: false, error: "Grade pastes are turned off in demo mode." };
  try {
    const next = await parseGradesPaste(text);
    const prev = store.getDoc<CourseGrades>(gradesKey(courseId));
    const updates = diffGrades(prev, next, courseId, new Date());
    store.setDoc(gradesKey(courseId), next);
    store.addUpdates(updates);
    done();
    return { ok: true, entries: next.entries.length, posted: updates.length };
  } catch (e) {
    return fail(e);
  }
}
