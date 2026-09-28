#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { spawnSync } from "node:child_process";
import process from "node:process";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultRepository = "https://github.com/smallerqiu/kui-vue-admin.git";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(
      `Usage: npm create kui-vue-pro@latest [project-name] [--ref branch-or-tag] [--repo git-url]\nRequires Git and repository access. Default: ${defaultRepository} (default branch).`,
    );
    return;
  }
  if (args.includes("--version") || args.includes("-v")) {
    console.log(JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")).version);
    return;
  }
  let target, ref;
  let repository = defaultRepository;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") continue;
    if (arg === "--ref" || arg === "--repo") {
      const value = args[++i];
      if (!value || value.startsWith("-")) throw new Error(`${arg} requires a value`);
      if (arg === "--ref") ref = value;
      else repository = value;
    } else if (arg.startsWith("-") || target) {
      throw new Error(`Unexpected argument: ${arg}`);
    } else target = arg;
  }
  if (!target) {
    if (!process.stdin.isTTY) throw new Error("Provide a project name in non-interactive mode");
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
      target = (await prompt.question("Project name: ")).trim() || "kui-pro-app";
    } finally {
      prompt.close();
    }
  }
  const targetDir = resolve(process.cwd(), target);
  const checkTarget = () => {
    if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
      throw new Error(`Cannot create project: ${targetDir} is not empty`);
    }
  };
  checkTarget();
  const temporary = mkdtempSync(resolve(tmpdir(), "create-kui-vue-pro-"));
  try {
    const checkout = resolve(temporary, "checkout");
    const cloneArgs = ["clone", "--depth", "1", "--single-branch"];
    if (ref) cloneArgs.push("--branch", ref);
    cloneArgs.push("--", repository, checkout);
    const result = spawnSync("git", cloneArgs, { stdio: "inherit" });
    if (result.error?.code === "ENOENT") throw new Error("Git is required; install Git and retry");
    if (result.error || result.status !== 0)
      throw new Error("Git clone failed; check repository access and the branch/tag");
    const appPackage = JSON.parse(readFileSync(resolve(checkout, "package.json"), "utf8"));
    if (!existsSync(resolve(checkout, "src")) || !appPackage.scripts?.dev) {
      throw new Error("Repository does not contain a KUI Vue application at its root");
    }
    appPackage.name =
      basename(targetDir)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/^-+/, "") || "kui-pro-app";
    appPackage.private = true;
    appPackage.version = "0.0.0";
    delete appPackage.workspaces;
    const excluded = new Set([
      ".git",
      ".github",
      "packages",
      "node_modules",
      "dist",
      "coverage",
      "test-results",
      "playwright-report",
      "pnpm-workspace.yaml",
    ]);
    checkTarget();
    mkdirSync(targetDir, { recursive: true });
    cpSync(checkout, targetDir, {
      recursive: true,
      force: false,
      errorOnExist: true,
      filter: (source) => {
        const path = relative(checkout, source);
        if (!path) return true;
        return !path
          .split(/[\\/]/)
          .some(
            (part) => excluded.has(part) || (part.startsWith(".env") && part !== ".env.example"),
          );
      },
    });
    writeFileSync(resolve(targetDir, "package.json"), `${JSON.stringify(appPackage, null, 2)}\n`);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  const agent = process.env.npm_config_user_agent || "npm";
  const manager = agent.startsWith("pnpm") ? "pnpm" : agent.startsWith("yarn") ? "yarn" : "npm";
  console.log(`\nKUI Vue Pro project created in ${targetDir}\n`);
  if (targetDir !== process.cwd()) console.log(`  cd ${JSON.stringify(target)}`);
  console.log(
    `  ${manager === "yarn" ? "yarn" : `${manager} install`}\n  ${manager === "npm" ? "npm run" : manager} dev\n`,
  );
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exitCode = 1;
});
