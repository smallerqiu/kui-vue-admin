#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import process from "node:process";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = resolve(packageRoot, "template");
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`\nUsage: npm create kui-vue-pro@latest [project-name]\n\nExample:\n  npm create kui-vue-pro@latest my-app\n`);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  console.log(JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")).version);
  process.exit(0);
}

let target = args.find((arg) => !arg.startsWith("-"));
if (!target) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  target = (await prompt.question("Project name: ")).trim() || "kui-pro-app";
  prompt.close();
}

const targetDir = resolve(process.cwd(), target);
if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
  console.error(`\nCannot create project: ${targetDir} is not empty.\n`);
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
cpSync(templateRoot, targetDir, { recursive: true });

const ignored = resolve(targetDir, "_gitignore");
if (existsSync(ignored)) {
  writeFileSync(resolve(targetDir, ".gitignore"), readFileSync(ignored));
  unlinkSync(ignored);
}

const packageFile = resolve(targetDir, "package.json");
const appPackage = JSON.parse(readFileSync(packageFile, "utf8"));
appPackage.name = basename(targetDir)
  .trim()
  .toLowerCase()
  .replace(/\s+/g, "-")
  .replace(/^[._]/, "")
  .replace(/[^a-z0-9~!$%^&*()_+\-={}\[\];,.]/g, "-");
writeFileSync(packageFile, `${JSON.stringify(appPackage, null, 2)}\n`);

const relativeTarget = targetDir === process.cwd() ? "." : target;
const userAgent = process.env.npm_config_user_agent || "npm";
const manager = userAgent.startsWith("pnpm") ? "pnpm" : userAgent.startsWith("yarn") ? "yarn" : "npm";
const install = manager === "yarn" ? "yarn" : `${manager} install`;
const dev = manager === "npm" ? "npm run dev" : `${manager} dev`;

console.log(`\nKUI Vue Pro project created in ${targetDir}\n`);
if (relativeTarget !== ".") console.log(`  cd ${relativeTarget}`);
console.log(`  ${install}\n  ${dev}\n`);
