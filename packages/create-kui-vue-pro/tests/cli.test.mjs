import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "../bin/create-kui-vue-pro.mjs");

test("creates from Git, supports refs, preserves dependencies and protects existing files", () => {
  const root = mkdtempSync(resolve(tmpdir(), "kui-cli-test-"));
  try {
    const repo = resolve(root, "repository");
    mkdirSync(repo);
    function git(...args) {
      const result = spawnSync("git", args, { cwd: repo, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    }
    function file(path, value) {
      const destination = resolve(repo, path);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, value);
    }
    git("init");
    file(
      "package.json",
      JSON.stringify({
        name: "source",
        scripts: { dev: "vite" },
        dependencies: { "kui-vue": "^6.2.2" },
      }),
    );
    file("src/main.ts", "// original");
    file(".gitignore", "node_modules\n");
    file(".env.example", "VITE_API_BASE_URL=/api");
    file(".env.local", "fake-secret-for-test");
    file("packages/create-kui-vue-pro/package.json", "{}");
    file(".github/workflows/publish.yml", "name: publish");
    file("pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
    git("add", ".");
    git("-c", "user.name=CLI test", "-c", "user.email=cli@example.test", "commit", "-m", "fixture");
    git("tag", "v-test");
    file("src/main.ts", "// latest");
    git("add", ".");
    git("-c", "user.name=CLI test", "-c", "user.email=cli@example.test", "commit", "-m", "latest");
    const run = (...args) =>
      spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8" });
    const source = pathToFileURL(repo).href;
    let result = run("my-app", "--repo", source);
    assert.equal(result.status, 0, result.stderr);
    const app = resolve(root, "my-app");
    assert.equal(readFileSync(resolve(app, "src/main.ts"), "utf8"), "// latest");
    const pkg = JSON.parse(readFileSync(resolve(app, "package.json"), "utf8"));
    assert.equal(pkg.name, "my-app");
    assert.equal(pkg.private, true);
    assert.equal(pkg.dependencies["kui-vue"], "^6.2.2");
    for (const path of [".git", ".github", "packages", ".env.local"])
      assert.equal(existsSync(resolve(app, path)), false);
    for (const path of [".gitignore", ".env.example", "pnpm-lock.yaml"])
      assert.equal(existsSync(resolve(app, path)), true);
    result = run("tag-app", "--repo", source, "--ref", "v-test");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(resolve(root, "tag-app/src/main.ts"), "utf8"), "// original");
    assert.notEqual(run("my-app", "--repo", source).status, 0);
    assert.equal(readFileSync(resolve(app, "src/main.ts"), "utf8"), "// latest");
    assert.notEqual(run("failed", "--repo", source, "--ref", "missing-ref").status, 0);
    assert.equal(existsSync(resolve(root, "failed")), false);
    assert.notEqual(run("bad", "--ref").status, 0);
    assert.notEqual(run("bad", "--unknown").status, 0);
    assert.equal(run("--help").status, 0);
    assert.equal(run("--version").status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
