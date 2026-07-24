import id from "hash-sum";
import { defineStore } from "pinia";

export interface ViewItem {
  key: string;
  loading: boolean;
  path: string;
  fullPath: string;
  query: Record<string, any>;
  params: Record<string, any>;
  meta: Record<string, any>;
  name?: string;
  icon?: string;
}

export const useTabViewsStore = defineStore("tabViews", {
  state: () => ({
    routes: [] as any[],
    views: JSON.parse(localStorage.getItem("routes") || "[]") as ViewItem[],
    keepViews: [] as string[],
    keepKey: "" as string | number,
  }),
  actions: {
    setRoutes(routes: any[]) {
      this.routes = routes;
    },
    addView(route: any) {
      this.keepKey = id(route.fullPath);
      const { view, index, keepViewKey } = this.getView(route);

      if (index < 0) {
        this.views.push(view);
      } else {
        this.views.splice(index, 1, view);
      }

      if (keepViewKey && !this.keepViews.includes(keepViewKey)) {
        this.keepViews.push(keepViewKey);
      }
      this.updateLocalRoutes();
    },
    reloadSelectView(route: any) {
      const { index } = this.getView(route);
      if (index !== -1) {
        this.keepViews.splice(index, 1);
        route.loading = true;
        setTimeout(() => {
          route.loading = false;
        }, 500);
      }
    },
    closeView(route: any) {
      const { index } = this.getView(route);
      if (index !== -1) {
        this.views.splice(index, 1);
        this.keepViews.splice(index, 1);
        this.updateLocalRoutes();
      }
    },
    closeOtherView(route: any) {
      const { view, keepViewKey } = this.getView(route);
      this.views = [view];
      this.keepViews = keepViewKey ? [keepViewKey] : [];
      this.updateLocalRoutes();
    },
    closeRightView(route: any) {
      if (this.views.length <= 1) return;
      const { index } = this.getView(route);
      this.views = this.views.slice(0, index + 1);
      this.keepViews = this.keepViews.slice(0, index + 1);
      this.updateLocalRoutes();
    },
    closeLeftView(route: any) {
      if (this.views.length <= 1) return;
      const { index } = this.getView(route);
      this.views = this.views.slice(index);
      this.keepViews = this.keepViews.slice(index);
      this.updateLocalRoutes();
    },
    closeAllView() {
      this.views = [];
      this.keepViews = [];
      this.updateLocalRoutes();
    },
    reloadView(route: any) {
      const { index, keepViewKey } = this.getView(route);
      if (index !== -1 && keepViewKey) {
        this.keepViews.splice(index, 1);
        this.keepKey = Math.random();
        route.loading = true;
        setTimeout(() => {
          this.keepViews.splice(index, 0, keepViewKey);
          this.keepKey = id(route.fullPath);
          route.loading = false;
        }, 500);
      }
    },
    updateLocalRoutes() {
      const routes = this.views.map((v) => ({
        key: v.key || id(v.fullPath),
        loading: v.loading,
        icon: v.icon,
        fullPath: v.fullPath,
        name: v.name,
        query: v.query,
        path: v.path,
        meta: v.meta,
        params: v.params,
        active: v.path == location.pathname,
      }));
      localStorage.setItem("routes", JSON.stringify(routes));
    },
    getView(route: any) {
      const { path, fullPath, query, params, meta, name, icon, loading } = route;
      const view: ViewItem = {
        key: id(fullPath),
        loading: loading === true ? true : false,
        path,
        fullPath,
        query: { ...query },
        params: { ...params },
        meta: { ...meta },
        name,
        icon,
      };

      const server = view.query.server || "";
      let index = -1;
      view.meta.keepAlive = true;

      if (server) {
        view.meta.title = server;
        index = this.views.findIndex((x) => x.fullPath === view.fullPath);
      } else {
        index = this.views.findIndex((x) => x.path === view.path);
      }

      return { view, index, keepViewKey: view.name };
    },
  },
});
