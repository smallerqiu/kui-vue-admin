import type { RouteMeta, RouteRecordRaw } from "vue-router";

export interface AdminMenuItem {
  key: string;
  path: string;
  meta: RouteMeta & {
    title: string;
    icon?: string;
    order?: number;
  };
  children?: AdminMenuItem[];
}

const joinPath = (parent: string, path: string) => {
  if (path.startsWith("/")) return path;
  const base = parent === "/" ? "" : parent.replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}` || "/";
};

export function createMenuItems(
  routes: readonly RouteRecordRaw[],
  parentPath = "",
): AdminMenuItem[] {
  const menus: AdminMenuItem[] = [];

  routes.forEach((route) => {
    const path = joinPath(parentPath, route.path);
    const children = createMenuItems(route.children || [], path);
    const title = route.meta?.title as string | undefined;

    if (!title) {
      menus.push(...children);
      return;
    }
    if (route.meta?.showInMenu === false) return;

    menus.push({
      key: path,
      path,
      meta: {
        ...route.meta,
        title,
        icon: route.meta?.icon as string | undefined,
        order: (route.meta?.order as number | undefined) ?? 99,
      },
      children: children.length ? children : undefined,
    });
  });

  return menus.sort((a, b) => (a.meta.order ?? 99) - (b.meta.order ?? 99));
}
