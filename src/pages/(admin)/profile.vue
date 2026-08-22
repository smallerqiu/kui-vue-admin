<template>
  <div class="profile-page">
    <PageHeader title="个人中心" description="管理账号信息、安全设置和使用偏好。" />
    <Grid :cols="{ xs: 1, lg: 12 }" :x-gap="16" :y-gap="16">
      <GridItem :span="{ xs: 1, lg: 4 }">
        <Card bordered class="profile-card">
          <div class="profile-summary">
            <Avatar :size="76" style="background: #3a95ff">{{ displayName.slice(0, 1) }}</Avatar>
            <h2>{{ displayName }}</h2>
            <p>{{ authStore.user.email || "admin@k-ui.cn" }}</p>
            <Space wrap><Tag v-for="role in authStore.roles" :key="role" theme="fill">{{ role }}</Tag></Space>
          </div>
          <Divider />
          <div class="profile-meta">
            <div><span>所属部门</span><strong>平台研发中心</strong></div>
            <div><span>账号状态</span><Badge status="success" text="正常" /></div>
            <div><span>上次登录</span><strong>今天 09:42</strong></div>
            <div><span>登录地点</span><strong>中国 · 武汉</strong></div>
          </div>
        </Card>
      </GridItem>
      <GridItem :span="{ xs: 1, lg: 8 }">
        <Card bordered class="profile-card settings-card">
          <Tabs v-model="activeTab">
            <TabPanel key="basic" title="基本信息">
              <Form :model="basicForm" layout="vertical" class="settings-form">
                <Grid :cols="{ xs: 1, sm: 2 }" :x-gap="16">
                  <GridItem><FormItem label="显示名称"><Input v-model="basicForm.fullName" clearable /></FormItem></GridItem>
                  <GridItem><FormItem label="登录账号"><Input v-model="basicForm.name" disabled /></FormItem></GridItem>
                  <GridItem><FormItem label="邮箱"><Input v-model="basicForm.email" clearable /></FormItem></GridItem>
                  <GridItem><FormItem label="手机号"><Input v-model="basicForm.phone" clearable /></FormItem></GridItem>
                </Grid>
                <FormItem label="个人简介"><Input v-model="basicForm.bio" clearable /></FormItem>
                <Button type="primary" @click="saveBasic">保存修改</Button>
              </Form>
            </TabPanel>
            <TabPanel key="security" title="账号安全">
              <div class="security-list">
                <div v-for="item in securityItems" :key="item.title">
                  <span class="security-icon"><Icon :type="item.icon" /></span>
                  <div><strong>{{ item.title }}</strong><p>{{ item.description }}</p></div>
                  <Button size="small" @click="message.info(`${item.title}功能待接入服务端`)">{{ item.action }}</Button>
                </div>
              </div>
            </TabPanel>
            <TabPanel key="preference" title="偏好设置">
              <div class="preference-list">
                <div><div><strong>深色模式</strong><p>切换后台整体颜色模式</p></div><Switch :model-value="themeStore.theme === 'dark'" @change="toggleTheme" /></div>
                <div><div><strong>桌面通知</strong><p>接收订单和系统安全提醒</p></div><Switch v-model="preferenceStore.notification" /></div>
                <div><div><strong>页面水印</strong><p>在业务页面展示当前账号信息</p></div><Switch v-model="preferenceStore.watermark" /></div>
              </div>
            </TabPanel>
          </Tabs>
        </Card>
      </GridItem>
    </Grid>
  </div>
</template>

<script setup lang="ts">
import PageHeader from "@/components/system/page-header.vue";
import { useAuthStore } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";
import { usePreferenceStore } from "@/stores/preferences";
import { KeyRound, MailCheck, ShieldCheck, Smartphone } from "kui-icons";
import { message, type IconType } from "kui-vue";
import { computed, reactive, ref } from "vue";

const authStore = useAuthStore();
const themeStore = useThemeStore();
const preferenceStore = usePreferenceStore();
const activeTab = ref("basic");
const displayName = computed(() => authStore.user.fullName || authStore.user.name || "管理员");
const basicForm = reactive({
  fullName: String(authStore.user.fullName || "Administrator"),
  name: String(authStore.user.name || "admin"),
  email: String(authStore.user.email || "admin@k-ui.cn"),
  phone: "138 **** 8821",
  bio: "负责 KUI Pro 平台建设与业务管理。",
});
const securityItems: Array<{ title: string; description: string; action: string; icon: IconType[] }> = [
  { title: "登录密码", description: "建议定期更换高强度密码", action: "修改", icon: KeyRound },
  { title: "安全邮箱", description: "admin@k-ui.cn", action: "更换", icon: MailCheck },
  { title: "绑定手机", description: "已绑定 138 **** 8821", action: "更换", icon: Smartphone },
  { title: "两步验证", description: "提升账号登录安全性", action: "开启", icon: ShieldCheck },
];
const saveBasic = () => {
  authStore.updateUser({ fullName: basicForm.fullName, email: basicForm.email });
  message.success("个人信息已保存");
};
const toggleTheme = (dark: boolean) => themeStore.setTheme(dark ? "dark" : "light");
</script>

<style scoped lang="less">
.profile-page { max-width: 1280px; margin: 0 auto; padding: 8px 6px 20px; }
.profile-card { height: 100%; box-sizing: border-box; }
.profile-summary { display: flex; flex-direction: column; align-items: center; padding: 12px 0; text-align: center; }
.profile-summary h2 { margin: 14px 0 3px; color: var(--kui-color-text-title); }
.profile-summary p { margin: 0 0 12px; color: var(--kui-color-text-description); }
.profile-meta { display: grid; gap: 16px; }
.profile-meta > div { display: flex; justify-content: space-between; gap: 16px; }
.profile-meta span { color: var(--kui-color-text-description); }
.settings-form { max-width: 720px; padding-top: 18px; }
.security-list, .preference-list { display: grid; padding-top: 12px; }
.security-list > div { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 17px 0; border-bottom: 1px solid var(--kui-color-border); }
.security-list > div:last-child, .preference-list > div:last-child { border-bottom: 0; }
.security-icon { display: grid; width: 38px; height: 38px; place-items: center; color: var(--kui-color-primary); border-radius: var(--kui-control-radius); background: var(--kui-theme-fill-bg); font-size: 18px; }
.security-list p, .preference-list p { margin: 4px 0 0; color: var(--kui-color-text-description); font-size: 12px; }
.preference-list > div { display: flex; justify-content: space-between; gap: 20px; align-items: center; padding: 17px 0; border-bottom: 1px solid var(--kui-color-border); }
@media (max-width: 560px) { .security-list > div { grid-template-columns: auto minmax(0, 1fr); } .security-list .k-btn { grid-column: 2; justify-self: start; } }
</style>

<route lang="yaml">
meta:
  title: "个人中心"
  icon: "UserRound"
  showInMenu: false
</route>
