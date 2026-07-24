import id from "hash-sum";
import type { RouteRecordRaw } from "vue-router";
import Layout from "../components/system/layout.vue";
interface MenuItem {
  id: number;
  parentId: number;
  name: string;
  path: string;
  componentPath: string;
  icon?: string;
  show: number; // 0 表示隐藏，1 表示显示
  keepAlive?: boolean;
  children?: MenuItem[];
  capName?: string; // 转换后的组件名称
  key?: string; // 路由唯一标识
}

const modules = import.meta.glob("./pages/**/*.{vue,tsx}");

const capitalize = (word: string): string => {
  let words = word.replace(/\//g, "-").split("-");
  for (let i = 0; i < words.length; i++) {
    words[i] =
      words[i].charAt(0).toUpperCase() + words[i].slice(1).toLowerCase();
  }
  return words.join("");
};

const buildTree = (nodes: MenuItem[] = []): MenuItem[] => {
  const nodeMap = new Map();
  const roots: MenuItem[] = [];
  nodes.forEach((n) => nodeMap.set(n.id, n));

  // 构建树形结构
  nodes.forEach((node) => {
    node.key = !node.path ? id(node.id) : "/" + node.path;
    if (node.parentId == 0) {
      node.capName = capitalize(node.path);
      roots.push(node);
    } else {
      const parentNode = nodeMap.get(node.parentId);
      node.capName = capitalize(node.path);
      if (parentNode) {
        if (!parentNode.children) parentNode.children = [];
        parentNode.children.push(node);
      } else {
        roots.push(node);
      }
    }
  });

  return roots;
};

export const buildRoute = (router, data: any) => {
  const routeItems = buildTree(data);
  let routeTable: string[] = [];
  const dynamicRoutes: RouteRecordRaw[] = routeItems.map((item) => {
    let route = {
      // name: item.capName,
      path: "/" + item.path,
      component: Layout,
      children: [] as any[],
      key: item.key,
      meta: {
        hidden: item.show == 0,
        title: item.name,
        icon: item.icon,
        keepAlive: item.keepAlive,
      },
    };

    if (item.children && item.children.length > 0) {
      item.children.forEach((child) => {
        routeTable.push(`/${child.path}`);
        const item = {
          name: child.capName, //view 是否缓存依据于 name
          path: child.path.startsWith("/") ? "" : "/" + child.path,
          key: child.key,
          component: loadView(child),
          meta: {
            title: child.name,
            icon: child.icon,
            keepAlive: child.keepAlive,
          },
          hidden: child.show == 0,
        };
        route.children.push(item);
      });
    } else {
      let child = { ...route } as RouteRecordRaw;
      delete child.children;
      child.name = item.capName;
      child.component = loadView(item);
      route.children = [child];
      routeTable.push(`/${item.path}`);
    }
    return route as RouteRecordRaw;
  });
  let routes = [...router.options.routes, ...dynamicRoutes];
  dynamicRoutes.forEach((r) => router.addRoute(r));

  return routes;
};

const loadView = (child: MenuItem) => {
  try {
    const componentPath = `./pages/${child.componentPath}.vue`;
    if (modules[componentPath]) {
      return () =>
        modules[componentPath]().then((module: any) => {
          module.default.name = child.capName;
          return module;
        });
    }

    console.error(`Component ${child.componentPath} not found.`);
    return null;
  } catch (e) {
    console.error(`Loading ${child.componentPath} failed:`, e);
    return null;
  }
};
