<template>
  <ResourceManager :definition="resources.menus!" />
</template>
<script setup lang="ts">
import ResourceManager from "@/components/business/resource-manager.vue";
import { resources } from "@/api/workspace";
</script>
<route lang="yaml">
meta:
  title: "菜单管理"
  icon: "SquareMenu"
  order: 3
  roles: ["admin"]
  permissions: ["system:menu"]
</route>
