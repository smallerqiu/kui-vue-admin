import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { compileStyleAsync, parse } from "vue/compiler-sfc";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

test("admin styles follow nested themes, local colors and explicit overrides", async ({ page }) => {
  let css = fs.readFileSync(require.resolve("kui-vue/style/index.css"), "utf8");
  for (const file of [
    "src/assets/css/index.less",
    "src/components/system/notification-panel.vue",
    "src/components/system/command-menu.vue",
  ]) {
    const filename = path.join(root, file);
    const source = fs.readFileSync(filename, "utf8");
    const styles = file.endsWith(".vue") ? parse(source).descriptor.styles.map((s) => s.content) : [source];
    for (const style of styles) {
      const result = await compileStyleAsync({ filename, source: style, id: "theme-check", preprocessLang: "less" });
      expect(result.errors).toEqual([]);
      css += result.code;
    }
  }
  await page.setContent(`<style>${css}</style>
    <div id="outer" theme-mode="dark">
      <div id="dark-panel" class="notification-panel"></div>
      <div id="dark-input" class="k-input" data-multiple><input></div>
      <div id="dark-card" class="k-card"></div>
      <div id="inner" theme-mode="light" style="--kui-color-primary: #ff0000">
        <div id="light-panel" class="notification-panel"></div>
        <div id="light-input" class="k-input" data-multiple><input></div>
        <div class="command-results"><button id="selected" class="active">Selected</button></div>
        <div id="fill" class="notification-icon"></div>
      </div>
    </div>`);
  const background = (id: string) => page.locator(id).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await background("#dark-panel")).not.toBe("rgb(255, 255, 255)");
  expect(await background("#dark-input")).not.toBe("rgb(255, 255, 255)");
  expect(await background("#dark-card")).not.toBe("rgb(255, 255, 255)");
  expect(await background("#light-panel")).toBe("rgb(255, 255, 255)");
  expect(await background("#light-input")).toBe("rgb(255, 255, 255)");
  expect(await background("#fill")).not.toBe("rgba(0, 0, 0, 0)");
  const selectedBefore = await background("#selected");
  expect(selectedBefore).not.toBe("rgba(0, 0, 0, 0)");
  await page.locator("#inner").evaluate((el: HTMLElement) => el.style.setProperty("--kui-color-primary", "#0000ff"));
  await expect.poll(() => background("#selected")).not.toBe(selectedBefore);
  await page.locator("#outer").evaluate((el: HTMLElement) => {
    el.style.setProperty("--kui-popup-bg", "#ff00ff");
    el.style.setProperty("--kui-control-bg", "#00ff00");
  });
  expect(await background("#light-panel")).toBe("rgb(255, 0, 255)");
  await expect.poll(() => background("#light-input")).toBe("rgb(0, 255, 0)");
  await page.locator("#inner").evaluate((el: HTMLElement) => el.style.setProperty("--kui-control-bg-fill", "#ffff00"));
  expect(await background("#fill")).toBe("rgb(255, 255, 0)");
  await page.locator("#inner").evaluate((el: HTMLElement) => el.style.setProperty("--kui-theme-fill-bg", "#00ffff"));
  expect(await background("#fill")).toBe("rgb(0, 255, 255)");
});
