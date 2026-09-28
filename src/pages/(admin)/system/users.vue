<template>
  <ResourceManager :definition="resources.users!" />
</template>
<script setup lang="ts">
import ResourceManager from "@/components/business/resource-manager.vue";
import { resources } from "@/api/workspace";
</script>
<route lang="yaml">
meta:
  title: "用户管理"
  icon: "Users"
  order: 1
  roles: ["admin"]
</route>
