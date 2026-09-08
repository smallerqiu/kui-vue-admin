import kui from "kui-vue";
import "kui-vue/style/index.css";
import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import "./assets/css/index.less";
import router, { canAccessRoute, routerInitialized } from "./routers/index.ts";
import { permission } from "./directives/permission";
import { useTabViewsStore } from "./stores/tabs.ts";
import { getToken } from "./utils/auth";
const app = createApp(App);
const pinia = createPinia();
const tabs = useTabViewsStore(pinia);
app.use(pinia).use(kui);
app.directive("permission", permission);

const bootstrap = async () => {
  try {
    const menu = await routerInitialized();
    tabs.setRoutes(menu);
    if (getToken()) {
      tabs.retainAuthorizedViews((view) =>
        canAccessRoute(router.resolve(view.fullPath || view.path)),
      );
    }
  } catch (error) {
    console.error("Failed to initialize application routes", error);
  }

  app.config.errorHandler = (error, instance, info) => {
    console.error("Unhandled application error", { error, instance, info });
  };
  app.use(router).mount("#app");
};

void bootstrap();
