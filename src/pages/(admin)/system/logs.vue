<template>
  <div class="pro-list-page">
    <PageHeader title="操作日志" description="审计系统内的重要操作和访问记录。">
      <template #actions>
        <Button :icon="Download" :loading="exporting" @click="exportLogs">导出日志</Button>
      </template>
    </PageHeader>
    <p v-if="error" role="alert">
      {{ error }}
      <Button @click="reload">重试</Button>
    </p>
    <ListPanel :summary="`共 ${total} 条日志`">
      <template #filters>
        <Input
          v-model="keyword"
          clearable
          placeholder="搜索用户、模块或 IP"
          :icon="Search"
          style="width: 200px"
        />
        <Select v-model="level" clearable placeholder="全部级别" :options="levelOptions" />
        <Select v-model="module" clearable placeholder="全部模块" :options="moduleOptions" />
      </template>
      <template #actions>
        <Space>
          <Button theme="plain" @click="resetFilters">重置</Button>
          <Button theme="plain" :loading="loading" @click="reload">刷新</Button>
          <TableColumnSetting
            v-model:hidden-keys="hiddenColumnKeys"
            :columns="columns"
            :disabled-keys="['operation', 'detail']"
            title="列设置"
            reset-text="重置"
          />
        </Space>
      </template>
      <Table
        :data="items"
        :loading="loading"
        :columns="columns"
        :hidden-column-keys="hiddenColumnKeys"
        row-key="id"
        :scroll="{ x: 980 }"
      >
        <template #level="{ record }">
          <Tag :color="levelColor(record.level)">{{ record.levelName }}</Tag>
        </template>
        <template #actorName="{ record }">
          <div class="operator">
            <Avatar :size="28">{{ (record.actorName || "—").slice(0, 1) }}</Avatar>
            <!-- An account deleted after acting keeps its log row: the record is about what was
                 done, so the cell says the name is gone instead of dropping the row. -->
            <span>{{ record.actorName || "已注销账号" }}</span>
          </div>
        </template>
        <template #ip="{ value }">{{ value || "—" }}</template>
        <template #createdAt="{ value }">{{ formatDateTime(value) }}</template>
        <template #detail="{ record }">
          <Button size="small" theme="plain" :icon="Eye" @click="showDetail(record)">详情</Button>
        </template>
      </Table>
      <Page v-model:page="page" :page-size="pageSize" :total="total" :disabled="loading" />
    </ListPanel>

    <Drawer v-model="detailOpen" title="日志详情" :width="560" :footer="false">
      <Descriptions v-if="activeLog" :column="1" bordered size="small">
        <DescriptionsItem label="日志编号">{{ activeLog.id }}</DescriptionsItem>
        <DescriptionsItem label="操作用户">{{ activeLog.actorName || "已注销账号" }}</DescriptionsItem>
        <DescriptionsItem label="模块">{{ activeLog.moduleName }}</DescriptionsItem>
        <DescriptionsItem label="操作内容">{{ activeLog.operation }}</DescriptionsItem>
        <DescriptionsItem label="级别">{{ activeLog.levelName }}</DescriptionsItem>
        <!-- No address on a row written before the column existed, and no address invented for it. -->
        <DescriptionsItem label="IP 地址">{{ activeLog.ip || "未记录" }}</DescriptionsItem>
        <DescriptionsItem label="发生时间">{{ formatDateTime(activeLog.createdAt) }}</DescriptionsItem>
        <DescriptionsItem label="动作码">{{ activeLog.action }}</DescriptionsItem>
        <DescriptionsItem label="资源编号">{{ activeLog.resourceId }}</DescriptionsItem>
        <DescriptionsItem label="请求编号">{{ activeLog.requestId }}</DescriptionsItem>
      </Descriptions>
    </Drawer>
  </div>
</template>
<script setup lang="ts">
import { auditLogApi, auditLogsToCsv } from "@/api/system";
import { Download, Eye, Search } from "kui-icons";
import { message, PageHeader, type Column } from "kui-vue";
import { computed, ref } from "vue";
import { useResourcePage } from "@/composables/use-resource-page";
import { formatDateTime } from "@/utils/common";
import type { AuditLogPage, AuditLogRecord } from "@/api/system";

const keyword = ref("");
const level = ref<string>();
const module = ref<string>();
const { items, payload, total, page, pageSize, loading, error, reload } = useResourcePage<
  AuditLogRecord,
  AuditLogPage
>("/audit-logs", () => ({ keyword: keyword.value, level: level.value, module: module.value }));

const hiddenColumnKeys = ref<string[]>([]);
const detailOpen = ref(false);
const activeLog = ref<AuditLogRecord>();
const exporting = ref(false);

const columns: Column[] = [
  { title: "级别", key: "level", width: 90 },
  { title: "操作用户", key: "actorName", width: 130 },
  { title: "模块", key: "moduleName", width: 110 },
  { title: "操作内容", key: "operation", width: 260 },
  { title: "IP 地址", key: "ip", width: 140 },
  { title: "时间", key: "createdAt", width: 170 },
  { title: "操作", key: "detail", width: 90, fixed: "right" },
];
// The dropdowns list the server's own action dictionary rather than a copy of it kept here, so a code
// the backend learns to describe next week appears as a choice the same week it appears in a row.
const choices = (key: "levels" | "modules") =>
  computed(() =>
    (payload.value?.facets[key] ?? []).map((item) => ({ label: item.name, value: item.code })),
  );
const levelOptions = choices("levels");
const moduleOptions = choices("modules");
// A colour per rung is how the page reads at a glance, and an unknown rung still needs one: the grey
// is the tag saying this build has not heard of the code.  The words next to them are the row's own.
const levelColors: Record<string, string> = {
  info: "blue",
  success: "green",
  warning: "orange",
  danger: "red",
};
const levelColor = (value: string) => levelColors[value] || "gray";

const resetFilters = () => {
  keyword.value = "";
  level.value = undefined;
  module.value = undefined;
};
const showDetail = (record: AuditLogRecord) => {
  activeLog.value = record;
  detailOpen.value = true;
};
const exportLogs = async () => {
  exporting.value = true;
  try {
    const { rows, truncated } = await auditLogApi.allMatching({
      keyword: keyword.value,
      level: level.value,
      module: module.value,
    });
    if (!rows.length) {
      message.warning("当前条件下没有日志");
      return;
    }
    // BOM first so Excel opens the Chinese header row without mojibake.
    const blob = new Blob([`\ufeff${auditLogsToCsv(rows)}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    if (truncated) message.warning(`导出已到 ${rows.length} 条上限，更早的日志不在文件里`);
    else message.success(`已导出 ${rows.length} 条日志`);
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : "导出失败，请重试");
  } finally {
    exporting.value = false;
  }
};
</script>
<style scoped lang="less">
.operator {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
<route lang="yaml">
meta:
  title: "操作日志"
  icon: "Logs"
  order: 5
  permissions: ["system:log:read"]
</route>
