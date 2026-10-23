import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { CourseGrades } from "../types";
import { AiError, explainAiError, getClient, MODEL } from "./client";

export const GradesSchema = z.object({
  canvasTotal: z.number().nullable().describe("the overall total percent Canvas shows, or null"),
  entries: z.array(
    z.object({
      name: z.string(),
      category: z.string().nullable().describe("assignment group, e.g. Problem Sets"),
      score: z.number().nullable(),
      outOf: z.number().nullable(),
      status: z.enum(["graded", "missing", "excused", "ungraded"]),
    }),
  ),
  canvasWeights: z.array(z.object({ name: z.string(), weight: z.number() })),
});

const SYSTEM = `You convert text copied from a student's Canvas "Grades" page into structured rows.

Rules:
- One entry per assignment row. Copy names exactly.
- score/outOf are points ("8 / 10" means score 8, outOf 10). A dash, blank, or "-" score means status "ungraded" with score null.
- status "missing" when Canvas marks it Missing; "excused" when marked Excused (EX); "graded" when a score is shown.
- category is the assignment group shown for the row, if any.
- canvasWeights: the "Assignments are weighted by group" table, if present (group name and percent). Skip the Total row.
- canvasTotal: the Total percentage, if shown.
- Ignore page chrome, menus, and anything that isn't a grade.`;

/** Parse a Canvas Grades page paste with the Claude API. */
export async function parseGradesPaste(text: string, now = new Date()): Promise<CourseGrades> {
  if (text.trim().length < 20) throw new AiError("That paste looks empty. Select everything on the Canvas Grades page (Cmd+A), copy, and paste again.");
  try {
    const response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(GradesSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: `<grades_page>\n${text}\n</grades_page>` }],
    });
    if (response.stop_reason === "refusal") throw new AiError("Claude couldn't process that paste.");
    if (response.stop_reason === "max_tokens") throw new AiError("That paste was too long. Paste one course's Grades page at a time.");
    const parsed = response.parsed_output;
    if (!parsed) throw new AiError("Couldn't read the grades. Make sure you copied the Canvas Grades page.");
    return { pastedAt: now.toISOString(), ...parsed };
  } catch (e) {
    throw explainAiError(e);
  }
}
