import { expect, test } from "@playwright/test";

/**
 * There is no offline mode any more, so this spec can only run against a live backend: the
 * account has to exist in the database the dev server proxies to. Credentials come from the
 * environment instead of a demo constant, and a run without them skips rather than fails --
 * `pnpm check` does not include this file, and CI has no database.
 */
const account = process.env.KUI_E2E_ACCOUNT;
const password = process.env.KUI_E2E_PASSWORD;

test.describe("login and open protected administration pages", () => {
  test.skip(!account || !password, "Set KUI_E2E_ACCOUNT and KUI_E2E_PASSWORD to run this spec");

  test("signs in and reaches a list page and a system page", async ({ page }) => {
    await page.goto("/account/login");
    await page.getByPlaceholder("请输入账号").fill(account!);
    await page.getByPlaceholder("请输入密码").fill(password!);
    await page.getByRole("button", { name: "登录" }).click();
    // A remote database makes the first sign-in slower than any local assertion default.
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(page.getByText("Version 1.0.0")).toBeVisible();
    await page.goto("/commerce/orders");
    await expect(page.getByText("订单管理", { exact: true }).last()).toBeVisible();
    await page.goto("/system/menus");
    await expect(page.getByText("菜单管理", { exact: true }).first()).toBeVisible();
  });
});
