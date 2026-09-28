<template>
  <ResourceManager :definition="resources.roles!" />
</template>
<script setup lang="ts">
import ResourceManager from "@/components/business/resource-manager.vue";
import { resources } from "@/api/workspace";
</script>
<route lang="yaml">
meta:
  title: "角色权限"
  icon: "ShieldCheck"
  order: 2
  roles: ["admin"]
</route>
