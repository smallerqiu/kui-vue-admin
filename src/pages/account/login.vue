<template>
  <div class="login-page">
    <aside class="login-intro">
      <div class="intro-brand"><img src="@/assets/img/logo.svg" /><span>{{ appConfig.name }}</span></div>
      <div class="intro-content">
        <Tag theme="fill">Enterprise Admin</Tag>
        <h1>专注业务，<br />不重复搭建后台基础设施。</h1>
        <p>完善的权限、数据分析与响应式工作台，为企业应用提供可靠起点。</p>
        <div class="intro-points"><span>✓ TypeScript</span><span>✓ RBAC 权限</span><span>✓ 深浅主题</span></div>
      </div>
      <small>Powered by KUI Vue</small>
    </aside>
    <main class="login-box">
      <Space class="header">
        <img src="@/assets/img/logo.svg" class="logo" />
        <span class="title">{{ appConfig.name }}</span>
      </Space>
      <div class="desc">欢迎回来，请登录你的账号</div>
      <div class="main">
      <Form
        ref="refForm"
        name="rules"
        :model="form"
        :rules="rules"
        @submit="submit"
        :wrapperCol="wrapperCol"
        :labelCol="labelCol"
        size="large"
      >
        <Tabs v-model="current">
          <TabPanel key="account" title="账号密码登录">
            <FormItem prop="email">
              <Input v-model="form.email" placeholder="邮箱：admin@k-ui.cn" :icon="User" clearable />
            </FormItem>
            <FormItem prop="password">
              <Input
                placeholder="Password: 123456"
                :icon="Lock"
                type="password"
                v-model="form.password"
                visible-password-icon
                @keyup.enter="submit"
              />
            </FormItem>
          </TabPanel>
          <TabPanel key="phone" title="手机号登录">
            <FormItem prop="phone">
              <Input v-model="form.phone" placeholder="手机号：13888888888" :icon="Phone" clearable />
            </FormItem>
            <FormItem prop="code">
              <Space compact block>
                <Input v-model="form.code" placeholder="验证码：123456" :icon="Sailboat" style="flex: 1" @keyup.enter="submit" />
                <Button :disabled="countdown > 0" @click="sendCode">{{ countdown ? `${countdown}s` : "发送验证码" }}</Button>
              </Space>
            </FormItem>
          </TabPanel>
        </Tabs>
        <FormItem>
          <Flex justify="space-between" style="width: 100%">
            <Checkbox v-model="remember" label="记住登录状态" />
            <a
              class="forget-password"
              target="_self"
              href="javascript:void(0);"
              @click="handleForgotPassword"
              >忘记密码
            </a>
          </Flex>
        </FormItem>
        <FormItem>
          <Button block type="primary" htmlType="submit" :loading="loading">
            登录
          </Button>
        </FormItem>
      </Form>
      <Divider>其他登录方式</Divider>
      <Flex align="center" justify="center">
        <Space>
          <div id="wechat-login-button">
            <Button :icon="LogoWechat" @click="message.info('微信登录待接入 OAuth 服务')" />
          </div>
          <div id="google-login-button">
            <Button :icon="LogoGoogle" @click="message.info('Google 登录待接入 OAuth 服务')" />
          </div>
        </Space>
      </Flex>
      </div>
      <p class="demo-tip">演示账号：admin@k-ui.cn / 123456</p>
    </main>
    <Theme />
  </div>
</template>
<route lang="yaml">
meta:
  showInMenu: false
