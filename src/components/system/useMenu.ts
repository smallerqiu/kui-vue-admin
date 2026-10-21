import type { RouteMeta, RouteRecordRaw } from "vue-router";
import { sectionRecord } from "@/routers/menu-sections";

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
    // The group a directory draws comes from `menu-sections`, because the directory has no file of
    // its own to hold a `<route>` block any more.
    const section = sectionRecord(path);
    const meta = { ...section, ...route.meta };
    const title = meta.title as string | undefined;

    if (!title) {
      menus.push(...children);
      return;
    }
    if (meta.showInMenu === false) return;

    menus.push({
      key: path,
      path,
      meta: {
        ...meta,
        title,
        icon: meta.icon as string | undefined,
        order: (meta.order as number | undefined) ?? 99,
      },
      children: children.length ? children : undefined,
    });
  });

  return menus.sort((a, b) => (a.meta.order ?? 99) - (b.meta.order ?? 99));
}
