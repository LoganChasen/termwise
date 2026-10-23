import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { SyllabusInfo } from "../types";
import { AiError, explainAiError, getClient, MODEL } from "./client";

const Weekday = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
const Time = z.string().describe('24-hour "HH:MM"');

export const SyllabusSchema = z.object({
  courseTitle: z.string().nullable(),
  instructor: z.string().nullable(),
  meetings: z.array(
    z.object({
      days: z.array(Weekday),
      start: Time,
      end: Time,
      location: z.string().nullable(),
      kind: z.enum(["lecture", "lab", "section", "other"]),
    }),
  ),
  officeHours: z.array(
    z.object({ who: z.string(), days: z.array(Weekday), start: Time, end: Time, location: z.string().nullable() }),
  ),
  exams: z.array(
    z.object({
      title: z.string(),
      date: z.string().describe('"YYYY-MM-DD"'),
      time: Time.nullable(),
      type: z.enum(["midterm", "final", "quiz", "other"]),
      location: z.string().nullable(),
    }),
  ),
  categories: z.array(
    z.object({
      name: z.string(),
      weight: z.number().describe("percent of the final grade, 0-100"),
      dropLowest: z.number().describe("number of lowest scores dropped, 0 if none"),
    }),
  ),
  letterScale: z.array(z.object({ letter: z.string(), min: z.number() })).nullable(),
  latePolicy: z.string().nullable(),
  notes: z.array(z.string()),
});

const SYSTEM = `You extract structured facts from a college course syllabus for a student's personal planner.

Rules:
- Only report what the syllabus states. Never invent dates, weights, or times. Use null or an empty list when something isn't stated.
- exams: every midterm, final, and in-class test or quiz that has a specific calendar date. Resolve dates to "YYYY-MM-DD" using the semester dates you're given. If an exam has only a week number or "TBA", leave it out of exams and mention it in notes.
- categories: the grade breakdown, with weights as percents of the final grade. Include drop-lowest rules ("lowest quiz dropped" means dropLowest 1). If the syllabus uses points instead of percents, convert to percents of the total.
- letterScale: only if the syllabus gives its own letter cutoffs; otherwise null.
- meetings: regular class meetings (lecture, lab, discussion section) with days and 24-hour times.
- officeHours: instructor and TA office hours with days, times, and place.
- latePolicy: one or two plain sentences.
- notes: up to 6 short rules a student would want to remember (attendance, extra credit, curve, regrade windows, exams without dates).`;

export interface SyllabusInput {
  /** PDF bytes, or plain text (from a .txt file or pasted). */
  file: { kind: "pdf"; data: Buffer } | { kind: "text"; text: string };
  courseName: string;
  semester: { start: string; end: string };
}

/** Read a syllabus with the Claude API. The result goes to a review screen before it's saved. */
export async function extractSyllabus(input: SyllabusInput): Promise<SyllabusInfo> {
  const docBlock: Anthropic.Beta.BetaContentBlockParam =
    input.file.kind === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: input.file.data.toString("base64") } }
      : { type: "document", source: { type: "text", media_type: "text/plain", data: input.file.text } };

  try {
    const response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(SyllabusSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            docBlock,
            {
              type: "text",
              text: `Course: ${input.courseName}\nSemester runs ${input.semester.start} to ${input.semester.end}.\nExtract the syllabus facts.`,
            },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") throw new AiError("Claude couldn't process this file. Try a different copy of the syllabus.");
    if (response.stop_reason === "max_tokens") throw new AiError("This syllabus was too long to read in one go.");
    const parsed = response.parsed_output;
    if (!parsed) throw new AiError("Couldn't read the syllabus. Try again, or fill the details in by hand.");
    return clean(parsed);
  } catch (e) {
    throw explainAiError(e);
  }
}

/** Drop obviously malformed rows rather than failing the whole extraction. */
export function clean(s: z.infer<typeof SyllabusSchema>): SyllabusInfo {
  const isTime = (t: string | null) => t === null || /^\d{2}:\d{2}$/.test(t);
  const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  return {
    ...s,
    meetings: s.meetings.filter((m) => m.days.length > 0 && isTime(m.start) && isTime(m.end)),
    officeHours: s.officeHours.filter((o) => o.days.length > 0 && isTime(o.start) && isTime(o.end)),
    exams: s.exams.filter((e) => isDate(e.date) && isTime(e.time)).sort((a, b) => a.date.localeCompare(b.date)),
    categories: s.categories
      .filter((c) => c.name.trim() && c.weight >= 0 && c.weight <= 100)
      .map((c) => ({ ...c, dropLowest: Math.max(0, Math.round(c.dropLowest)) })),
    notes: s.notes.slice(0, 6),
  };
}
