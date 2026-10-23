<template>
  <div class="profile-page">
    <PageHeader title="个人中心" description="管理账号信息、安全设置和使用偏好。" />
    <Grid :cols="{ xs: 1, lg: 12 }" :x-gap="16" :y-gap="16">
      <GridItem :span="{ xs: 1, lg: 4 }">
        <Card bordered class="profile-card">
          <div class="profile-summary">
            <Avatar :size="76" style="background: #3a95ff">{{ displayName.slice(0, 1) }}</Avatar>
            <h2>{{ displayName }}</h2>
            <p>{{ authStore.user.email || "—" }}</p>
            <Space wrap>
              <Tag v-for="role in authStore.roles" :key="role" theme="fill">{{ role }}</Tag>
            </Space>
          </div>
          <Divider />
          <div class="profile-meta">
            <div>
              <span>所属部门</span>
              <strong>{{ department }}</strong>
            </div>
            <div>
              <span>账号状态</span>
              <Badge status="success" text="正常" />
            </div>
            <div>
              <span>上次登录</span>
              <strong>{{ lastLogin }}</strong>
            </div>
            <div>
              <span>登录地点</span>
              <strong>{{ loginPlace }}</strong>
            </div>
          </div>
        </Card>
      </GridItem>
      <GridItem :span="{ xs: 1, lg: 8 }">
        <Card bordered class="profile-card settings-card">
          <Tabs v-model="activeTab">
            <TabPanel key="basic" title="基本信息">
              <Form :model="basicForm" layout="vertical" class="settings-form">
                <Grid :cols="{ xs: 1, sm: 2 }" :x-gap="16">
                  <GridItem>
                    <FormItem label="显示名称">
                      <Input v-model="basicForm.fullName" clearable />
                    </FormItem>
                  </GridItem>
                  <GridItem>
                    <FormItem label="登录账号">
                      <Input v-model="basicForm.name" disabled />
                    </FormItem>
                  </GridItem>
                  <GridItem>
                    <FormItem label="邮箱">
                      <Input ref="emailInput" v-model="basicForm.email" clearable />
                    </FormItem>
                  </GridItem>
                  <GridItem>
                    <FormItem label="手机号">
                      <Input ref="phoneInput" v-model="basicForm.phone" clearable />
                    </FormItem>
                  </GridItem>
                </Grid>
                <FormItem label="个人简介">
                  <Input v-model="basicForm.bio" clearable placeholder="一句话介绍自己" />
                </FormItem>
                <Button type="primary" :loading="saving" @click="saveBasic">保存修改</Button>
              </Form>
            </TabPanel>
            <TabPanel key="security" title="账号安全">
              <div class="security-list">
                <FeatureCard
                  v-for="item in securityItems"
                  :key="item.title"
                  :icon="item.icon"
                  :title="item.title"
                  :desc="item.description"
                  size="small"
                  theme="plain"
                >
                  <template #extra>
                    <Button size="small" @click="openSecurityEditor(item)">{{ item.action }}</Button>
                  </template>
                </FeatureCard>
              </div>
            </TabPanel>
            <TabPanel key="preference" title="偏好设置">
              <div class="preference-list">
                <div>
                  <div>
                    <strong>深色模式</strong>
                    <p>切换后台整体颜色模式</p>
                  </div>
                  <Switch :model-value="themeStore.theme === 'dark'" @change="toggleTheme" />
                </div>
                <div>
                  <div>
                    <strong>桌面通知</strong>
                    <p>接收订单和系统安全提醒</p>
                  </div>
                  <Switch v-model="preferenceStore.notification" />
                </div>
                <div>
                  <div>
                    <strong>页面水印</strong>
                    <p>在业务页面展示当前账号信息</p>
                  </div>
                  <Switch v-model="preferenceStore.watermark" />
                </div>
              </div>
            </TabPanel>
          </Tabs>
        </Card>
      </GridItem>
    </Grid>

    <Modal
      :model-value="passwordOpen"
      title="修改登录密码"
      :show-close="!changing"
      :mask-closable="!changing"
      :esc-key="!changing"
      @update:model-value="!$event && closePassword()"
    >
      <Form layout="vertical">
        <FormItem label="当前密码">
          <Input
            v-model="passwordForm.oldPassword"
            type="password"
            autocomplete="current-password"
            :disabled="changing"
          />
        </FormItem>
        <FormItem label="新密码">
          <Input
            v-model="passwordForm.password"
            type="password"
            placeholder="至少 12 位"
            autocomplete="new-password"
            :disabled="changing"
          />
        </FormItem>
        <FormItem label="确认新密码">
          <Input
            v-model="passwordForm.confirm"
            type="password"
            autocomplete="new-password"
            :disabled="changing"
          />
        </FormItem>
      </Form>
      <p v-if="passwordError" role="alert">{{ passwordError }}</p>
      <p class="password-note">修改成功后当前账号在所有地方的登录都会失效，需要用新密码重新登录。</p>
      <template #footer>
        <Button :disabled="changing" @click="closePassword">取消</Button>
        <Button type="primary" :loading="changing" @click="submitPassword">确认修改</Button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { PageHeader } from "kui-vue";
