import { addDays, dayKey, itemDay, parseDay, startOfWeek } from "../lib/dates";
import type { Course, CourseGrades, FeedItem, GradeEntry, ParsedFeed, SyllabusInfo, Weekday } from "../lib/types";
import type { Store } from "../server/db";
import { gradesKey, syllabusKey } from "../server/model";

/**
 * A believable fake semester, built relative to today so the demo always looks
 * "mid-semester": five courses, weekly work, exams, grades, and a few changes
 * in the Updates feed. Deterministic (seeded RNG) so screenshots are stable.
 */

interface Recurring {
  title: (n: number) => string;
  /** Week offsets (0 = first week of the semester) this item is due. */
  weeks: number[];
  /** 0 = Mon … 6 = Sun. */
  dow: number;
  /** Local due time "HH:MM"; null = all-day. */
  time: string | null;
  category: string;
  points: number;
}

interface DemoCourse {
  course: Course;
  canvasId: number;
  work: Recurring[];
  /** Exams that come from the syllabus only. [title, week, dow, time, type] */
  exams: [string, number, number, string, "midterm" | "final" | "quiz"][];
  syllabus: Omit<SyllabusInfo, "exams">;
}

const range = (a: number, b: number, step = 1) => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step);
const d = (days: Weekday[], start: string, end: string, location: string | null, kind: "lecture" | "lab" | "section" = "lecture") => ({ days, start, end, location, kind });

