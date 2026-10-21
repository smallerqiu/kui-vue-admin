import { loading } from "kui-vue";
import { createRouter, createWebHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";
import { createMenuItems } from "../components/system/useMenu";
import { loadServerMenu } from "./server-menu";
import { appConfig, getRuntimeAppName } from "../config/app";
import { getAuthUser, getToken } from "../utils/auth";
import { hasPermission, hasRole, routePermissions } from "./permissions";
import { sectionFor } from "./menu-sections";
import { useAuthStore } from "@/stores/auth";
import { useTabViewsStore } from "@/stores/tabs";
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

/**
 * Resolved once per boot; `loadServerMenu` keeps a single in-flight promise per account, so
 * the guard and `main.ts` never pay for the round trip twice.
 */
export const routerInitialized = () =>
  loadServerMenu(createMenuItems(router.options.routes));

export const canAccessRoute = (route: { meta: Record<string, any>; path?: string }) => {
  const user = getAuthUser();
  if (!appConfig.useMock) {
    const path = route.path || "";
    const code = routePermissions[path] || Object.entries(routePermissions).find(
      ([prefix]) => prefix !== "/" && prefix.endsWith("/") && path.startsWith(prefix),
    )?.[1];
    return hasPermission(code, user.permissions || []);
  }
  // `meta.roles` used to come down from the section's layout record; with the sections in
  // `menu-sections` the group has to be consulted directly, or `/system` stops being admin-only.
  const meta: Record<string, any> = { ...sectionFor(route.path), ...route.meta };
  return (
    hasRole(meta.roles, user.roles || []) &&
    hasPermission(meta.permissions, user.permissions || [])
  );
};

router.beforeEach(async (to) => {
  loading.start();
  const whiteList = ["/account/login", "/account/logout", "/system/error", "/error/403", "/error/404", "/error/500"];
  const token = getToken();

  if (!token) {
    return !whiteList.includes(to.path)
      ? { path: "/account/login", query: { redirect: to.fullPath } }
      : true;
  }
  if (to.path === "/account/login") return "/";
  if (!appConfig.useMock && !whiteList.includes(to.path)) {
    try {
      await useAuthStore().refreshUser();
      const tabs = useTabViewsStore();
      tabs.setRoutes(await routerInitialized());
      tabs.retainAuthorizedViews((view) => canAccessRoute(router.resolve(view.fullPath || view.path)));
    } catch {
      return getToken() ? "/error/500" : { path: "/account/login", query: { redirect: to.fullPath } };
    }
  }
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
router.onError(() => loading.finish());
export default router;
