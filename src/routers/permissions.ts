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

export interface ServerMenu {
  path: string;
  permissionCode?: string | null;
  sortOrder: number;
}

/** Only intersect with compiled local routes; remote component paths are never executed. */
export function applyServerMenu(local: AdminMenuItem[], records: ServerMenu[]): AdminMenuItem[] {
  const allowed = new Map(records.map((record) => [record.path, record]));
  const visit = (items: AdminMenuItem[]): AdminMenuItem[] => items.flatMap((item) => {
    const children = item.children ? visit(item.children) : [];
    const record = allowed.get(item.path);
    if (!record && !children.length) return [];
    return [{ ...item, meta: { ...item.meta, roles: undefined,
      permissions: record?.permissionCode ? [record.permissionCode] : undefined,
      order: record?.sortOrder ?? item.meta.order },
      children: children.length ? children : undefined }];
  }).sort((a, b) => (a.meta.order ?? 99) - (b.meta.order ?? 99));
  return visit(local);
}

export const routePermissions: Record<string, string> = {
  "/": "dashboard:read", "/data/analytics": "dashboard:read",
  "/commerce/orders": "order:read", "/order/": "order:read",
  "/commerce/products": "product:read", "/commerce/after-sales": "after-sale:read",
  "/crm/customers": "customer:read", "/customer/": "customer:read",
  "/projects": "project:read", "/project/": "project:read",
  "/tasks": "task:read", "/calendar": "calendar:read",
  "/approvals": "approval:read", "/system/users": "system:user:read",
  "/system/departments": "system:user:read",
  "/system/roles": "system:role:read", "/system/menus": "system:menu:read",
  "/system/logs": "system:log:read", "/system/settings": "system:settings:read",
};
