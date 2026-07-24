import { computed } from "vue";
import { useRouter, type RouteRecordRaw } from "vue-router";

export interface MenuItem {
  path: string;
  title: string;
  icon?: string;
  order: number;
  children?: MenuItem[];
}

export function useMenu() {
  const router = useRouter();

  const menuList = computed<MenuItem[]>(() => {
    // 获取所有根层级路由 (或者过滤出 admin 布局下的路由)
    const routes = router.options.routes;

    // 递归解析路由生成菜单树
    function generateMenu(routeList: readonly RouteRecordRaw[]): MenuItem[] {
      const menus: MenuItem[] = [];

      for (const route of routeList) {
        // 如果显式设置为不显示，或者没有 meta，直接跳过
        if (route.meta?.showInMenu === false) continue;

        // 提取菜单项
        const menuItem: MenuItem = {
          path: route.path,
          meta: {
            title: (route.meta?.title as string) || (route.name as string),
            icon: route.meta?.icon as string,
            order: (route.meta?.order as number) ?? 99,
          },
        };

        // 如果有子路由，递归生成子菜单
        if (route.children && route.children.length > 0) {
          const childrenMenu = generateMenu(route.children);
          if (childrenMenu.length > 0) {
            menuItem.children = childrenMenu;
          }
        }

        // 仅包含有标题的有效菜单项
        if (route.meta?.title || menuItem.children) {
          menus.push(menuItem);
        }
      }

      // 按 order 升序排序
      return menus.sort((a, b) => a.order - b.order);
    }

    return generateMenu(routes);
  });

  return {
    menuList,
  };
}
