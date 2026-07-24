import id from "hash-sum";
import { loading } from "kui-vue";
import type { App } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { routes } from "vue-router/auto-routes";
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
      },
      // @ts-ignore
      hidden: true,
      id: id("/system/error"),
      component: () => import("../pages/error/500.vue"),
    },
    {
      path: "/:pathMatch(.*)*",
      meta: { title: "NotFound", icon: "RemoveCircle" },
      component: () => import("../pages/error/404.vue"),
      // @ts-ignore
      id: id("/error/404"),
      hidden: true,
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

export const routerInitialized = (app: App): Promise<void> => {
  return new Promise((resolve: (routes?: any) => void, reject) => {
    const paths = ["/account/login", "/system/error"];
    if (paths.includes(window.location.pathname)) {
      resolve();
    } else {
      resolve();
      // 从后端获取菜单配置
      /* 
      fetch("/api/")
        .then((res: any) => {
          const routes = buildRoute(router,res.data);
          resolve(routes);
        })
        .catch(async (res: any) => {
          app.use(router).mount("#app");
          if (res.status == 401) {
            router.push("/account/login");
          } else {
            router.push("/system/error");
          }
          reject();
        });
        */
    }
  });
};

router.beforeEach(async (to) => {
  loading.start();
  const whiteList = ["/account/login", "/system/error"];
  let token = localStorage.getItem("token");

  if (!token) {
    // 本地校验token,登陆跳转.
    //return !whiteList.includes(to.path) ? "/account/login" : true;
  }
  if (whiteList.includes(to.path)) return true;
  return;
});
router.afterEach((_) => {
  loading.finish();
});
export default router;
