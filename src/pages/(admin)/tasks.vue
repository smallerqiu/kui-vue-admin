<template>
  <ResourceManager :definition="resources.tasks!" />
</template>
<script setup lang="ts">
import ResourceManager from "@/components/business/resource-manager.vue";
import { resources } from "@/api/workspace";
</script>
<route lang="yaml">
meta:
  title: "任务中心"
  icon: "ListTodo"
  order: 9
</route>
