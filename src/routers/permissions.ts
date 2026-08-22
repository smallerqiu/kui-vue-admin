import type { AdminMenuItem } from "@/components/system/useMenu";

export const hasRole = (required: string[] | undefined, roles: string[]) => {
  if (!required?.length) return true;
  return required.some((role) => roles.includes(role));
};

/**
 * The backend may return user roles/permissions, but component paths remain
 * controlled by the local file router. This prevents arbitrary remote module
 * paths from becoming executable routes.
 */
export function filterMenuByRoles(menu: AdminMenuItem[], roles: string[]): AdminMenuItem[] {
  return menu.flatMap((item) => {
    if (!hasRole(item.meta.roles, roles)) return [];
    const children = item.children ? filterMenuByRoles(item.children, roles) : undefined;
    return [{ ...item, children: children?.length ? children : undefined }];
  });
}
