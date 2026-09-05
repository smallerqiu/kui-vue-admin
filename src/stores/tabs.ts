import id from "hash-sum";
import { defineStore } from "pinia";
import type { AdminMenuItem } from "@/components/system/useMenu";

export interface ViewItem {
  key: string;
  cacheKeys: string[];
  loading: boolean;
  path: string;
  fullPath: string;
  query: Record<string, any>;
  params: Record<string, any>;
  meta: Record<string, any>;
  name?: string;
  icon?: string;
}

export const getRouteCacheName = (key: string | number) =>
  `RouteCache_${String(key).replace(/[^a-zA-Z0-9_]/g, "_")}`;

export const getRouteRecordCacheKey = (route: { name?: unknown; path?: string }) =>
  id(`route:${String(route.name || route.path || "unknown")}`);

const readStoredViews = (): ViewItem[] => {
  try {
    const value = JSON.parse(localStorage.getItem("routes") || "[]");
    if (!Array.isArray(value)) return [];
    return value.map((view) => {
      const key = view.key || id(view.fullPath);
      return {
        ...view,
        key,
        cacheKeys: Array.isArray(view.cacheKeys) ? view.cacheKeys : [key],
        meta: { ...view.meta, keepAlive: true },
      };
    });
  } catch {
    localStorage.removeItem("routes");
    return [];
  }
};

export const useTabViewsStore = defineStore("tabViews", {
  state: () => {
    const views = readStoredViews();
    return {
      routes: [] as AdminMenuItem[],
      views,
      keepViews: [
        ...new Set(
          views
            .filter((view) => view.meta.keepAlive)
            .flatMap((view) => view.cacheKeys.map(getRouteCacheName)),
        ),
      ],
      keepKey: "" as string | number,
    };
  },
  actions: {
    setRoutes(routes: AdminMenuItem[]) {
      this.routes = routes;
    },
    addView(route: any) {
      this.keepKey = id(route.fullPath);
      const { view, index } = this.getView(route);

      if (index < 0) {
        this.views.push(view);
      } else {
        this.views.splice(index, 1, view);
      }

      this.syncKeepViews();
      this.updateLocalRoutes();
    },
    reloadSelectView(route: any) {
      const { index, keepViewKey } = this.getView(route);
      if (index !== -1) {
        if (keepViewKey) {
          this.keepViews = this.keepViews.filter((name) => name !== keepViewKey);
        }
        route.loading = true;
        setTimeout(() => {
          route.loading = false;
          if (keepViewKey && !this.keepViews.includes(keepViewKey)) {
            this.keepViews.push(keepViewKey);
          }
        }, 500);
      }
    },
    closeView(route: any) {
      const { index } = this.getView(route);
      if (index !== -1) {
        this.views.splice(index, 1);
        this.syncKeepViews();
        this.updateLocalRoutes();
      }
    },
    closeOtherView(route: any) {
      const { view } = this.getView(route);
      this.views = [view];
      this.syncKeepViews();
      this.updateLocalRoutes();
    },
    closeRightView(route: any) {
      if (this.views.length <= 1) return;
      const { index } = this.getView(route);
      this.views = this.views.slice(0, index + 1);
      this.syncKeepViews();
      this.updateLocalRoutes();
    },
    closeLeftView(route: any) {
      if (this.views.length <= 1) return;
      const { index } = this.getView(route);
      this.views = this.views.slice(index);
      this.syncKeepViews();
      this.updateLocalRoutes();
    },
    closeAllView() {
      this.views = [];
      this.keepViews = [];
      this.updateLocalRoutes();
    },
    moveView(fromIndex: number, toIndex: number) {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= this.views.length ||
        toIndex >= this.views.length
      )
        return;
      const [view] = this.views.splice(fromIndex, 1);
      this.views.splice(toIndex, 0, view);
      this.updateLocalRoutes();
    },
    reloadView(route: any) {
      const { index, keepViewKey } = this.getView(route);
      if (index !== -1 && keepViewKey) {
        this.keepViews = this.keepViews.filter((name) => name !== keepViewKey);
        this.keepKey = Math.random();
        route.loading = true;
        setTimeout(() => {
          if (!this.keepViews.includes(keepViewKey)) this.keepViews.push(keepViewKey);
          this.keepKey = id(route.fullPath);
          route.loading = false;
        }, 500);
      }
    },
    syncKeepViews() {
      this.keepViews = this.views
        .filter((view) => view.meta.keepAlive)
        .flatMap((view) => view.cacheKeys.map(getRouteCacheName))
        .filter((name, index, names) => names.indexOf(name) === index);
    },
    updateLocalRoutes() {
      const routes = this.views.map((v) => ({
        key: v.key || id(v.fullPath),
        cacheKeys: v.cacheKeys,
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
        cacheKeys: [],
        loading: loading === true ? true : false,
        path,
        fullPath,
        query: { ...query },
        params: { ...params },
        meta: { ...meta },
        name,
        icon,
      };

      const matched = Array.isArray(route.matched)
        ? route.matched.filter((record: any) => record.components?.default)
        : [];
      view.cacheKeys = matched.slice(1).map((record: any, index: number, records: any[]) =>
        index === records.length - 1 ? view.key : getRouteRecordCacheKey(record),
      );
      if (!view.cacheKeys.length) view.cacheKeys = [view.key];

      const server = view.query.server || "";
      let index = -1;
      view.meta.keepAlive = true;

      if (server) {
        view.meta.title = server;
        index = this.views.findIndex((x) => x.fullPath === view.fullPath);
      } else {
        index = this.views.findIndex((x) => x.path === view.path);
      }

      return { view, index, keepViewKey: getRouteCacheName(view.key) };
    },
  },
});
