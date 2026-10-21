import { createApp, defineComponent, h, nextTick, onMounted } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { createPinia, setActivePinia } from "pinia";
import id from "hash-sum";
import RouteCacheView from "@/components/system/route-cache-view.vue";
import { getRouteCacheName, useTabViewsStore, type ViewItem } from "@/stores/tabs";

const mounts: string[] = [];
const leaf = (label: string) =>
  defineComponent({
    name: label,
    setup() {
      onMounted(() => mounts.push(label));
      return () => h("div", { class: "leaf" }, label);
    },
  });

/**
 * The shape `src/pages` produces: the layout holds the only cache view, and a directory contributes
 * a record with no component of its own -- `<router-view>` steps over those to reach the page.
 */
const routes = [
  {
    path: "/",
    component: defineComponent({ setup: () => () => h(RouteCacheView) }),
    children: [
      { path: "/a", children: [{ path: "x", component: leaf("A-X") }] },
      { path: "/b", children: [{ path: "y", component: leaf("B-Y") }] },
    ],
  },
];

const tab = (path: string): ViewItem => ({
  key: id(path),
  reload: 0,
  loading: false,
  path,
  fullPath: path,
  query: {},
  params: {},
  meta: { keepAlive: true },
});

let dispose: (() => void) | undefined;

async function start(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes });
  const pinia = createPinia();
  const app = createApp(defineComponent({ setup: () => () => h(RouterView) }));
  app.use(pinia);
  app.use(router);
  const host = document.createElement("div");
  document.body.appendChild(host);
  // Only the tab bar opens tabs, and this test navigates without one, so the list is written
  // directly: `keep-alive` caches whatever the list names, and nothing at all without it.
  useTabViewsStore(pinia).views = [tab("/a/x"), tab("/b/y")];
  await router.push(path);
  app.mount(host);
  await nextTick();
  dispose = () => {
    app.unmount();
    host.remove();
    setActivePinia(createPinia());
  };
  return { router, host, pinia };
}

const leaves = (host: HTMLElement) =>
  [...host.querySelectorAll(".leaf")].map((node) => node.textContent);

afterEach(() => {
  dispose?.();
  dispose = undefined;
  mounts.length = 0;
});

describe("route cache over a flat page tree", () => {
  it("mounts a page once when the route leaves its directory", async () => {
    const { router, host } = await start("/a/x");
    expect(mounts).toEqual(["A-X"]);
    await router.push("/b/y");
    await nextTick();
    // One cache level means the page on its way out deactivates straight into it: a second mount here
    // would be a second list request against a database that is not on this host.
    expect(leaves(host)).toEqual(["B-Y"]);
    expect(mounts).toEqual(["A-X", "B-Y"]);
  });

  it("reuses the cached page when the route comes back", async () => {
    const { router, host } = await start("/a/x");
    await router.push("/b/y");
    await nextTick();
    await router.push("/a/x");
    await nextTick();
    expect(leaves(host)).toEqual(["A-X"]);
    expect(mounts).toEqual(["A-X", "B-Y"]);
  });

  it("mounts one fresh page when a tab is reloaded", async () => {
    const { host, pinia } = await start("/a/x");
    const store = useTabViewsStore(pinia);
    const staleName = getRouteCacheName(`${id("/a/x")}:0`);
    const freshName = getRouteCacheName(`${id("/a/x")}:1`);
    expect(mounts).toEqual(["A-X"]);
    expect(store.keepViews).toContain(staleName);
    store.reloadView({ path: "/a/x", fullPath: "/a/x", query: {}, params: {}, meta: {} });
    await nextTick();
    await nextTick();
    // The name moved, so the old instance is gone and exactly one new one is up -- this used to mount
    // twice because the key was swapped out and back again.
    expect(mounts).toEqual(["A-X", "A-X"]);
    expect(leaves(host)).toEqual(["A-X"]);
    expect(store.views[0].reload).toBe(1);
    expect(store.keepViews).toEqual([
      freshName,
      getRouteCacheName(`${id("/b/y")}:0`),
    ]);
    expect(store.keepViews).not.toContain(staleName);
  });
});
