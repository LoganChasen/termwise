import { describe, expect, it } from "vitest";
import { countdown, dueLabel, formatClock, formatDays, formatHours, relativeDay, weekLabel } from "../src/lib/format";

const now = new Date("2026-10-22T15:00:00"); // Thu, New York

describe("format", () => {
  it("relative days", () => {
    expect(relativeDay("2026-10-22", now)).toBe("Today");
    expect(relativeDay("2026-10-23", now)).toBe("Tomorrow");
    expect(relativeDay("2026-10-26", now)).toBe("Mon");
    expect(relativeDay("2026-11-05", now)).toBe("Nov 5");
  });
  it("due labels and countdowns", () => {
    expect(dueLabel({ start: "2026-10-23T03:59:00.000Z", allDay: false, day: "2026-10-22" }, now)).toBe("Today 11:59pm");
    expect(dueLabel({ start: "2026-10-30", allDay: true, day: "2026-10-30" }, now)).toBe("Oct 30");
    expect(countdown(now.getTime() + 3 * 3_600_000, now)).toBe("in 3h");
    expect(countdown(now.getTime() - 3 * 86_400_000, now)).toBe("3d ago");
  });
  it("hours, clocks, days, weeks", () => {
    expect([0, 0.5, 1, 2.25, 3.7].map(formatHours)).toEqual(["0h", "30m", "1h", "2.5h", "3.5h"]);
    expect(formatClock("14:30")).toBe("2:30pm");
    expect(formatClock("09:00")).toBe("9am");
    expect(formatDays(["Mon", "Wed", "Fri"])).toBe("Mon, Wed & Fri");
    expect(weekLabel("2026-10-19")).toBe("Oct 19 – 25");
    expect(weekLabel("2026-10-26")).toBe("Oct 26 – Nov 1");
  });
});
