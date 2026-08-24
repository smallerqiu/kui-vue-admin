<template>
  <section class="sys-main">
    <router-view v-slot="{ Component }">
      <transition name="route-fade" mode="out-in">
        <keep-alive :include="keepViews" :max="100">
          <component :is="Component" :key="key" />
        </keep-alive>
      </transition>
    </router-view>
  </section>
</template>
<script setup lang="ts">
import { useTabViewsStore } from "@/stores/tabs.ts";
import { computed } from "vue";
const tab = useTabViewsStore();

const keepViews = computed(() => tab.keepViews);
const key = computed(() => tab.keepKey);
</script>
<style lang="less">
@keyframes route-fade {
  0% {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.sys-main {
  position: relative;
  height: 100%;
}

.route-fade-enter-active {
  animation: route-fade 0.14s ease-out;
}

.route-fade-leave-active {
  animation: route-fade 0.1s ease-in reverse;
}

@media (prefers-reduced-motion: reduce) {
  .route-fade-enter-active,
  .route-fade-leave-active {
    animation: none;
  }
}
</style>
