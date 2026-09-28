<template>
  <div class="pro-list-page">
    <PageHeader title="操作日志" description="服务端真实审计记录，时间为 UTC。" />
    <p v-if="error" role="alert">
      {{ error }}
      <Button @click="reload">重试</Button>
    </p>
    <ListPanel :summary="'共 ' + total + ' 条记录'">
      <template #actions><Button :loading="loading" @click="reload">刷新</Button></template>
      <Table
        :data="items"
        :columns="columns"
        :loading="loading"
        row-key="id"
        :scroll="{ x: 1100 }"
      />
      <Page v-model:page="page" :page-size="pageSize" :total="total" :disabled="loading" />
    </ListPanel>
  </div>
</template>
<script setup lang="ts">
import { useResourcePage } from "@/composables/use-resource-page";
import type { BusinessRecord } from "@/api/workspace";
import type { Column } from "kui-vue";
const { items, total, page, pageSize, loading, error, reload } = useResourcePage<BusinessRecord>(
  "/audit-logs",
  () => ({}),
);
const columns: Column[] = [
  { title: "操作", key: "action", width: 180 },
  { title: "操作人 ID", key: "actorId", width: 260 },
  { title: "资源 ID", key: "resourceId", width: 260 },
  { title: "请求 ID", key: "requestId", width: 260 },
  { title: "时间 (UTC)", key: "createdAt", width: 210 },
];
</script>
<route lang="yaml">
meta:
  title: "操作日志"
  icon: "Logs"
  order: 5
  permissions: ["system:log:read"]
</route>
