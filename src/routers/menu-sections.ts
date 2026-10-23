/**
 * Sidebar groups, in one place instead of one layout file per directory.
 *
 * A directory in `src/pages` becomes a route record with no component of its own, and `<router-view>`
 * skips those, so every page can render under the single cache in `route-cache-view.vue`. What a
 * directory still cannot express is the group it belongs to in the menu: the record carries no meta,
 * and a route file named after the directory exists only to hold it -- which costs one keep-alive
 * level per section and re-renders a subtree on every cross-section navigation. So the grouping lives
 * here, keyed by the path the directory produces.
 *
 * Leaves keep their own `<route>` block: `title`, `icon`, `order` and `showInMenu` belong to the page,
 * the same way the react app declares them per route and merges the server's menu rows at runtime.
 */
export interface MenuSection {
  title: string;
  icon?: string;
  order?: number;
  /** Never consulted on the API path: `applyServerMenu` clears it and the server answers with permission codes. */
  roles?: string[];
}

export const menuSections: Record<string, MenuSection> = {
  "/commerce": { title: "交易中心", icon: "ShoppingCart", order: 10 },
  "/crm": { title: "客户中心", icon: "ContactRound", order: 12 },
  "/data": { title: "数据中心", icon: "ChartNoAxesCombined", order: 15 },
  "/system": { title: "系统管理", icon: "Settings", order: 20, roles: ["admin"] },
};

/** The group a record names, exactly: `/crm` is a section, `/crm/customers` is a page. */
export const sectionRecord = (path = ""): MenuSection | undefined => menuSections[path];
