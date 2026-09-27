import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const sources = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sources(filename)
      : /\.(vue|less|css|ts)$/.test(filename) ? [filename] : [];
  });

it("resolves required theme variables against the installed KUI styles", () => {
  const files = sources(path.join(root, "src"));
  const contents = files.map((filename) => fs.readFileSync(filename, "utf8"));
  const library = fs.readFileSync(require.resolve("kui-vue/style/index.css"), "utf8");
  const definitions = new Set(
    [...[library, ...contents].join("\n").matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]),
  );
  const unresolved = contents.flatMap((source, index) =>
    [...source.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)]
      .filter((match) => !definitions.has(match[1]!))
      .map((match) => `${path.relative(root, files[index]!)}: ${match[1]}`),
  );
  expect(unresolved).toEqual([]);
});
