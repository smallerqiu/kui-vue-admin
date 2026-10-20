<template>
  <div class="pro-list-page">
    <PageHeader title="客户管理" description="统一管理企业客户、跟进状态和客户价值。">
      <template #actions>
        <Button v-if="canEdit" type="primary" :icon="UserRoundPlus" @click="drawerOpen = true">新增客户</Button>
      </template>
    </PageHeader>
    <p v-if="error" role="alert">{{ error }} <Button @click="reload">重试</Button></p>
    <ListPanel :summary="`${total} 家客户`">
      <template #filters>
        <Input
          v-model="keyword"
          clearable
          placeholder="搜索客户、联系人或城市"
          :icon="Search"
          style="width: 200px"
        />
        <Select v-model="level" clearable placeholder="全部等级" :options="levelOptions" />
        <Select v-model="status" clearable placeholder="全部状态" :options="statusOptions" />
      </template>
      <template #actions>
        <Space>
          <Button theme="plain" @click="resetFilters">重置</Button>
          <TableColumnSetting
            v-model:hidden-keys="hiddenColumnKeys"
            :columns="columns"
            :disabled-keys="['customer', 'action']"
            title="列设置"
            reset-text="重置"
          />
        </Space>
      </template>
      <Table
        :data="customerData"
        :loading="loading"
        :columns="columns"
        :hidden-column-keys="hiddenColumnKeys"
        row-key="id"
        :scroll="{ x: 1050 }"
      >
        <template #customer="{ record }">
          <button class="customer-cell" type="button" @click="openDetail(record)">
            <span style="background: var(--kui-color-primary)"><Icon :type="Building2" /></span>
            <div>
              <strong>{{ record.name }}</strong>
              <small>{{ record.id }} · {{ record.industry }}</small>
            </div>
          </button>
        </template>
        <template #level="{ value }">
          <Tag :color="levelColor(value)">{{ levelLabel(value) }}</Tag>
        </template>
        <template #status="{ value }">
          <Badge :status="statusBadge(value)" :text="statusLabel(value)" />
        </template>
        <template #action="{ record }">
          <Button size="small" theme="plain" :icon="Eye" @click="openDetail(record)">详情</Button>
        </template>
      </Table>
      <Page v-model:page="page" :page-size="pageSize" :total="total" :disabled="loading" />
    </ListPanel>

    <Drawer v-model="drawerOpen" title="新增客户" :width="480" :closable="!saving" :mask-closable="!saving" :esc-key="!saving">
      <template #footer>
        <Button :disabled="saving" @click="drawerOpen = false">取消</Button>
        <Button type="primary" :loading="saving" @click="createCustomer">保存</Button>
      </template>
      <Form :model="form" layout="vertical">
        <FormItem label="企业名称"><Input v-model="form.name" clearable /></FormItem>
        <Grid :cols="2" :x-gap="12">
          <GridItem>
            <FormItem label="所属行业"><Input v-model="form.industry" clearable /></FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="客户等级">
              <Select v-model="form.level" block :options="levelOptions" />
            </FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="联系人"><Input v-model="form.contact" clearable /></FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="联系电话"><Input v-model="form.phone" clearable /></FormItem>
          </GridItem>
        </Grid>
        <FormItem label="联系邮箱"><Input v-model="form.email" clearable /></FormItem>
      </Form>
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import { catalogApi, type Customer } from "@/api/catalog";
import { useResourcePage } from "@/composables/use-resource-page";
import { Building2, Eye, Search, UserRoundPlus } from "kui-icons";
import {
  message,
  PageHeader,
  type BadgeStatusType,
  type Column,
} from "kui-vue";
import { computed, reactive, ref } from "vue";
import { useAuthStore } from "@/stores/auth";
import { hasPermission } from "@/routers/permissions";
import { useRouter } from "vue-router";
import { reportFailure } from "@/utils/report-failure";

const router = useRouter();
const auth = useAuthStore();
const canEdit = computed(() => hasPermission("customer:write", auth.user?.permissions || []));
const columns: Column[] = [
  { title: "客户", key: "customer", width: 290 },
  { title: "等级", key: "level", width: 110 },
  { title: "状态", key: "status", width: 110 },
  { title: "联系人", key: "contact", width: 100 },
  { title: "电话", key: "phone", width: 140 },
  { title: "城市", key: "city", width: 110 },
  { title: "操作", key: "action", width: 90, fixed: "right" },
];
const levelOptions = [
  { label: "战略客户", value: "strategic" },
  { label: "企业客户", value: "enterprise" },
  { label: "成长客户", value: "growth" },
];
const statusOptions = [
  { label: "合作中", value: "active" },
  { label: "跟进中", value: "follow" },
  { label: "风险关注", value: "risk" },
];
const keyword = ref("");
const level = ref<Customer["level"]>();
const status = ref<Customer["status"]>();
const { items: customerData, total, page, pageSize, loading, error, reload } = useResourcePage<Customer>(
  "/customers", () => ({ keyword: keyword.value.trim(), level: level.value, status: status.value }),
);
const saving = ref(false);
const drawerOpen = ref(false);
const hiddenColumnKeys = ref<string[]>([]);
const form = reactive({
  name: "",
  industry: "",
  level: "growth" as Customer["level"],
  status: "follow" as Customer["status"],
  city: "",
  contact: "",
  phone: "",
  email: "",
});
const levelLabel = (value: string) =>
  levelOptions.find((item) => item.value === value)?.label || value;
const levelColor = (value: string) =>
  ({ strategic: "purple", enterprise: "blue", growth: "green" })[value] || "gray";
const statusLabel = (value: string) =>
  statusOptions.find((item) => item.value === value)?.label || value;
const statusBadge = (value: string): BadgeStatusType =>
  (({ active: "success", follow: "processing", risk: "warning" })[value] ||
    "default") as BadgeStatusType;
const resetFilters = () => {
  keyword.value = "";
  level.value = undefined;
  status.value = undefined;
};
const openDetail = (record: Customer) => router.push(`/customer/${record.id}`);
const createCustomer = async () => {
  if (saving.value) return;
  if (!form.name.trim() || !form.contact.trim()) return message.warning("请填写企业名称和联系人");
  saving.value = true;
  try {
    await catalogApi.saveCustomer(form);
    drawerOpen.value = false;
    Object.assign(form, { name: "", industry: "", level: "growth", contact: "", phone: "", email: "", city: "", status: "follow" });
    message.success("客户已创建");
    await reload();
  } catch (reason) {
    // The form stays for a retry, and the refusal says why.
    reportFailure(reason, "保存失败");
  }
  finally { saving.value = false; }
};
</script>

<style scoped lang="less">
.customer-stats {
  margin-bottom: 16px;
}
.customer-cell {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.customer-cell > span {
  display: grid;
  width: 38px;
  height: 38px;
  flex: none;
  place-items: center;
  color: #fff;
  border-radius: var(--kui-control-radius, var(--kui-shape-round, var(--kui-border-radius)));
}
.customer-cell > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.customer-cell strong {
  color: var(--kui-color-text-title);
}
.customer-cell small {
  color: var(--kui-color-text-description);
}
</style>

<route lang="yaml">
meta:
  title: "客户管理"
  icon: "Building2"
  order: 1
</route>
