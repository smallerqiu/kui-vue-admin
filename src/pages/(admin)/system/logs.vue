<template>
  <div class="pro-list-page">
    <PageHeader title="操作日志" description="审计系统内的重要操作和访问记录。">
      <template #actions><Button :icon="Download">导出日志</Button></template>
    </PageHeader>
    <ListPanel :summary="`${filteredLogs.length} 条日志`">
      <template #filters>
        <Input
          v-model="keyword"
          clearable
          placeholder="搜索用户、模块或 IP"
          :icon="Search"
        />
        <Select
          v-model="level"
          clearable
          placeholder="全部级别"
          :options="levelOptions"
        />
        <Select
          v-model="module"
          clearable
          placeholder="全部模块"
          :options="moduleOptions"
        />
      </template>
      <template #actions>
        <Space>
          <Button :icon="RotateCcw" @click="resetFilters">重置</Button>
          <TableColumnSetting
            v-model:hidden-keys="hiddenColumnKeys"
            :columns="columns"
            :disabled-keys="['operation', 'action']"
            title="列设置"
            reset-text="重置"
          />
        </Space>
      </template>
      <Table
        :data="filteredLogs"
        :columns="columns"
        :hidden-column-keys="hiddenColumnKeys"
        row-key="id"
        :scroll="{ x: 980 }"
      >
        <template #level="{ value }"
          ><Tag :color="levelColor(value)">{{
            levelLabel(value)
          }}</Tag></template
        >
        <template #operator="{ record }"
          ><div class="operator">
            <Avatar :size="28">{{ record.operator.slice(0, 1) }}</Avatar
            ><span>{{ record.operator }}</span>
          </div></template
        >
        <template #action="{ record }"
          ><Button
            size="small"
            theme="plain"
            :icon="Eye"
            @click="showDetail(record)"
            >详情</Button
          ></template
        >
      </Table>
    </ListPanel>

    <Drawer v-model="detailOpen" title="日志详情" :width="560" :footer="false">
      <Descriptions v-if="activeLog" :column="1" bordered size="small">
        <DescriptionsItem label="日志编号">{{ activeLog.id }}</DescriptionsItem>
        <DescriptionsItem label="操作用户">{{
          activeLog.operator
        }}</DescriptionsItem>
        <DescriptionsItem label="模块">{{ activeLog.module }}</DescriptionsItem>
        <DescriptionsItem label="操作内容">{{
          activeLog.operation
        }}</DescriptionsItem>
        <DescriptionsItem label="IP 地址">{{ activeLog.ip }}</DescriptionsItem>
        <DescriptionsItem label="发生时间">{{
          activeLog.createdAt
        }}</DescriptionsItem>
      </Descriptions>
      <h3 class="request-title">请求数据</h3>
      <JsonViewer :data="activeLog?.payload" :height="260" />
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import { PageHeader } from "kui-vue";
import { Download, Eye, RotateCcw, Search } from "kui-icons";
import type { Column, TableRecord } from "kui-vue";
import { computed, defineAsyncComponent, ref } from "vue";

const JsonViewer = defineAsyncComponent(
  () => import("@/components/JsonViewer.vue"),
);

interface LogRow extends TableRecord {
  id: string;
  level: string;
  operator: string;
  module: string;
  operation: string;
  ip: string;
  createdAt: string;
  payload: Record<string, unknown>;
}
const columns: Column[] = [
  { title: "级别", key: "level", width: 90 },
  { title: "操作用户", key: "operator", width: 130 },
  { title: "模块", key: "module", width: 110 },
  { title: "操作内容", key: "operation", width: 260 },
  { title: "IP 地址", key: "ip", width: 140 },
  { title: "时间", key: "createdAt", width: 170 },
  { title: "操作", key: "action", width: 90, fixed: "right" },
];
const logs: LogRow[] = [
  {
    id: "LOG-89241",
    level: "info",
    operator: "林晓",
    module: "商品管理",
    operation: "更新商品「团队空间扩容包」库存",
    ip: "192.168.1.24",
    createdAt: "2026-08-23 11:42:18",
    payload: { productId: "P3", stock: 12, previousStock: 18 },
  },
  {
    id: "LOG-89240",
    level: "success",
    operator: "陈默",
    module: "用户管理",
    operation: "创建用户账号 hean@k-ui.cn",
    ip: "192.168.1.16",
    createdAt: "2026-08-23 11:36:05",
    payload: { userId: "U1005", role: "developer" },
  },
  {
    id: "LOG-89239",
    level: "warning",
    operator: "周宁",
    module: "订单管理",
    operation: "手动关闭超时订单 K202608220082",
    ip: "10.10.2.35",
    createdAt: "2026-08-23 11:28:42",
    payload: { orderId: "K202608220082", reason: "customer_cancelled" },
  },
  {
    id: "LOG-89238",
    level: "danger",
    operator: "系统",
    module: "登录安全",
    operation: "检测到连续登录失败",
    ip: "45.78.32.10",
    createdAt: "2026-08-23 10:58:17",
    payload: { attempts: 6, blocked: true, account: "guest@k-ui.cn" },
  },
  {
    id: "LOG-89237",
    level: "info",
    operator: "王一",
    module: "角色权限",
    operation: "更新数据分析师菜单权限",
    ip: "192.168.1.31",
    createdAt: "2026-08-23 10:41:26",
    payload: { roleId: "R3", permissions: ["dashboard", "analytics"] },
  },
];
const levelOptions = [
  { label: "信息", value: "info" },
  { label: "成功", value: "success" },
  { label: "警告", value: "warning" },
  { label: "异常", value: "danger" },
];
const moduleOptions = [...new Set(logs.map((item) => item.module))].map(
  (value) => ({ label: value, value }),
);
const keyword = ref("");
const level = ref<string>();
const module = ref<string>();
const hiddenColumnKeys = ref<string[]>([]);
const detailOpen = ref(false);
const activeLog = ref<LogRow>();
const filteredLogs = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return logs.filter(
    (item) =>
      (!query ||
        `${item.operator}${item.module}${item.ip}`
          .toLowerCase()
          .includes(query)) &&
      (!level.value || item.level === level.value) &&
      (!module.value || item.module === module.value),
  );
});
const levelLabel = (value: string) =>
  levelOptions.find((item) => item.value === value)?.label || value;
const levelColor = (value: string) =>
  ({ info: "blue", success: "green", warning: "orange", danger: "red" })[
    value
  ] || "gray";
const resetFilters = () => {
  keyword.value = "";
  level.value = undefined;
  module.value = undefined;
};
const showDetail = (record: LogRow) => {
  activeLog.value = record;
  detailOpen.value = true;
};
</script>

<style scoped lang="less">
.operator {
  display: flex;
  gap: 8px;
  align-items: center;
}
.request-title {
  margin: 22px 0 10px;
  color: var(--kui-color-text-title);
  font-size: 14px;
}
</style>

<route lang="yaml">
meta:
  title: "操作日志"
  icon: "FileClock"
  order: 3
  roles: ["admin"]
</route>
