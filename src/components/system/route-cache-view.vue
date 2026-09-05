<template>
  <router-view v-slot="{ Component }">
    <keep-alive :include="keepViews" :max="100">
      <component :is="getCacheComponent(Component, cacheKey)" :key="cacheKey" />
    </keep-alive>
  </router-view>
</template>

<script setup lang="ts">
import {
  getRouteCacheName,
  getRouteRecordCacheKey,
  useTabViewsStore,
} from "@/stores/tabs";
import id from "hash-sum";
import {
  computed,
  defineComponent,
  h,
  inject,
  unref,
  type Component,
  type VNode,
} from "vue";
import { useRoute, viewDepthKey } from "vue-router";

const tab = useTabViewsStore();
const route = useRoute();
const injectedDepth = inject(viewDepthKey, 0);
const cacheComponents = new Map<string, Component>();

const keepViews = computed(() => tab.keepViews);
const cacheKey = computed(() => {
  let depth = unref(injectedDepth);
  let record = route.matched[depth];
  while (record && !record.components?.default) {
    record = route.matched[++depth];
  }

  const records = route.matched.filter((item) => item.components?.default);
  const isLeaf = record === records.at(-1);
  return isLeaf
    ? tab.keepKey || id(route.fullPath)
    : getRouteRecordCacheKey(record || { path: route.path });
});

const getCacheComponent = (
  routeComponent: VNode | undefined,
  currentCacheKey: string | number,
) => {
  if (!routeComponent) return undefined;

  const name = getRouteCacheName(currentCacheKey);
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
