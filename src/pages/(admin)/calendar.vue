<template>
  <ResourceManager :definition="resources.calendar!" />
</template>
<script setup lang="ts">
import ResourceManager from "@/components/business/resource-manager.vue";
import { resources } from "@/api/workspace";
</script>
<route lang="yaml">
meta:
  title: "团队日程"
  icon: "CalendarDays"
  order: 11
</route>