</route>
<script setup lang="ts">
import { Lock, LogoGoogle, LogoWechat, Phone, Sailboat, User } from "kui-icons";
import { message, type FormContext, type FormRule } from "kui-vue";
import { computed, onBeforeUnmount, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../../stores/auth";
import Theme from "../../components/system/theme.vue";
import { appConfig } from "../../config/app";
// import { request } from "@/utils/request";
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const refForm = ref<FormContext>();
const current = ref("account");
const handleForgotPassword = () => {
  message.info("Please contact the administrator.");
};

const form = reactive({
  email: "admin@k-ui.cn",
  password: "123456",
  phone: "",
  code: "",
});
const loading = ref(false);
const remember = ref(localStorage.getItem("remember_login") !== "0");
const countdown = ref(0);
let countdownTimer: ReturnType<typeof setInterval> | undefined;
const accountRules: Record<string, FormRule[]> = {
  email: [
    { required: true, message: "Please enter the email" },
    {
      type: "mail",
      message: "Please enter the correct email address",
    },
  ],
  password: [
    { required: true, message: "Please enter the password" },
    {
      min: 6,
      max: 20,
      message: "The password must be between 6 and 20 characters long.",
    },
  ],
};
const phoneRules: Record<string, FormRule[]> = {
  phone: [{ required: true, message: "请输入手机号" }, { type: "mobile", message: "请输入正确的手机号" }],
  code: [{ required: true, message: "请输入验证码" }, { min: 6, max: 6, message: "验证码为 6 位数字" }],
};
const rules = computed(() => current.value === "account" ? accountRules : phoneRules);
const wrapperCol = ref({ span: 24 });
const labelCol = ref({});

const getSafeRedirect = () => {
  const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/";
  return redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";
};

const postLogin = () => {
  if (loading.value) return;
  loading.value = true;

  setTimeout(() => {
    const valid = current.value === "account"
      ? form.email === "admin@k-ui.cn" && form.password === "123456"
      : form.phone === "13888888888" && form.code === "123456";
    if (!valid) {
      loading.value = false;
      message.error(current.value === "account" ? "邮箱或密码错误" : "手机号或验证码错误");
      return;
    }
    localStorage.setItem("remember_login", remember.value ? "1" : "0");
    authStore.login(`demo-${Date.now()}`, {
      name: "admin",
      fullName: "Administrator",
      email: "admin@k-ui.cn",
      roles: ["admin"],
    }, remember.value);
    message.success("登录成功");
    router.replace(getSafeRedirect()).finally(() => { loading.value = false; });
  }, 650);
};

const submit = () => {
  refForm.value?.validate(({ valid }: any) => {
    if (valid) {
      postLogin();
    }
  });
};

const sendCode = () => {
  if (!/^1\d{10}$/.test(form.phone)) return message.warning("请先输入正确的手机号");
  message.success("演示验证码：123456");
  countdown.value = 60;
  countdownTimer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0 && countdownTimer) clearInterval(countdownTimer);
  }, 1000);
};
onBeforeUnmount(() => { if (countdownTimer) clearInterval(countdownTimer); });
</script>
<style lang="less">
.login-page {
  display: grid;
  grid-template-columns: minmax(360px, 42%) 1fr;
  min-height: 100%;
  background: var(--kui-color-bg);
}

.login-intro {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 42px clamp(36px, 6vw, 92px);
  color: var(--kui-color-text-on-solid);
  background:
    radial-gradient(circle at 15% 15%, #ffffff24, transparent 32%),
    linear-gradient(145deg, #2678dc, #6654d9 68%, #7b61ff);
}
.intro-brand { display: flex; gap: 10px; align-items: center; font-size: 18px; font-weight: 650; }
.intro-brand img { width: 34px; height: 34px; }
.intro-content { max-width: 520px; }
.intro-content h1 { margin: 20px 0; font-size: clamp(34px, 4vw, 56px); line-height: 1.18; letter-spacing: -1px; }
.intro-content p { max-width: 470px; margin: 0; color: #ffffffc9; font-size: 16px; line-height: 1.8; }
.intro-points { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 28px; color: #ffffffe6; }
.login-intro > small { color: #ffffffa8; }

.login-box {
  align-self: center;
  width: min(420px, calc(100% - 48px));
  margin: 40px auto;

  .header {
    justify-content: center;
    width: 100%;

    .logo {
      width: 40px;
    }

    .title {
      font-size: 28px;
      font-weight: 600;
      font-family:
        Avenir,
        Helvetica Neue,
        Arial,
        Helvetica,
        sans-serif;
    }
  }

  .desc {
    text-align: center;
    font-size: 14px;
    color: var(--kui-color-text-description);
    margin: 10px 0;
  }

  .main {
    width: 100%;
    margin: 38px auto 0;
    .k-tabs-tabpanel {
      padding: 5px;
    }
    .k-tabs-bar {
      border: none;
    }

    .k-tabs-nav-wrap {
      text-align: center;
    }

    .k-col {
      width: 100%;
    }

    .k-icon {
      font-size: 16px;
    }

    .forget-password {
      float: right;
    }
  }
}
.demo-tip { margin: 22px 0 0; color: var(--kui-color-text-description); text-align: center; font-size: 12px; }

@media (max-width: 900px) {
  .login-page { display: block; }
  .login-intro { display: none; }
  .login-box { display: flex; min-height: 100vh; flex-direction: column; justify-content: center; margin-top: 0; margin-bottom: 0; }
}
</style>
