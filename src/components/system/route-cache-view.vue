<template>
  <router-view v-slot="{ Component }">
    <keep-alive :include="keepViews" :max="100">
      <component :is="getCacheComponent(Component, cacheName)" :key="cacheName" />
    </keep-alive>
  </router-view>
</template>

<script setup lang="ts">
import { getViewCacheName, useTabViewsStore } from "@/stores/tabs";
import id from "hash-sum";
import { computed, defineComponent, h, type Component, type VNode } from "vue";
import { useRoute } from "vue-router";

const tab = useTabViewsStore();
const route = useRoute();

/**
 * One cache for every page.
 *
 * A directory in `src/pages` leaves a route record with no component behind, and `<router-view>`
 * steps over those, so a page arrives here directly -- no section subtree left to deactivate, and no
 * second `keep-alive` to keep in step with the first.
 *
 * The reload count travels in the name, through the same helper the store uses to build `include`, so
 * the two cannot disagree about what a reloaded tab is called: a reload moves the tab to a name
 * nothing has ever been cached under, which drops the old instance and mounts exactly one new one.
 */
const cacheName = computed(() =>
  getViewCacheName({
    key: id(route.fullPath),
    reload: tab.views.find((view) => view.fullPath === route.fullPath)?.reload,
  }),
);
const keepViews = computed(() => tab.keepViews);

const cacheComponents = new Map<string, Component>();

/**
 * `keep-alive` selects by component name, and every page shares one component, so the tab's name is
 * put on a wrapper of its own. The wrapper renders the route component untouched, keeping its props.
 */
const getCacheComponent = (routeComponent: VNode | undefined, name: string) => {
  if (!routeComponent) return undefined;
  let component = cacheComponents.get(name);
  if (!component) {
    const componentType = routeComponent.type as Component;
    const componentProps = routeComponent.props;
    component = defineComponent({
      name,
      setup: () => () => h(componentType, componentProps),
    });
    cacheComponents.set(name, component);
  }
  return component;
};
</script>
