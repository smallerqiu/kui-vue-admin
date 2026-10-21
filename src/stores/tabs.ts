import id from "hash-sum";
import { defineStore } from "pinia";
import type { AdminMenuItem } from "@/components/system/useMenu";

export interface ViewItem {
  key: string;
  loading: boolean;
  /** Bumped by "reload this tab"; it is part of the cache name, so the page mounts fresh. */
  reload: number;
  path: string;
  fullPath: string;
  query: Record<string, any>;
  params: Record<string, any>;
  meta: Record<string, any>;
  name?: string;
  icon?: string;
}

/**
 * A tab is cached under its own name, not its page's: two tabs of one page with different query
 * (`?server=` links) hold two instances, and `keep-alive` can only pick between them by name.
 */
export const getRouteCacheName = (key: string | number) =>
  `RouteCache_${String(key).replace(/[^a-zA-Z0-9_]/g, "_")}`;

/** The cache name of one tab. `reload` is in it so a reload cannot land back on the old instance. */
export const getViewCacheName = (view: { key: string; reload?: number }) =>
  getRouteCacheName(`${view.key}:${view.reload || 0}`);

const readStoredViews = (): ViewItem[] => {
  try {
    const value = JSON.parse(localStorage.getItem("routes") || "[]");
    if (!Array.isArray(value)) return [];
    return value.map((view) => ({
      ...view,
      key: view.key || id(view.fullPath),
      reload: Number(view.reload) || 0,
      meta: { ...view.meta, keepAlive: true },
    }));
  } catch {
    localStorage.removeItem("routes");
    return [];
  }
};

export const useTabViewsStore = defineStore("tabViews", {
  state: () => ({
    routes: [] as AdminMenuItem[],
    views: readStoredViews(),
  }),
  getters: {
    /** Read-only by design: `keep-alive` prunes whatever falls out of this list, so a tab that is
     * closed, or reloaded to a new name, loses its cached page with no further bookkeeping. */
    keepViews: (state): string[] => [
      ...new Set(
        state.views
          .filter((view) => view.meta.keepAlive)
          .map((view) => getViewCacheName(view)),
      ),
    ],
  },
  actions: {
    setRoutes(routes: AdminMenuItem[]) {
      this.routes = routes;
    },
    retainAuthorizedViews(isAuthorized: (view: ViewItem) => boolean) {
      this.views = this.views.filter(isAuthorized);
      this.updateLocalRoutes();
    },
    addView(route: any) {
      const { view, index } = this.getView(route);
      // A tab keeps its reload count across navigations, or every return to it would remount.
      if (index >= 0) view.reload = this.views[index].reload || 0;
      if (index < 0) {
        this.views.push(view);
      } else {
        this.views.splice(index, 1, view);
      }
      this.updateLocalRoutes();
    },
    /**
     * Discard a tab's cached page and let it load again, whether it is on screen or not.
     *
     * The reload count is part of the cache name, so the tab moves to a name nothing has ever been
     * cached under: `keep-alive` drops the old instance, mounts one new one, and caches it under the
     * new name. This used to also swap a random key in and back out, which mounted twice -- and asked
     * the remote database for the same list twice.
     */
    reloadView(route: any) {
      const { index } = this.getView(route);
      if (index === -1) return;
      const view = this.views[index];
      view.reload = (view.reload || 0) + 1;
      view.loading = true;
      this.updateLocalRoutes();
      setTimeout(() => {
        view.loading = false;
      }, 500);
    },
    closeView(route: any) {
      const { index } = this.getView(route);
      if (index !== -1) {
        this.views.splice(index, 1);
        this.updateLocalRoutes();
      }
    },
    closeOtherView(route: any) {
      const { view } = this.getView(route);
      this.views = [view];
      this.updateLocalRoutes();
    },
    closeRightView(route: any) {
      if (this.views.length <= 1) return;
      const { index } = this.getView(route);
      this.views = this.views.slice(0, index + 1);
      this.updateLocalRoutes();
    },
    closeLeftView(route: any) {
      if (this.views.length <= 1) return;
      const { index } = this.getView(route);
      this.views = this.views.slice(index);
      this.updateLocalRoutes();
    },
    closeAllView() {
      this.views = [];
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
    updateLocalRoutes() {
      const routes = this.views.map((v) => ({
        key: v.key || id(v.fullPath),
        reload: v.reload,
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
        reload: Number(route.reload) || 0,
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

      return { view, index };
    },
  },
});
