<template>
  <div class="notification-panel"><NotificationList compact /></div>
</template>
<script setup lang="ts">
import NotificationList from "@/components/business/notification-list.vue";
</script>
<style scoped>
.notification-panel {
  width: min(390px, calc(100vw - 24px));
  max-height: 70vh;
  overflow: auto;
  background: var(--kui-color-bg-pop);
}
</style>
