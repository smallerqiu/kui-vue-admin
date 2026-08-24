import type { AdminMenuItem } from "@/components/system/useMenu";

export const hasRole = (required: string[] | undefined, roles: string[]) => {
  if (!required?.length) return true;
  return required.some((role) => roles.includes(role));
};
export const hasPermission = (required: string | string[] | undefined, permissions: string[]) => {
  if (!required || (Array.isArray(required) && !required.length)) return true;
  if (permissions.includes("*")) return true;
  const values = Array.isArray(required) ? required : [required];
  return values.some((code) => permissions.includes(code));
};

/**
 * The backend may return user roles/permissions, but component paths remain
 * controlled by the local file router. This prevents arbitrary remote module
 * paths from becoming executable routes.
 */
export function filterMenuByAccess(
  menu: AdminMenuItem[],
  roles: string[],
  permissions: string[],
): AdminMenuItem[] {
  return menu.flatMap((item) => {
    if (!hasRole(item.meta.roles, roles) || !hasPermission(item.meta.permissions, permissions))
      return [];
    const children = item.children
      ? filterMenuByAccess(item.children, roles, permissions)
      : undefined;
    return [{ ...item, children: children?.length ? children : undefined }];
  });
}

export type DataScopeContext = {
  userId?: string;
  departmentId?: string;
  dataScope?: "all" | "department" | "self";
};

/** Applies the signed-in user's data scope to any business record collection. */
export function filterByDataScope<T extends { ownerId?: string; departmentId?: string }>(
  rows: T[],
  context: DataScopeContext,
) {
  if (context.dataScope === "all") return rows;
  if (context.dataScope === "department") {
    return rows.filter((row) => row.departmentId === context.departmentId);
  }
  return rows.filter((row) => row.ownerId === context.userId);
}
