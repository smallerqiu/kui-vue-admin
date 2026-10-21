import { useNotificationStore } from "@/stores/notifications";
import {
  getRouteCacheName,
  getViewCacheName,
  useTabViewsStore,
  type ViewItem,
} from "@/stores/tabs";
import { defaultSystemSettings, useSystemSettingsStore } from "@/stores/system-settings";
import id from "hash-sum";
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
      reload: 0,
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

  // A tab caches under its own key and nothing else: the directories between the layout and a page
  // contribute no component, so there is no parent cache name to keep in step.
  it("builds one cache name per tab and restores it", () => {
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
        { path: "/system" },
        { name: "/(admin)/system/settings", components: { default: {} } },
      ],
    };

    store.addView(route);
    const cacheName = getViewCacheName(store.views[0]);
    expect(store.keepViews).toEqual([cacheName]);

    setActivePinia(createPinia());
    expect(useTabViewsStore().keepViews).toEqual([cacheName]);
  });

  // Navigating back to a tab must not reset its reload count, and a page refresh must not lose it:
  // either one moves the cache name back to the name the discarded instance was cached under.
  it("keeps a reloaded tab on its new cache name", () => {
    const store = useTabViewsStore();
    const route = {
      path: "/crm/customers",
      fullPath: "/crm/customers",
      query: {},
      params: {},
      meta: { title: "Customers" },
      name: "/(admin)/crm/customers",
    };
    store.addView(route);
    store.reloadView(route);
    expect(store.views[0].reload).toBe(1);

    store.addView(route);
    expect(store.views[0].reload).toBe(1);
    // Built without the store's own helper, so a name that stops carrying the count is caught here.
    const reloadedName = getRouteCacheName(`${id(route.fullPath)}:1`);
    expect(store.keepViews).toEqual([reloadedName]);

    setActivePinia(createPinia());
    const restored = useTabViewsStore();
    expect(restored.views[0].reload).toBe(1);
    expect(restored.keepViews).toEqual([reloadedName]);
  });
});
