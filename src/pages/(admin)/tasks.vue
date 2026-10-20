<template>
  <div class="task-center-page">
    <PageHeader title="任务中心" description="看板拖动卡片更新状态，列表负责新增与字段编辑。">
      <template #actions>
        <Segmented v-model="view" :options="views" />
      </template>
    </PageHeader>
    <!-- The board mounts only in its own view so it never fetches for a list visit. -->
    <ResourceManager v-if="view === 'list'" :definition="resources.tasks!" />
    <TaskBoard v-else />
  </div>
</template>
<script setup lang="ts">
import { PageHeader } from "kui-vue";
import { ref } from "vue";
import ResourceManager from "@/components/business/resource-manager.vue";
import TaskBoard from "@/components/business/task-board.vue";
import { resources } from "@/api/workspace";

const views = [
  { label: "列表", value: "list" },
  { label: "看板", value: "board" },
];
const view = ref<string>("list");
</script>
<route lang="yaml">
meta:
  title: "任务中心"
  icon: "ListTodo"
  order: 9
</route>
