import { useNotificationStore } from "@/stores/notifications";
import {
  getRouteCacheName,
  getRouteRecordCacheKey,
  useTabViewsStore,
  type ViewItem,
} from "@/stores/tabs";
import { defaultSystemSettings, useSystemSettingsStore } from "@/stores/system-settings";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import request from "@/utils/request";
vi.mock("@/utils/request", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

describe("persistent stores", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("synchronizes notification read state from the server", async () => {
    const store = useNotificationStore();
    expect(store.unreadCount).toBe(0);
    vi.mocked(request.get).mockResolvedValueOnce({
      items: [],
      total: 3,
      unreadCount: 3,
      page: 1,
      pageSize: 20,
    });
    await store.load();
    expect(store.unreadCount).toBe(3);
    vi.mocked(request.post).mockResolvedValueOnce({ ok: true });
    vi.mocked(request.get).mockResolvedValueOnce({
      items: [],
      total: 3,
      unreadCount: 0,
      page: 1,
      pageSize: 20,
    });
    await store.markAllRead();
    expect(store.unreadCount).toBe(0);
  });

  it("saves system settings through the API without browser persistence", async () => {
    const store = useSystemSettingsStore();
    const saved = { ...defaultSystemSettings, organizationName: "KUI Test" };
    vi.mocked(request.put).mockResolvedValueOnce(saved);
    await store.save(saved);
    expect(store.settings.organizationName).toBe("KUI Test");
    expect(localStorage.getItem("system_settings")).toBeNull();
    store.reset();
    expect(store.settings.organizationName).toBe(defaultSystemSettings.organizationName);
  });

  it("applies the configured primary color", async () => {
    const store = useSystemSettingsStore();
    store.settings.primaryColor = "#7b61ff";
    await nextTick();
    expect(document.documentElement.style.getPropertyValue("--kui-color-primary")).toBe("#7b61ff");
  });

  it("reorders opened tabs and persists their order", () => {
    const store = useTabViewsStore();
    const createView = (key: string): ViewItem => ({
      key,
      cacheKeys: [key],
      path: `/${key}`,
      fullPath: `/${key}`,
      loading: false,
      query: {},
      params: {},
      meta: {},
    });
    store.views = [createView("a"), createView("b"), createView("c")];
    store.moveView(0, 2);
    expect(store.views.map((view) => view.key)).toEqual(["b", "c", "a"]);
    expect(
      JSON.parse(localStorage.getItem("routes") || "[]").map((view: ViewItem) => view.key),
    ).toEqual(["b", "c", "a"]);
  });

  it("builds and restores cache names for nested tab routes", () => {
    const store = useTabViewsStore();
    const route = {
      path: "/system/settings",
      fullPath: "/system/settings",
      query: {},
      params: {},
      meta: { title: "Settings" },
      name: "/(admin)/system/settings",
      matched: [
        { name: "/(admin)", components: { default: {} } },
        { name: "/(admin)/system", components: { default: {} } },
        { name: "/(admin)/system/settings", components: { default: {} } },
      ],
    };

    store.addView(route);
    const parentName = getRouteCacheName(getRouteRecordCacheKey(route.matched[1]));
    const leafName = getRouteCacheName(store.views[0].key);
    expect(store.keepViews).toEqual([parentName, leafName]);

    setActivePinia(createPinia());
    expect(useTabViewsStore().keepViews).toEqual([parentName, leafName]);
  });
});
