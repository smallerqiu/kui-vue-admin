import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const templateRoot = resolve(packageRoot, "template");
const entries = [
  ".env.example", ".github", "CHANGELOG.md", "Dockerfile", "README.md", "deploy", "docs",
  "e2e", "index.html", "playwright.config.ts", "public", "src", "tests", "tsconfig.app.json",
  "tsconfig.json", "tsconfig.node.json", "typed-router.d.ts", "vite.config.ts", "vitest.config.ts",
];

rmSync(templateRoot, { recursive: true, force: true });
mkdirSync(templateRoot, { recursive: true });
for (const entry of entries) {
  cpSync(resolve(repositoryRoot, entry), resolve(templateRoot, entry), { recursive: true });
}
cpSync(resolve(repositoryRoot, ".gitignore"), resolve(templateRoot, "_gitignore"));

const sourcePackage = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));
const appPackage = {
  name: "kui-pro-app",
  private: true,
  version: "0.0.0",
  type: sourcePackage.type,
  packageManager: sourcePackage.packageManager,
  scripts: sourcePackage.scripts,
  dependencies: { ...sourcePackage.dependencies, "kui-vue": "^5.7.0" },
  devDependencies: sourcePackage.devDependencies,
};
writeFileSync(resolve(templateRoot, "package.json"), `${JSON.stringify(appPackage, null, 2)}\n`);
