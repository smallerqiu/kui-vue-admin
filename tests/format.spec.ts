import { describe, expect, it } from "vitest";
import { formatDateTime, joinParts, shortId } from "@/utils/common";

// The server sends naive UTC with microseconds (`2026-10-20T08:59:02.975709`) and the
// screens have room for minute precision only. What these helpers must never do is move
// the instant: a list that shifted a created time into the viewer's zone would put it
// eight hours away from the last-seen time printed in the same row.
describe("list and detail formatting", () => {
  it("keeps the instant the server wrote and drops what no one reads", () => {
    expect(formatDateTime("2026-10-20T08:59:02.975709")).toBe("2026-10-20 08:59");
    expect(formatDateTime("2026-10-20 08:59:02")).toBe("2026-10-20 08:59");
  });
  it("passes through the shapes that are already short", () => {
    expect(formatDateTime("2026-09-28")).toBe("2026-09-28");
    expect(formatDateTime("")).toBe("");
    expect(formatDateTime(undefined)).toBe("—");
  });
  it("shows enough of a 32-character key to tell rows apart", () => {
    expect(shortId("9517957bdeac533ba390c77599562ae0")).toBe("9517957b");
    expect(shortId("p1")).toBe("p1");
  });
  it("does not leave a separator dangling over an empty field", () => {
    expect(joinParts("演示联系人", "")).toBe("演示联系人");
    expect(joinParts("演示联系人", "13900000000")).toBe("演示联系人 · 13900000000");
    expect(joinParts(null, undefined)).toBe("");
  });
});
