import kui from "kui-vue";
import "kui-vue/style/index.css";
import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import "./assets/css/index.less";
import router, { routerInitialized } from "./routers/index.ts";
import { useTabViewsStore } from "./stores/tabs.ts";
const app = createApp(App);
const pinia = createPinia();
const tabs = useTabViewsStore(pinia);
app.use(pinia).use(kui);

routerInitialized(app)
  .then((res: any) => {
    tabs.setRoutes(res);
    app.use(router).mount("#app");
  })
  .catch(() => {});
