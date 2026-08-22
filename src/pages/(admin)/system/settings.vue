<template>
  <div class="settings-page">
    <PageHeader title="系统设置" description="配置组织信息、安全策略和系统通知。">
      <template #actions><Button :icon="RotateCcw" @click="resetSettings">恢复默认</Button><Button type="primary" :icon="Save" @click="save">保存设置</Button></template>
    </PageHeader>
    <Card bordered>
      <Tabs v-model="activeTab">
        <TabPanel key="basic" title="基础设置">
          <section class="setting-section">
            <div class="section-heading"><h2>组织信息</h2><p>用于后台标题、通知和对外展示。</p></div>
            <Form :model="settings" layout="vertical" class="setting-form">
              <Grid :cols="{ xs: 1, sm: 2 }" :x-gap="16">
                <GridItem><FormItem label="组织名称"><Input v-model="settings.organizationName" clearable /></FormItem></GridItem>
                <GridItem><FormItem label="系统简称"><Input v-model="settings.shortName" clearable /></FormItem></GridItem>
                <GridItem><FormItem label="访问域名"><Input v-model="settings.domain" clearable /></FormItem></GridItem>
                <GridItem><FormItem label="默认时区"><Select v-model="settings.timezone" block :options="timezoneOptions" /></FormItem></GridItem>
                <GridItem><FormItem label="默认语言"><Select v-model="settings.locale" block :options="localeOptions" /></FormItem></GridItem>
                <GridItem><FormItem label="品牌主色"><ColorPicker v-model="settings.primaryColor" show-text :presets="colorPresets" /></FormItem></GridItem>
              </Grid>
            </Form>
          </section>
        </TabPanel>
        <TabPanel key="security" title="安全策略">
          <section class="setting-section">
            <div class="section-heading"><h2>登录与会话</h2><p>统一控制企业成员的账号安全策略。</p></div>
            <div class="setting-list">
              <div><div><strong>会话有效期</strong><p>无操作超过该时间后需要重新登录。</p></div><InputNumber v-model="settings.sessionTimeout" :min="15" :max="1440" suffix="分钟" /></div>
              <div><div><strong>允许多设备登录</strong><p>关闭后，新设备登录会使旧会话失效。</p></div><Switch v-model="settings.allowMultiLogin" /></div>
              <div><div><strong>密码有效期</strong><p>到期后要求成员修改登录密码。</p></div><InputNumber v-model="settings.passwordExpiry" :min="0" :max="365" suffix="天" /></div>
            </div>
          </section>
        </TabPanel>
        <TabPanel key="notification" title="通知策略">
          <section class="setting-section">
            <div class="section-heading"><h2>系统通知</h2><p>设置默认向管理员发送的通知类型。</p></div>
            <div class="setting-list">
              <div><div><strong>订单异常通知</strong><p>退款、支付失败和订单超时提醒。</p></div><Switch v-model="settings.orderNotification" /></div>
              <div><div><strong>账号安全通知</strong><p>异常登录和权限变更提醒。</p></div><Switch v-model="settings.securityNotification" /></div>
              <div><div><strong>每周经营报告</strong><p>每周一发送上周经营数据摘要。</p></div><Switch v-model="settings.weeklyReport" /></div>
            </div>
          </section>
        </TabPanel>
      </Tabs>
    </Card>
  </div>
</template>

<script setup lang="ts">
import PageHeader from "@/components/system/page-header.vue";
import { useSystemSettingsStore } from "@/stores/system-settings";
import { RotateCcw, Save } from "kui-icons";
import { message, modal } from "kui-vue";
import { ref } from "vue";

const store = useSystemSettingsStore(); const settings = store.settings; const activeTab = ref("basic");
const timezoneOptions = [{ label: "中国标准时间 (UTC+8)", value: "Asia/Shanghai" }, { label: "协调世界时 (UTC)", value: "UTC" }, { label: "东京 (UTC+9)", value: "Asia/Tokyo" }];
const localeOptions = [{ label: "简体中文", value: "zh-CN" }, { label: "English", value: "en-US" }];
const colorPresets = ["#54a9ff", "#7b61ff", "#00a870", "#f59e0b", "#ef6c77", "#0ea5e9"];
const save = () => { store.save(); message.success("系统设置已保存"); };
const resetSettings = () => modal.confirm({ title: "恢复默认设置", content: "确定恢复全部系统默认配置吗？", onOk: () => { store.reset(); store.save(); message.success("已恢复默认设置"); } });
</script>

<style scoped lang="less">
.settings-page { max-width: 1100px; margin: 0 auto; padding: 8px 6px 20px; }
.setting-section { display: grid; grid-template-columns: minmax(180px, 240px) minmax(0, 1fr); gap: 44px; padding: 22px 4px; }
.section-heading h2 { margin: 0 0 6px; color: var(--kui-color-text-title); font-size: 16px; }.section-heading p { margin: 0; color: var(--kui-color-text-description); line-height: 1.6; }
.setting-form { min-width: 0; }.setting-list { display: grid; }
.setting-list > div { display: flex; justify-content: space-between; gap: 24px; align-items: center; padding: 18px 0; border-bottom: 1px solid var(--kui-color-border); }
.setting-list > div:first-child { padding-top: 0; }.setting-list > div:last-child { border-bottom: 0; }
.setting-list p { margin: 4px 0 0; color: var(--kui-color-text-description); font-size: 12px; }
@media (max-width: 700px) { .setting-section { grid-template-columns: 1fr; gap: 22px; }.setting-list > div { align-items: flex-start; } }
</style>

<route lang="yaml">
meta:
  title: "系统设置"
  icon: "Settings2"
  order: 4
  roles: ["admin"]
</route>