import { useAuthStore } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";
import { usePreferenceStore } from "@/stores/preferences";
import { KeyRound, MailCheck, Smartphone } from "kui-icons";
import { message, type IconType } from "kui-vue";
import { computed, nextTick, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { changePasswordApi, updateProfileApi } from "@/api/auth";
import { formatDateTime } from "@/utils/common";
import { reportFailure } from "@/utils/report-failure";

const authStore = useAuthStore();
const themeStore = useThemeStore();
const preferenceStore = usePreferenceStore();
const router = useRouter();
const activeTab = ref("basic");
const displayName = computed(() => authStore.user.fullName || authStore.user.name || "管理员");
// The server answers null when the account has no sign-in behind this one, and says nothing at all
// for a snapshot taken before it started keeping the column -- an absent key is not a first login.
const lastLogin = computed(() =>
  authStore.user.lastLoginAt === undefined
    ? "暂未提供"
    : authStore.user.lastLoginAt === null
      ? "首次登录"
      : formatDateTime(authStore.user.lastLoginAt),
);
// The card shows a department name, so it reads the name the account carries rather than the id
// beside it -- a 32 character key is a row reference, not something to print on a profile page.
const department = computed(() => authStore.user.departmentName || "未设置");
// The one sign-in fact the application can actually observe is the address the connection came
// from, so this cell names that address. There is no place lookup behind it to invent a city.
const loginPlace = computed(() => authStore.user.lastLoginIp || "暂未提供");
const basicForm = reactive({
  fullName: String(authStore.user.fullName || "Administrator"),
  name: String(authStore.user.name || "admin"),
  email: String(authStore.user.email || ""),
  phone: String(authStore.user.phone || ""),
  bio: String(authStore.user.bio || ""),
});
const securityItems: Array<{
  key: "password" | "email" | "phone";
  title: string;
  description: string;
  action: string;
  icon: IconType[];
}> = [
  {
    key: "password",
    title: "登录密码",
    description: "建议定期更换高强度密码",
    action: "修改",
    icon: KeyRound,
  },
  {
    key: "email",
    title: "安全邮箱",
    description: String(authStore.user.email || "未设置"),
    action: "更换",
    icon: MailCheck,
  },
  {
    key: "phone",
    title: "绑定手机",
    description: String(authStore.user.phone || "未设置"),
    action: "更换",
    icon: Smartphone,
  },
];
const passwordOpen = ref(false);
const changing = ref(false);
const passwordError = ref("");
const passwordForm = reactive({ oldPassword: "", password: "", confirm: "" });
/** Kui's `Input` exposes `focus()`; these refs are read for that method and nothing else. */
const emailInput = ref<{ focus: () => void } | null>(null);
const phoneInput = ref<{ focus: () => void } | null>(null);
const contactFields = { email: emailInput, phone: phoneInput } as const;
const closePassword = () => {
  if (!changing.value) passwordOpen.value = false;
};
const openSecurityEditor = async (item: (typeof securityItems)[number]) => {
  if (item.key === "password") {
    passwordError.value = "";
    passwordOpen.value = true;
    return;
  }
  // Email and phone are saved by the basic-information form through `PUT /auth/me`, and there is
  // no verification endpoint to open a dialog against, so 更换 lands the operator on the field
  // that actually writes the value rather than inventing a second form for the same column.
  activeTab.value = "basic";
  // An inactive panel is `display: none`, and focusing a hidden field is a no-op; the panel has
  // to be the active one before the caret can go into it.
  await nextTick();
  contactFields[item.key].value?.focus();
};
const submitPassword = async () => {
  if (changing.value) return;
  // The server refuses a new password under 12 characters and a mismatched confirmation costs a
  // round trip for nothing, so both checks happen before the request.
  if (!passwordForm.oldPassword) {
    passwordError.value = "请输入当前密码";
    return;
  }
  if (passwordForm.password.length < 12) {
    passwordError.value = "新密码至少 12 位";
    return;
  }
  if (passwordForm.password !== passwordForm.confirm) {
    passwordError.value = "两次输入的新密码不一致";
    return;
  }
  changing.value = true;
  passwordError.value = "";
  try {
    await changePasswordApi(passwordForm.oldPassword, passwordForm.password);
    message.success("密码已修改，请使用新密码重新登录");
    passwordOpen.value = false;
    // The server revoked this session when it stored the new hash, so there is nothing to log out
    // of: drop the local pair and land on the sign-in page.
    authStore.endSession();
    await router.replace("/account/login");
  } catch (reason) {
    // The refusal belongs inside the dialog, with what was typed still there to correct.
    passwordError.value = reason instanceof Error ? reason.message : "密码修改失败";
  } finally {
    changing.value = false;
  }
};
const saving = ref(false);
const saveBasic = async () => {
  if (saving.value) return;
  saving.value = true;
  try {
    const payload = {
      fullName: basicForm.fullName,
      email: basicForm.email,
      phone: basicForm.phone,
      bio: basicForm.bio,
    };
    authStore.updateUser(await updateProfileApi(payload));
    message.success("个人信息已保存");
  } catch (reason) {
    // The form stays for correction/retry; the refusal is quoted as written.
    reportFailure(reason, "个人信息保存失败");
  } finally { saving.value = false; }
};
const toggleTheme = (dark: boolean) => themeStore.setTheme(dark ? "dark" : "light");
</script>

<style scoped lang="less">
.profile-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 8px 6px 20px;
}
.profile-card {
  height: 100%;
  box-sizing: border-box;
}
.profile-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  text-align: center;
}
.profile-summary h2 {
  margin: 14px 0 3px;
  color: var(--kui-color-text-title);
}
.profile-summary p {
  margin: 0 0 12px;
  color: var(--kui-color-text-description);
}
.profile-meta {
  display: grid;
  gap: 16px;
}
.profile-meta > div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}
.profile-meta span {
  color: var(--kui-color-text-description);
}
.settings-form {
  max-width: 720px;
  padding-top: 18px;
}
.security-list,
.preference-list {
  display: grid;
  padding-top: 12px;
}
.security-list {
  gap: 4px;
}
.preference-list p {
  margin: 4px 0 0;
  color: var(--kui-color-text-description);
  font-size: 12px;
}
/* Every other refusal in this app is a plain role=alert paragraph, so the warning below it has to
   read as commentary rather than another error. */
.password-note {
  margin: 8px 0 0;
  color: var(--kui-color-text-description);
  font-size: 12px;
}
.preference-list > div {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  padding: 17px 0;
  border-bottom: 1px solid var(--kui-color-border);
}
@media (max-width: 560px) {
  .security-list :deep(.k-feature-card) {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .security-list :deep(.k-feature-card-extra) {
    width: 100%;
    margin-left: 40px;
  }
}
</style>

<route lang="yaml">
meta:
  title: "个人中心"
  icon: "UserRound"
  showInMenu: false
</route>
