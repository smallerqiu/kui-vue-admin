<template>
  <ResourceManager :definition="resources.approvals!" />
</template>
<script setup lang="ts">
import ResourceManager from "@/components/business/resource-manager.vue";
import { resources } from "@/api/workspace";
</script>
<route lang="yaml">
meta:
  title: "审批中心"
  icon: "Stamp"
  order: 10
</route>
