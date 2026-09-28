import { describe, expect, it } from "vitest";
import { applyServerMenu, filterByDataScope, hasPermission } from "@/routers/permissions";

describe("permission helpers", () => {
  it("supports explicit and wildcard permissions", () => {
    expect(hasPermission("order:read", ["order:read"])).toBe(true);
    expect(hasPermission("order:delete", ["order:read"])).toBe(false);
    expect(hasPermission("order:delete", ["*"])).toBe(true);
  });

  it("filters business records by department or owner", () => {
    const rows = [
      { id: 1, ownerId: "u1", departmentId: "d1" },
      { id: 2, ownerId: "u2", departmentId: "d1" },
      { id: 3, ownerId: "u3", departmentId: "d2" },
    ];
    expect(filterByDataScope(rows, { dataScope: "department", departmentId: "d1" })).toHaveLength(
      2,
    );
    expect(filterByDataScope(rows, { dataScope: "self", userId: "u2" })).toEqual([rows[1]]);
  });

  it("fails closed for missing ownership identifiers", () => {
    expect(filterByDataScope([{}], { dataScope: "department" })).toEqual([]);
    expect(filterByDataScope([{}], { dataScope: "self" })).toEqual([]);
  });

  it("keeps local parent groups but never creates remote routes", () => {
    const menus = applyServerMenu([{ key: "/system", path: "/system", meta: { title: "System", roles: ["admin"] }, children: [
      { key: "/system/users", path: "/system/users", meta: { title: "Users" } },
      { key: "/system/roles", path: "/system/roles", meta: { title: "Roles" } },
    ] }], [
      { path: "/system/users", sortOrder: 1, permissionCode: "system:user:read" },
      { path: "https://example.test/remote.js", sortOrder: 0 },
    ]);
    expect(menus).toHaveLength(1);
    expect(menus[0].meta.roles).toBeUndefined();
    expect(menus[0].children?.map((item) => item.path)).toEqual(["/system/users"]);
    expect(menus[0].children?.[0].meta.permissions).toEqual(["system:user:read"]);
  });
});