const COURSES: DemoCourse[] = [
  {
    course: { id: "41201", label: "FIN_320_1_FA26", name: "FIN 320", colorIndex: 0 },
    canvasId: 41201,
    work: [
      { title: (n) => `Problem Set ${n}`, weeks: range(1, 14), dow: 3, time: "23:59", category: "Problem Sets", points: 20 },
      { title: (n) => `Case Memo ${n}: ${["Valuing Tesla", "Capital Structure at Apple", "The Disney–Fox Deal"][n - 1]}`, weeks: [4, 9, 13], dow: 6, time: "23:59", category: "Case Memos", points: 50 },
    ],
    exams: [
      ["Midterm Exam", 7, 1, "10:00", "midterm"],
      ["Final Exam", 15, 2, "15:00", "final"],
    ],
    syllabus: {
      courseTitle: "Corporate Finance",
      instructor: "Prof. Dana Whitfield",
      meetings: [d(["Tue", "Thu"], "10:00", "11:15", "Goizueta 210")],
      officeHours: [{ who: "Prof. Whitfield", days: ["Wed"], start: "14:00", end: "15:30", location: "Goizueta 418" }],
      categories: [
        { name: "Problem Sets", weight: 20, dropLowest: 1 },
        { name: "Case Memos", weight: 25, dropLowest: 0 },
        { name: "Midterm Exam", weight: 25, dropLowest: 0 },
        { name: "Final Exam", weight: 30, dropLowest: 0 },
      ],
      letterScale: null,
      latePolicy: "Problem sets lose 10% per day late; case memos are not accepted late.",
      notes: ["Lowest problem set is dropped.", "Final exam is cumulative.", "Financial calculator allowed on exams."],
    },
  },
  {
    course: { id: "39877", label: "CS_170_2_FA26", name: "CS 170", colorIndex: 1 },
    canvasId: 39877,
    work: [
      { title: (n) => `Lab ${n}`, weeks: range(1, 14), dow: 4, time: "09:00", category: "Labs", points: 10 },
      { title: (n) => `Project ${n}: ${["Text Adventure", "Image Filters", "Search Engine"][n - 1]}`, weeks: [5, 10, 14], dow: 0, time: "23:59", category: "Projects", points: 100 },
    ],
    exams: [
      ["Midterm", 8, 2, "18:00", "midterm"],
      ["Final Exam", 15, 4, "08:30", "final"],
    ],
    syllabus: {
      courseTitle: "Introduction to Computer Science I",
      instructor: "Dr. Priya Raman",
      meetings: [d(["Mon", "Wed", "Fri"], "13:00", "13:50", "MSC E208"), d(["Thu"], "16:00", "17:15", "MSC W301", "lab")],
      officeHours: [
        { who: "Dr. Raman", days: ["Mon"], start: "15:00", end: "16:30", location: "MSC W412" },
        { who: "TA office hours", days: ["Tue", "Thu"], start: "19:00", end: "21:00", location: "MSC N306" },
      ],
      categories: [
        { name: "Labs", weight: 20, dropLowest: 2 },
        { name: "Projects", weight: 35, dropLowest: 0 },
        { name: "Midterm", weight: 20, dropLowest: 0 },
        { name: "Final Exam", weight: 25, dropLowest: 0 },
      ],
      letterScale: null,
      latePolicy: "Five free late days for projects across the semester.",
      notes: ["Two lowest labs are dropped.", "Projects must pass the autograder to be graded."],
    },
  },
  {
    course: { id: "40415", label: "ECON_201_1_FA26", name: "ECON 201", colorIndex: 2 },
    canvasId: 40415,
    work: [
      { title: (n) => `Problem Set ${n}`, weeks: range(2, 14, 2), dow: 4, time: "17:00", category: "Problem Sets", points: 25 },
      { title: (n) => `Quiz ${n}`, weeks: range(1, 13, 2), dow: 2, time: "23:59", category: "Quizzes", points: 10 },
    ],
    exams: [
      ["Midterm 1", 5, 3, "11:30", "midterm"],
      ["Midterm 2", 11, 3, "11:30", "midterm"],
      ["Final Exam", 15, 1, "11:30", "final"],
    ],
    syllabus: {
      courseTitle: "Intermediate Microeconomics",
      instructor: "Prof. Marcus Hale",
      meetings: [d(["Tue", "Thu"], "11:30", "12:45", "Rich 104")],
      officeHours: [{ who: "Prof. Hale", days: ["Thu"], start: "13:30", end: "15:00", location: "Rich 316" }],
      categories: [
        { name: "Problem Sets", weight: 15, dropLowest: 0 },
        { name: "Quizzes", weight: 10, dropLowest: 1 },
        { name: "Midterm 1", weight: 20, dropLowest: 0 },
        { name: "Midterm 2", weight: 20, dropLowest: 0 },
        { name: "Final Exam", weight: 35, dropLowest: 0 },
      ],
      letterScale: null,
      latePolicy: "No late problem sets; the lowest quiz is dropped instead.",
      notes: ["If your final beats your lower midterm, it replaces it.", "Online quizzes are open-note, 20 minutes."],
    },
  },
  {
    course: { id: "40988", label: "CHEM_221_3_FA26", name: "CHEM 221", colorIndex: 3 },
    canvasId: 40988,
    work: [
      { title: (n) => `Chapter ${n + 2} Reading`, weeks: range(0, 13), dow: 0, time: "08:00", category: "Participation", points: 2 },
      { title: (n) => `Lab Report ${n}`, weeks: range(2, 14, 2), dow: 2, time: "23:59", category: "Lab Reports", points: 30 },
    ],
    exams: [
      ["Exam 1", 4, 4, "09:00", "midterm"],
      ["Exam 2", 9, 4, "09:00", "midterm"],
      ["Final Exam", 15, 0, "08:30", "final"],
    ],
    syllabus: {
      courseTitle: "Organic Chemistry I",
      instructor: "Dr. Elena Sorokina",
      meetings: [d(["Mon", "Wed", "Fri"], "09:00", "09:50", "Atwood 240"), d(["Tue"], "13:00", "16:00", "Atwood 160", "lab")],
      officeHours: [{ who: "Dr. Sorokina", days: ["Mon", "Wed"], start: "10:00", end: "11:00", location: "Atwood 455" }],
      categories: [
        { name: "Participation", weight: 5, dropLowest: 0 },
        { name: "Lab Reports", weight: 20, dropLowest: 0 },
        { name: "Exam 1", weight: 20, dropLowest: 0 },
        { name: "Exam 2", weight: 20, dropLowest: 0 },
        { name: "Final Exam", weight: 35, dropLowest: 0 },
      ],
      letterScale: [
        { letter: "A", min: 90 }, { letter: "A-", min: 87 }, { letter: "B+", min: 84 }, { letter: "B", min: 80 }, { letter: "B-", min: 77 },
        { letter: "C+", min: 74 }, { letter: "C", min: 70 }, { letter: "C-", min: 67 }, { letter: "D", min: 60 }, { letter: "F", min: 0 },
      ],
      latePolicy: "Lab reports lose 5 points per day late.",
      notes: ["Model kits are allowed on exams.", "Class is curved so the median is at least a B-."],
    },
  },
  {
    course: { id: "41552", label: "ENG_181_7_FA26", name: "ENG 181", colorIndex: 4 },
    canvasId: 41552,
    work: [
      { title: (n) => `Discussion Post ${n}`, weeks: range(1, 14), dow: 1, time: "23:59", category: "Discussion", points: 5 },
      { title: (n) => `Discussion Reply ${n}`, weeks: range(1, 14), dow: 3, time: "23:59", category: "Discussion", points: 2 },
      { title: (n) => `Essay ${n}${n === 3 ? ": Research Paper" : ""}`, weeks: [4, 8, 13], dow: 4, time: "23:59", category: "Essays", points: 100 },
      { title: () => "Final Portfolio", weeks: [15], dow: 2, time: "23:59", category: "Portfolio", points: 100 },
    ],
    exams: [],
    syllabus: {
      courseTitle: "Writing About Technology",
      instructor: "Prof. Hannah Okafor",
      meetings: [d(["Mon", "Wed"], "14:30", "15:45", "Callaway N106")],
      officeHours: [{ who: "Prof. Okafor", days: ["Wed"], start: "16:00", end: "17:00", location: "Callaway N302" }],
      categories: [
        { name: "Discussion", weight: 15, dropLowest: 2 },
        { name: "Essays", weight: 60, dropLowest: 0 },
        { name: "Portfolio", weight: 25, dropLowest: 0 },
      ],
      letterScale: null,
      latePolicy: "Essays can be turned in up to 48 hours late with a one-step grade penalty.",
      notes: ["Each essay needs a draft conference before the final version."],
    },
  },
];

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function at(day: string, time: string | null): { start: string; allDay: boolean } {
  if (!time) return { start: day, allDay: true };
  const [h, m] = time.split(":").map(Number);
  const dt = parseDay(day);
  dt.setHours(h!, m!, 0, 0);
  return { start: dt.toISOString(), allDay: false };
}

