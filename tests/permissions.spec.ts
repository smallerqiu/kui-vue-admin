import type { AdminMenuItem } from "@/components/system/useMenu";
import { filterMenuByRoles, hasRole } from "@/routers/permissions";
import { describe, expect, it } from "vitest";

const menu: AdminMenuItem[] = [
  { key: "/", path: "/", meta: { title: "首页" } },
  { key: "/system", path: "/system", meta: { title: "系统", roles: ["admin"] }, children: [
    { key: "/system/users", path: "/system/users", meta: { title: "用户", roles: ["admin"] } },
  ] },
];

describe("role permissions", () => {
  it("allows public routes and matching roles", () => {
    expect(hasRole(undefined, [])).toBe(true);
    expect(hasRole(["admin"], ["admin"])).toBe(true);
  });

  it("removes inaccessible menu branches without mutating source", () => {
    expect(filterMenuByRoles(menu, ["operator"]).map((item) => item.path)).toEqual(["/"]);
    expect(menu).toHaveLength(2);
    expect(filterMenuByRoles(menu, ["admin"])[1].children).toHaveLength(1);
  });
});
