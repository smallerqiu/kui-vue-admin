import { createMenuItems } from "@/components/system/useMenu";
import fs from "node:fs";
import { menuSections, sectionFor } from "@/routers/menu-sections";
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

  // A directory has no layout file to hold a `<route>` block any more, so the group heading it gives
  // the sidebar has to come from `menu-sections`.
  it("draws a group for a directory whose record carries no meta", () => {
    const routes = [
      {
        path: "/",
        children: [
          { path: "dashboard", meta: { title: "仪表盘", order: 1 } },
          { path: "crm", children: [{ path: "customers", meta: { title: "客户", order: 3 } }] },
        ],
      },
    ] as unknown as RouteRecordRaw[];

    const menu = createMenuItems(routes);
    expect(menu.map((item) => item.path)).toEqual(["/dashboard", "/crm"]);
    expect(menu[1].meta).toMatchObject({ title: "客户中心", icon: "ContactRound", order: 12 });
    expect(menu[1].children?.map((child) => child.path)).toEqual(["/crm/customers"]);
  });

  it("gates a page by its group while roles still decide access", () => {
    expect(sectionFor("/system/users")?.roles).toEqual(["admin"]);
    expect(sectionFor("/crm/customers")?.roles).toBeUndefined();
  });

  // The map is the only place a group is named: a key without a directory would draw an empty
  // heading, and a folder renamed without its key would lose the group silently.
  it("sections name the page directories that exist", () => {
    expect(Object.keys(menuSections).sort()).toEqual(["/commerce", "/crm", "/data", "/system"]);
    const directories = fs
      .readdirSync("src/pages/(admin)", { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    for (const path of Object.keys(menuSections)) {
      expect(directories, `${path} has no directory under the layout route`).toContain(
        path.slice(1),
      );
    }
  });
});