export interface DemoSemester {
  start: string;
  end: string;
}

/** The demo semester: started 9 weeks before this week, 16 weeks long. */
export function demoSemester(now: Date): DemoSemester {
  const start = addDays(startOfWeek(dayKey(now)), -9 * 7);
  return { start, end: addDays(start, 16 * 7 - 3) };
}

interface Built {
  feed: ParsedFeed;
  /** item uid → [category, points] */
  meta: Map<string, [string, number]>;
}

function buildFeed(sem: DemoSemester): Built {
  const items: FeedItem[] = [];
  const meta = new Map<string, [string, number]>();
  let id = 100;
  for (const c of COURSES) {
    for (const w of c.work) {
      w.weeks.forEach((week, i) => {
        const day = addDays(sem.start, week * 7 + w.dow);
        const { start, allDay } = at(day, w.time);
        const aid = c.canvasId * 1000 + id++;
        const uid = `event-assignment-${aid}`;
        items.push({
          uid,
          kind: "assignment",
          title: w.title(i + 1),
          courseId: c.course.id,
          start,
          end: allDay ? null : start,
          allDay,
          url: `https://canvas.example.edu/courses/${c.canvasId}/assignments/${aid}`,
        });
        meta.set(uid, [w.category, w.points]);
      });
    }
  }
  items.sort((a, b) => a.start.localeCompare(b.start));
  return { feed: { courses: COURSES.map((c) => c.course), items }, meta };
}

