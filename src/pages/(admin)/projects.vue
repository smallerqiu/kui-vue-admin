<template>
  <ResourceManager :definition="resources.projects!" />
</template>
<script setup lang="ts">
import ResourceManager from "@/components/business/resource-manager.vue";
import { resources } from "@/api/workspace";
</script>
<route lang="yaml">
meta:
  title: "项目中心"
  icon: "FolderKanban"
  order: 8
</route>
