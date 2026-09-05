<template>
  <section class="sys-main">
    <RouteCacheView />
  </section>
</template>
<script setup lang="ts">
import RouteCacheView from "./route-cache-view.vue";
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
