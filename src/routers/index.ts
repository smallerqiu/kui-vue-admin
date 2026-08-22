import { loading } from "kui-vue";
import { createRouter, createWebHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";
import { createMenuItems } from "../components/system/useMenu";
import { getAuthUser, getToken } from "../utils/auth";
import { hasRole } from "./permissions";
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
  if (!hasRole(to.meta.roles, getAuthUser().roles || [])) {
    return "/error/403";
  }
  return true;
});
router.afterEach((_) => {
  loading.finish();
});
export default router;
