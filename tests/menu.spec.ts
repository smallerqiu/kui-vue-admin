import { createMenuItems } from "@/components/system/useMenu";
import type { RouteRecordRaw } from "vue-router";
import { describe, expect, it } from "vitest";

describe("createMenuItems", () => {
  it("flattens untitled layout routes and sorts menu entries", () => {
    const routes = [
      {
        path: "/",
        children: [
          { path: "reports", meta: { title: "报表", order: 20 } },
          { path: "dashboard", meta: { title: "仪表盘", order: 1 } },
          { path: "hidden", meta: { title: "隐藏页", showInMenu: false } },
        ],
      },
    ] as RouteRecordRaw[];

    const menu = createMenuItems(routes);
    expect(menu.map((item) => item.path)).toEqual(["/dashboard", "/reports"]);
  });

  it("preserves nested groups and resolves relative paths", () => {
    const routes = [
      {
        path: "/system",
        meta: { title: "系统" },
        children: [{ path: "users", meta: { title: "用户" } }],
      },
    ] as RouteRecordRaw[];
    const menu = createMenuItems(routes);
    expect(menu[0].children?.[0].path).toBe("/system/users");
  });
});
