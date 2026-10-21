import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatDateTime, formatMoney, joinParts, shortId } from "@/utils/common";

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

// Every screen that shows money got its figures from the same two-decimal strings the API sends,
// and six of them grouped them with a page-local helper — `"...".toLocaleString()` being the bug
// they all carried. These cases pin the one helper that replaced them, and the scan under them
// fails if a page goes back to its own copy.
describe("money formatting", () => {
  it("groups the thousands the server left flat", () => {
    expect(formatMoney("12345.00")).toBe("12,345.00");
    expect(formatMoney("1234567.89")).toBe("1,234,567.89");
    expect(formatMoney("999999999999.99")).toBe("999,999,999,999.99");
  });
  it("keeps both decimals instead of rounding the amount into a count", () => {
    expect(formatMoney("0.50")).toBe("0.50");
    expect(formatMoney("10.10")).toBe("10.10");
    expect(formatMoney("0.00")).toBe("0.00");
    expect(formatMoney(12345)).toBe("12,345.00");
  });
  it("leaves the two states a cell can be in that are not amounts", () => {
    expect(formatMoney("")).toBe("");
    expect(formatMoney(null)).toBe("");
    expect(formatMoney(undefined)).toBe("");
    expect(formatMoney("—")).toBe("—");
  });
  it("holds the separator regardless of the operator's OS locale", () => {
    // The exact characters are what make the figure locale-independent: de-DE would print
    // 12.345,60 and fr-FR 12 345,60.
    expect(formatMoney("12345.6")).toBe("12,345.60");
    // Reading the helper's source is the only way to check the pin, because the test runner's own
    // locale may already be en-US — dropping the argument would print the same characters here.
    const helper =
      fs
        .readFileSync(
          path.resolve(fileURLToPath(import.meta.url), "../../src/utils/common.ts"),
          "utf8",
        )
        .match(/export function formatMoney[\s\S]*?\n}/)?.[0] ?? "";
    expect(helper).toContain('toLocaleString("en-US"');
  });
  it("is safe to apply twice", () => {
    expect(formatMoney(formatMoney("12345"))).toBe("12,345.00");
  });
});

// The pages are where the regression would happen, so the rule is read off their source: no page
// may convert a money field to a Number and call toLocaleString on it, and no page may keep a
// money helper of its own. A page that prints a yuan sign from its template has to go through the
// shared helper.
describe("pages use the one money helper", () => {
  const pagesRoot = path.resolve(fileURLToPath(import.meta.url), "../../src/pages");
  const vueFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return vueFiles(full);
      return entry.name.endsWith(".vue") ? [full] : [];
    });

  it("finds the screens it is meant to be checking", () => {
    // Guards the scan itself: a moved pages directory would otherwise make every rule below pass
    // by inspecting nothing.
    const files = vueFiles(pagesRoot);
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((file) => file.endsWith("customers.vue"))).toBe(true);
  });

  it("never re-implements the grouping a page-local helper got wrong", () => {
    for (const file of vueFiles(pagesRoot)) {
      const source = fs.readFileSync(file, "utf8");
      expect(source, `${file} converts to a Number and formats it itself`).not.toMatch(
        /Number\([^)]*\)\.toLocaleString\(/,
      );
      expect(source, `${file} keeps its own money helper`).not.toMatch(
        /\b(const|function)\s+money\s*[=(]/,
      );
    }
  });

  it("routes every yuan sign in a template through the shared helper", () => {
    for (const file of vueFiles(pagesRoot)) {
      const source = fs.readFileSync(file, "utf8");
      const template = source.slice(0, source.indexOf("<script"));
      const signed = template.split("\n").filter((line) => line.includes("¥"));
      if (!signed.length) continue;
      expect(source, `${file} prints amounts without formatMoney`).toMatch(
        /import\s*\{[^}]*\bformatMoney\b[^}]*\}\s*from\s*"@\/utils\/common"/,
      );
      for (const line of signed)
        expect(`${file}: ${line.trim()}`).toContain("formatMoney(");
    }
  });
});
