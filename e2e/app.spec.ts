import { expect, test } from "@playwright/test";
test("login and open protected administration pages", async ({ page }) => {
  await page.goto("/account/login");
  await page.getByPlaceholder("邮箱：admin@k-ui.cn").fill("admin@k-ui.cn");
  await page.getByPlaceholder("Password: 123456").fill("123456");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Version 1.0.0")).toBeVisible();
  await page.goto("/commerce/orders");
  await expect(page.getByText("订单管理", { exact: true }).last()).toBeVisible();
  await page.goto("/system/menus");
  await expect(page.getByText("维护菜单、权限码和可见状态。", { exact: true })).toBeVisible();
});
