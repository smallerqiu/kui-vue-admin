import { describe, expect, it } from "vitest";
import { filterByDataScope, hasPermission } from "@/routers/permissions";

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
});