/** Wipe `store` and fill it with the demo semester as of `now`. */
export function seedDemo(store: Store, now = new Date()): void {
  const random = rng(20261022);
  const sem = demoSemester(now);
  store.db.exec("DELETE FROM items; DELETE FROM courses; DELETE FROM updates; DELETE FROM docs; DELETE FROM settings;");

  // Baseline feed (as of four days ago), then today's feed with a few real-world changes.
  const { feed, meta } = buildFeed(sem);
  store.applyFeed(feed, new Date(now.getTime() - 4 * 86_400_000));

  const today = dayKey(now);
  const upcoming = feed.items.filter((i) => itemDay(i) >= today);
  const changed: FeedItem[] = feed.items.map((i) => ({ ...i }));
  const moved = changed.find((i) => i.uid === upcoming.find((u) => u.title.startsWith("Problem Set") && u.courseId === "40415")?.uid);
  if (moved) moved.start = at(addDays(itemDay(moved), -1), "23:59").start; // ECON PS moved a day earlier
  const renamed = changed.find((i) => i.uid === upcoming.find((u) => u.title.startsWith("Lab ") && u.courseId === "39877")?.uid);
  if (renamed) renamed.title = `${renamed.title}: Recursion`;
  const extraDay = addDays(today, 6);
  changed.push({
    uid: "event-assignment-41201999",
    kind: "assignment",
    title: "Excel Modeling Exercise",
    courseId: "41201",
    ...at(extraDay, "23:59"),
    end: null,
    url: "https://canvas.example.edu/courses/41201/assignments/41201999",
  });
  meta.set("event-assignment-41201999", ["Problem Sets", 10]);
  store.applyFeed({ courses: feed.courses, items: changed }, new Date(now.getTime() - 20 * 3_600_000));

  // Mark past work as done (a day or two early, mostly) and leave a couple overdue.
  const items = store.listItems();
  const past = items.filter((i) => new Date(i.start) < now);
  past.forEach((i, n) => {
    if (n === past.length - 3) return; // one overdue item
    const due = new Date(i.allDay ? `${i.start}T23:59:00` : i.start);
    const early = Math.floor(random() * 3);
    const doneAt = new Date(due.getTime() - early * 86_400_000 - 2 * 3_600_000);
    store.setDone(i.uid, true, doneAt < now ? doneAt : now);
  });

  for (const c of COURSES) {
    // Syllabus, with exam dates resolved against this semester.
    const exams = c.exams.map(([title, week, dow, time, type]) => ({
      title,
      date: addDays(sem.start, week * 7 + dow),
      time,
      type,
      location: c.syllabus.meetings[0]?.location ?? null,
    }));
    store.setDoc(syllabusKey(c.course.id), { ...c.syllabus, exams } satisfies SyllabusInfo, now);

    // Grades: past work graded, recent work still waiting, exams graded once they've happened.
    const entries: GradeEntry[] = [];
    const strength = 0.8 + random() * 0.15;
    for (const i of items.filter((x) => x.courseId === c.course.id)) {
      const [category, points] = meta.get(i.uid) ?? ["Other", 10];
      const due = new Date(i.allDay ? `${i.start}T23:59:00` : i.start);
      const daysAgo = (now.getTime() - due.getTime()) / 86_400_000;
      const graded = daysAgo > 3;
      const pct = Math.min(1, strength + (random() - 0.4) * 0.25);
      entries.push({
        name: i.title,
        category,
        score: graded ? Math.round(points * pct * 2) / 2 : null,
        outOf: points,
        status: graded ? "graded" : "ungraded",
      });
    }
    for (const e of exams) {
      const happened = e.date < addDays(today, -3);
      entries.push({
        name: e.title,
        category: e.title,
        score: happened ? Math.round(100 * Math.min(0.98, strength + (random() - 0.5) * 0.2)) : null,
        outOf: 100,
        status: happened ? "graded" : "ungraded",
      });
    }
    const weights = c.syllabus.categories.map((x) => ({ name: x.name, weight: x.weight }));
    // An older paste (missing the two most recent grades) so the Updates feed shows newly posted grades.
    const gradedIdx = entries.map((e, i) => (e.status === "graded" ? i : -1)).filter((i) => i >= 0);
    const recent = new Set(gradedIdx.slice(-2));
    const older: CourseGrades = {
      pastedAt: new Date(now.getTime() - 6 * 86_400_000).toISOString(),
      canvasTotal: null,
      canvasWeights: weights,
      entries: entries.map((e, i) => (recent.has(i) ? { ...e, score: null, status: "ungraded" } : e)),
    };
    store.setDoc(gradesKey(c.course.id), older, now);
    const latest: CourseGrades = { pastedAt: new Date(now.getTime() - 5 * 3_600_000).toISOString(), canvasTotal: null, canvasWeights: weights, entries };
    store.setDoc(gradesKey(c.course.id), latest, now);
    const newlyPosted = [...recent].map((i) => entries[i]!);
    store.addUpdates(
      newlyPosted.map((e) => ({
        kind: "grade-posted" as const,
        at: latest.pastedAt,
        uid: null,
        courseId: c.course.id,
        title: e.name,
        before: null,
        after: `${e.score}/${e.outOf}`,
      })),
    );
  }

  store.setSetting("semesterStart", sem.start);
  store.setSetting("semesterEnd", sem.end);
  store.setSetting("setupDone", "1");
  store.setSetting("lastSeenAt", new Date(now.getTime() - 2 * 86_400_000).toISOString());
  store.setSetting("demoSeededFor", today);
}
