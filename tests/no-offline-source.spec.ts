import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * This branch has one data source: the API. An offline fixture is not a fallback here, it is a
 * second answer to the same question -- and the one nobody re-reads is the one that drifts, so a
 * page can end up showing a number the server never counted. These rules keep a fixture from
 * coming back through a convenient copy of some records.
 */
const srcRoot = path.resolve(fileURLToPath(import.meta.url), "../../src");
const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|vue)$/.test(entry.name) ? [full] : [];
  });

describe("the api is the only data source", () => {
  it("finds the files it is meant to be checking", () => {
    // Guards the scan itself: a moved src directory would make every rule below pass by reading
    // nothing.
    const files = sourceFiles(srcRoot);
    expect(files.length).toBeGreaterThan(40);
    expect(files.some((file) => file.endsWith(`${path.sep}reports.ts`))).toBe(true);
  });

  it("keeps no offline fixture directory", () => {
    expect(fs.existsSync(path.join(srcRoot, "data"))).toBe(false);
  });

  it("carries no switch back to it", () => {
    for (const file of sourceFiles(srcRoot)) {
      const source = fs.readFileSync(file, "utf8");
      expect(source, `${file} still reads a mock switch`).not.toMatch(/\buseMock\b|VITE_USE_MOCK/);
      expect(source, `${file} still imports offline data`).not.toMatch(/["']@\/data/);
    }
  });
});
