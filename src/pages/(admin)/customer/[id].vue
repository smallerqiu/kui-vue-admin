<template>
  <div class="customer-detail-page">
    <PageHeader :title="customer?.name || '客户详情'" :description="customer?.industry">
      <template #actions><Button :icon="ArrowLeft" @click="router.back()">返回</Button></template>
    </PageHeader>
    <p v-if="error" role="alert">{{ error }} <Button @click="load">重试</Button></p>
    <Grid v-else :cols="{ xs: 1, lg: 12 }" :x-gap="16" :y-gap="16">
      <GridItem :span="{ xs: 1, lg: 4 }">
        <Card bordered>
          <Skeleton avatar :loading="!customer" :delay="0" :title-width="50" :rows="6" animated>
            <template v-if="customer">
              <div class="company-profile">
                <span style="background: var(--kui-color-primary)"><Icon :type="Building2" /></span>
                <h2>{{ customer.name }}</h2>
                <Space>
                  <Tag>{{ levels.find(item => item.value === customer?.level)?.label }}</Tag>
                  <Tag>{{ statuses.find(item => item.value === customer?.status)?.label }}</Tag>
                </Space>
              </div>
              <Divider />
              <div class="company-meta">
                <p>编号：{{ customer.id }}</p>
                <p>联系人：{{ customer.contact }}</p>
                <p>电话：{{ customer.phone || '未填写' }}</p>
                <p>邮箱：{{ customer.email || '未填写' }}</p>
                <p>城市：{{ customer.city || '未填写' }}</p>
                <p>创建时间：{{ formatDateTime(customer.createdAt) }}</p>
              </div>
            </template>
          </Skeleton>
        </Card>
      </GridItem>
      <GridItem :span="{ xs: 1, lg: 8 }">
        <Card title="客户资料" bordered>
          <!-- The read prefills the form, so an empty form shown first would swallow keystrokes
               typed before it lands; the skeleton keeps the field count visible instead. -->
          <Skeleton :loading="!customer" :delay="0" :title-width="0" :rows="8" animated>
            <Form :model="form" layout="vertical">
              <FormItem label="企业名称"><Input v-model="form.name" /></FormItem>
              <FormItem label="所属行业"><Input v-model="form.industry" /></FormItem>
              <FormItem label="客户等级"><Select v-model="form.level" :options="levels" /></FormItem>
              <FormItem label="跟进状态"><Select v-model="form.status" :options="statuses" /></FormItem>
              <FormItem label="联系人"><Input v-model="form.contact" /></FormItem>
              <FormItem label="联系电话"><Input v-model="form.phone" /></FormItem>
              <FormItem label="联系邮箱"><Input v-model="form.email" /></FormItem>
              <FormItem label="城市"><Input v-model="form.city" /></FormItem>
              <Button v-if="canEdit" type="primary" :loading="saving" @click="save">保存资料</Button>
            </Form>
          </Skeleton>
        </Card>
      </GridItem>
    </Grid>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Building2 } from "kui-icons";
import { PageHeader, message } from "kui-vue";
import { computed, onDeactivated, onScopeDispose, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { catalogApi, customerInput, type Customer, type CustomerInput } from "@/api/catalog";
import { usePaneActivate } from "@/composables/use-pane-activate";
import { hasPermission } from "@/routers/permissions";
import { useAuthStore } from "@/stores/auth";
import { reportFailure } from "@/utils/report-failure";
import { formatDateTime } from "@/utils/common";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const canEdit = computed(() => hasPermission("customer:write", auth.user?.permissions || []));
const customer = ref<Customer>();
const saving = ref(false);
const error = ref("");
const form = reactive<CustomerInput>({
  name: "", industry: "", level: "growth", status: "follow",
  contact: "", phone: "", email: "", city: "",
});
const levels = [
  { label: "战略客户", value: "strategic" }, { label: "企业客户", value: "enterprise" },
  { label: "成长客户", value: "growth" },
];
const statuses = [
  { label: "合作中", value: "active" }, { label: "跟进中", value: "follow" },
  { label: "风险关注", value: "risk" },
];
let generation = 0;
let active = true;
async function load() {
  const id = String(route.params.id || "");
  if (!id || !route.path.startsWith("/customer/")) return;
  const current = ++generation;
  customer.value = undefined;
  error.value = "";
  try {
    const result = await catalogApi.customer(id);
    if (current !== generation) return;
    customer.value = result;
    Object.assign(form, customerInput(result));
  } catch (reason) {
    if (current === generation)
      error.value = reason instanceof Error ? reason.message : "客户资料加载失败";
  }
}
async function save() {
  if (saving.value || !customer.value || !canEdit.value) return;
  if (!form.name.trim() || !form.contact.trim()) return message.warning("请填写企业名称和联系人");
  const id = customer.value.id;
  const current = generation;
  saving.value = true;
  try {
    const result = await catalogApi.saveCustomer(form, id);
    if (current !== generation) return;
    customer.value = result;
    Object.assign(form, customerInput(result));
    message.success("客户资料已保存");
  } catch (reason) {
    // Edits are never discarded; the server explains the refusal.
    reportFailure(reason, "保存失败");
  }
  finally { saving.value = false; }
}
watch(() => route.params.id, () => { if (active) void load(); }, { immediate: true });
usePaneActivate(() => {
  active = true;
  void load();
});
onDeactivated(() => { active = false; generation++; });
onScopeDispose(() => { generation++; });
</script>

<style scoped lang="less">
.customer-detail-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 8px 6px 20px;
}
.company-profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
}
.company-profile > span {
  display: grid;
  width: 68px;
  height: 68px;
  place-items: center;
  color: #fff;
  border-radius: var(--kui-card-radius, var(--kui-border-radius-card));
  font-size: 28px;
}
.company-profile h2 {
  margin: 14px 0 10px;
  color: var(--kui-color-text-title);
}
.company-meta {
  display: grid;
  gap: 12px;
}
.company-meta p {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0;
  color: var(--kui-color-text-description);
}
.health-score {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 12px;
}
.health-score strong {
  color: var(--kui-color-success);
  font-size: 30px;
}
.health-score span {
  color: var(--kui-color-text-description);
}
.health-tip {
  margin: 10px 0 0;
  color: var(--kui-color-text-description);
  font-size: 12px;
}
.value-grid {
  margin-bottom: 16px;
}
.activity-card {
  margin-bottom: 16px;
}
.business-events {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 24px;
}
.business-events > div {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 11px;
  padding: 13px 0;
  border-bottom: 1px solid var(--kui-color-border);
}
.business-events > div > span {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  color: var(--kui-color-primary);
  border-radius: var(--kui-control-radius, var(--kui-shape-round, var(--kui-border-radius)));
  background: var(--kui-theme-fill-bg, var(--kui-control-bg-fill, var(--kui-color-bg-component-overlay)));
}
.business-events p {
  margin: 4px 0;
  color: var(--kui-color-text-description);
}
.business-events small {
  color: var(--kui-color-text-placeholder);
}
@media (max-width: 680px) {
  .business-events {
    grid-template-columns: 1fr;
  }
}
</style>

<route lang="yaml">
meta:
  title: "客户详情"
  icon: "Building2"
  showInMenu: false
  activeMenu: "/crm/customers"
</route>
