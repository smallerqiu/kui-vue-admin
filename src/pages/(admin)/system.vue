<template><RouteCacheView /></template>

<script setup lang="ts">
import RouteCacheView from "@/components/system/route-cache-view.vue";
</script>

<route lang="yaml">
meta:
  title: "系统管理"
  icon: "Settings"
  order: 20
  roles: ["admin"]
</route>
