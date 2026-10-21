import { createApp, defineComponent, h, onMounted, nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { createPinia } from "pinia";
import id from "hash-sum";
import RouteCacheView from "@/components/system/route-cache-view.vue";
import { getRouteCacheName, getRouteRecordCacheKey, useTabViewsStore } from "@/stores/tabs";

const mounts: string[] = [];
const leaf = (label: string) =>
  defineComponent({
    name: label,
    setup() {
      onMounted(() => mounts.push(label));
      return () => h("div", { class: "leaf" }, label);
    },
  });
// A section page is only a cache view over its children, exactly like pages/(admin)/*.vue.
const section = () => defineComponent({ setup: () => () => h(RouteCacheView) });

const routes = [
  {
    path: "/",
    component: section(),
    children: [
      { path: "/a", component: section(), children: [{ path: "x", component: leaf("A-X") }] },
      { path: "/b", component: section(), children: [{ path: "y", component: leaf("B-Y") }] },
    ],
  },
];

const cached = (path: string) => getRouteCacheName(id(path));
const cachedSection = (path: string) => getRouteCacheName(getRouteRecordCacheKey({ path }));

let dispose: (() => void) | undefined;

async function start(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes });
  const pinia = createPinia();
  const app = createApp(defineComponent({ setup: () => () => h(RouterView) }));
  app.use(pinia);
  app.use(router);
  const host = document.createElement("div");
  document.body.appendChild(host);
  // Only the tab bar calls addView, and this test navigates without one, so the cache list is
  // written directly: without it nothing is kept alive and the defect cannot show up.
  useTabViewsStore(pinia).keepViews = [
    cachedSection("/a"),
    cachedSection("/b"),
    cached("/a/x"),
    cached("/b/y"),
  ];
  await router.push(path);
  app.mount(host);
  await nextTick();
  dispose = () => {
    app.unmount();
    host.remove();
  };
  return { router, host };
}

const leaves = (host: HTMLElement) =>
  [...host.querySelectorAll(".leaf")].map((node) => node.textContent);

afterEach(() => {
  dispose?.();
  dispose = undefined;
  mounts.length = 0;
});

describe("nested route cache", () => {
  it("mounts a page once when the route leaves its section", async () => {
    const { router, host } = await start("/a/x");
    expect(mounts).toEqual(["A-X"]);
    await router.push("/b/y");
    await nextTick();
    // The section on its way out re-renders against the incoming route; mounting the incoming page
    // inside it costs a second instance (and a second list request) and leaves it in the wrong
    // section's cache.
    expect(leaves(host)).toEqual(["B-Y"]);
    expect(mounts).toEqual(["A-X", "B-Y"]);
  });

  it("keeps the cached page of a section when coming back to it", async () => {
    const { router, host } = await start("/a/x");
    await router.push("/b/y");
    await nextTick();
    await router.push("/a/x");
    await nextTick();
    expect(leaves(host)).toEqual(["A-X"]);
    expect(mounts).toEqual(["A-X", "B-Y"]);
  });
});
