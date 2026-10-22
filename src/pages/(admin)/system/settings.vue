<template>
  <div class="settings-page">
    <PageHeader
      title="系统设置"
      description="配置组织资料与登录安全策略。语言、时区作为组织配置保存。"
    >
      <template #actions>
        <Button
          v-if="canWrite"
          :disabled="saving || loading || !data"
          :icon="RotateCcw"
          @click="resetSettings"
        >
          填入默认值
        </Button>
        <Button
          v-if="canWrite"
          type="primary"
          :icon="Save"
          :loading="saving"
          :disabled="loading || !data"
          @click="save"
        >
          保存设置
        </Button>
      </template>
    </PageHeader>
    <p v-if="error" role="alert">
      {{ error }}
      <Button @click="reload">重试</Button>
    </p>
    <Card v-else bordered>
      <!-- The read lands into these fields, so an empty form shown first would swallow
           whatever the operator typed before it arrived. -->
      <Skeleton :loading="!data" :delay="0" :title-width="0" :rows="6" animated>
        <Tabs v-model="activeTab">
          <TabPanel key="basic" title="基础设置">
            <section class="setting-section">
              <div class="section-heading">
                <h2>组织信息</h2>
                <p>用于后台标题、通知和对外展示。</p>
              </div>
              <Form :model="settings" layout="vertical" class="setting-form">
                <Grid :cols="{ xs: 1, sm: 2 }" :x-gap="16">
                  <GridItem>
                    <FormItem label="组织名称">
                      <Input
                        :disabled="saving || !canWrite"
                        v-model="settings.organizationName"
                        clearable
                      />
                    </FormItem>
                  </GridItem>
                  <GridItem>
                    <FormItem label="系统简称">
                      <Input :disabled="saving || !canWrite" v-model="settings.shortName" clearable />
                    </FormItem>
                  </GridItem>
                  <GridItem>
                    <FormItem label="访问域名">
                      <Input :disabled="saving || !canWrite" v-model="settings.domain" clearable />
                    </FormItem>
                  </GridItem>
                  <GridItem>
                    <FormItem label="默认时区">
                      <Select
                        :disabled="saving || !canWrite"
                        v-model="settings.timezone"
                        block
                        :options="timezoneOptions"
                      />
                    </FormItem>
                  </GridItem>
                  <GridItem>
                    <FormItem label="默认语言">
                      <Select
                        :disabled="saving || !canWrite"
                        v-model="settings.locale"
                        block
                        :options="localeOptions"
                      />
                    </FormItem>
                  </GridItem>
                  <GridItem>
                    <FormItem label="品牌主色">
                      <ColorPicker
                        :disabled="saving || !canWrite"
                        v-model="settings.primaryColor"
                        show-text
                        :presets="colorPresets"
                      />
                    </FormItem>
                  </GridItem>
                  <GridItem>
                    <FormItem label="导航布局">
                      <Select
                        :disabled="saving || !canWrite"
                        v-model="settings.layoutMode"
                        block
                        :options="layoutOptions"
                      />
                    </FormItem>
                  </GridItem>
                </Grid>
              </Form>
            </section>
          </TabPanel>
          <TabPanel key="security" title="安全策略">
            <section class="setting-section">
              <div class="section-heading">
                <h2>登录与会话</h2>
                <p>统一控制企业成员的账号安全策略。</p>
              </div>
              <div class="setting-list">
                <div>
                  <div>
                    <strong>会话有效期</strong>
                    <p>无操作超过该时间后需要重新登录。</p>
                  </div>
                  <InputNumber
                    :disabled="saving || !canWrite"
                    v-model="settings.sessionTimeout"
                    :min="5"
                    :max="10080"
                    suffix="分钟"
                  />
                </div>
                <div>
                  <div>
                    <strong>允许多设备登录</strong>
                    <p>关闭后，新设备登录会使旧会话失效。</p>
                  </div>
                  <Switch :disabled="saving || !canWrite" v-model="settings.allowMultiLogin" />
                </div>
                <div>
                  <div>
                    <strong>密码有效期</strong>
                    <p>到期后要求成员修改登录密码。</p>
                  </div>
                  <InputNumber
                    :disabled="saving || !canWrite"
                    v-model="settings.passwordExpiry"
                    :min="0"
                    :max="3650"
                    suffix="天"
                  />
                </div>
              </div>
            </section>
          </TabPanel>
        </Tabs>
      </Skeleton>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { message } from "kui-vue";
import { RotateCcw, Save } from "kui-icons";
import { systemApi } from "@/api/system";
import { useRemoteData } from "@/composables/use-remote-data";
import { defaultSystemSettings, useSystemSettingsStore } from "@/stores/system-settings";
import { useAuthStore } from "@/stores/auth";
import { hasPermission } from "@/routers/permissions";
import { reportFailure } from "@/utils/report-failure";
const store = useSystemSettingsStore(),
  auth = useAuthStore();
const canWrite = computed(() => hasPermission("system:settings:write", auth.permissions));
const settings = reactive({ ...defaultSystemSettings });
const { data, loading, error, reload } = useRemoteData(systemApi.settings);
watch(data, (value) => {
  if (value) {
    Object.assign(settings, value);
    store.apply(value);
  }
});
const activeTab = ref("basic"),
  saving = ref(false);
const timezoneOptions = [
  { label: "中国标准时间 (UTC+8)", value: "Asia/Shanghai" },
  { label: "协调世界时 (UTC)", value: "UTC" },
];
const localeOptions = [
  { label: "简体中文", value: "zh-CN" },
  { label: "English", value: "en-US" },
];
const layoutOptions = [
  { label: "侧边导航", value: "side" },
  { label: "顶部导航", value: "top" },
  { label: "混合导航", value: "mix" },
];
const colorPresets = ["#54a9ff", "#7b61ff", "#00a870", "#f59e0b", "#ef6c77", "#0ea5e9"];
const resetSettings = () => Object.assign(settings, defaultSystemSettings);
async function save() {
  if (saving.value || !canWrite.value || !data.value) return;
  saving.value = true;
  try {
    await store.save({ ...settings });
    message.success("系统设置已保存");
  } catch (reason) {
    // The draft stays untouched, so the operator can fix whatever the server rejected.
    reportFailure(reason, "系统设置保存失败");
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped lang="less">
.settings-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 8px 6px 20px;
}
.setting-section {
  display: grid;
  grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
  gap: 44px;
  padding: 22px 4px;
}
.section-heading h2 {
  margin: 0 0 6px;
  color: var(--kui-color-text-title);
  font-size: 16px;
}
.section-heading p {
  margin: 0;
  color: var(--kui-color-text-description);
  line-height: 1.6;
}
.setting-form {
  min-width: 0;
}
.setting-list {
  display: grid;
}
.setting-list > div {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: center;
  padding: 18px 0;
  border-bottom: 1px solid var(--kui-color-border);
}
.setting-list > div:first-child {
  padding-top: 0;
}
.setting-list > div:last-child {
  border-bottom: 0;
}
.setting-list p {
  margin: 4px 0 0;
  color: var(--kui-color-text-description);
  font-size: 12px;
}
@media (max-width: 700px) {
  .setting-section {
    grid-template-columns: 1fr;
    gap: 22px;
  }
  .setting-list > div {
    align-items: flex-start;
  }
}
</style>

<route lang="yaml">
meta:
  title: "系统设置"
  icon: "Settings2"
  order: 4
  roles: ["admin"]
</route>
