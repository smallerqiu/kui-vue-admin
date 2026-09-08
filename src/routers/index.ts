import { loading } from "kui-vue";
import { createRouter, createWebHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";
import { createMenuItems } from "../components/system/useMenu";
import { getRuntimeAppName } from "../config/app";
import { getAuthUser, getToken } from "../utils/auth";
import { hasPermission, hasRole } from "./permissions";
//import { buildRoute } from "./utils.ts";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    ...routes,
    {
      path: "/system/error",
      meta: {
        title: "System Error",
        icon: "RemoveCircle",
        showInMenu: false,
      },
      component: () => import("../pages/error/500.vue"),
    },
    {
      path: "/:pathMatch(.*)*",
      meta: { title: "NotFound", icon: "RemoveCircle", showInMenu: false },
      component: () => import("../pages/error/404.vue"),
    },
  ],
  scrollBehavior(to, _, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }
    if (to.hash) {
      return {
        el: to.hash,
        behavior: "smooth",
      };
    }
    return { top: 0 };
  },
});

export const routerInitialized = async () => createMenuItems(router.options.routes);

export const canAccessRoute = (route: { meta: Record<string, any> }) => {
  const user = getAuthUser();
  return (
    hasRole(route.meta.roles, user.roles || []) &&
    hasPermission(route.meta.permissions, user.permissions || [])
  );
};

router.beforeEach(async (to) => {
  loading.start();
  const whiteList = ["/account/login", "/account/logout", "/system/error"];
  const token = getToken();

  if (!token) {
    return !whiteList.includes(to.path)
      ? { path: "/account/login", query: { redirect: to.fullPath } }
      : true;
  }
  if (to.path === "/account/login") return "/";
  if (!canAccessRoute(to)) return "/error/403";
  return true;
});
router.afterEach((to) => {
  loading.finish();
  document.title = to.meta.title
    ? `${to.meta.title} - ${getRuntimeAppName()}`
    : getRuntimeAppName();
  const analyticsWindow = window as Window & {
    _hmt?: { push: (args: unknown[]) => void };
    gtag?: (...args: unknown[]) => void;
  };
  const _hmt = analyticsWindow._hmt;
  const gtag = analyticsWindow.gtag;
  if (typeof _hmt != "undefined") _hmt.push(["_trackPageview", to.fullPath]);

  if (typeof gtag !== "undefined") {
    gtag("config", "G-1KNV6YTVBM", {
      page_path: to.fullPath,
      page_title: to.meta.title || document.title,
      page_location: window.location.origin + to.fullPath,
    });
  }
});
export default router;
