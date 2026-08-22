<template>
  <div class="login-box">
    <Space class="header">
      <img src="@/assets/img/logo.svg" class="logo" />
      <span class="title">Kui Vue Admin</span>
    </Space>
    <div class="desc">Welcome to Admin.</div>
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
          <TabPanel key="1" title="帐号密码登陆">
            <FormItem prop="email">
              <Input placeholder="Email: admin@k-ui.cn" :icon="User" />
            </FormItem>
            <FormItem prop="password">
              <Input
                placeholder="Password: 123456"
                :icon="Lock"
                type="password"
                @keyup.once.enter="submit"
              />
            </FormItem>
          </TabPanel>
          <TabPanel key="2" title="手机号登陆">
            <FormItem prop="phone_number">
              <Input placeholder="手机号" :icon="Phone" />
            </FormItem>
            <FormItem prop="password">
              <Space compact block>
                <Input placeholder="验证码" :icon="Sailboat" style="flex: 1" />
                <Button>发送验证码</Button>
              </Space>
            </FormItem>
          </TabPanel>
        </Tabs>
        <FormItem>
          <Flex justify="space-between" style="width: 100%">
            <Checkbox label="Remember me" />
            <a
              class="forget-password"
              target="_self"
              href="javascript:void(0);"
              @click="handleForgotPassword"
              >Forgot password
            </a>
          </Flex>
        </FormItem>
        <FormItem>
          <Button block type="primary" htmlType="submit" :loading="loading">
            Login
          </Button>
        </FormItem>
      </Form>
      <Divider>Log in with another account</Divider>
      <Flex align="center" justify="center">
        <Space>
          <div id="wechat-login-button">
            <Button :icon="LogoWechat" />
          </div>
          <div id="google-login-button">
            <Button :icon="LogoGoogle" />
          </div>
        </Space>
      </Flex>
    </div>
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
import { onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import Theme from "../../components/system/theme.vue";
// import { request } from "@/utils/request";
const route = useRoute();
const refForm = ref<FormContext>();
const current = ref("1");
const handleForgotPassword = () => {
  message.info("Please contact the administrator.");
};

const form = reactive({
  email: "",
  password: "",
});
const loading = ref(false);
const rules = ref<Record<string, FormRule[]>>({
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
});
const wrapperCol = ref({ span: 24 });
const labelCol = ref({});

const postLogin = (info: any) => {
  if (loading.value) return;
  loading.value = true;

  setTimeout(() => {
    message.success("Login successful");
    localStorage.setItem("token", "123456");
    localStorage.setItem(
      "user_info",
      JSON.stringify({
        name: "admin",
        email: "<EMAIL>",
      }),
    );
    location.href = "/";
  }, 1000);
  /*
  request.post("/api/login", info)
    .then((res) => {
      if (res.success) {
        let token = res.data.token;
        message.success("Login successful");
        localStorage.setItem("token", token);
        localStorage.setItem("user_info", JSON.stringify(res.data.userInfo));
        if (route.query.from) {
          location.href = decodeURIComponent(route.query.from as string);
        } else {
          const historyRoute = localStorage.getItem("routes") || "[]";
          const routes = JSON.parse(historyRoute);
          const currentRoute = routes.find(
            (item: any) => item.active == true,
          )?.[0] || {
            path: "/",
          };
          location.href = currentRoute.path;
        }
      } else {
        message.error(res.message || "Login failed");
      }
    })
    .finally(() => {
      loading.value = false;
    });
    */
};

const submit = () => {
  refForm.value?.validate(({ valid }: any) => {
    if (valid) {
      postLogin({ ...form });
    }
  });
};

onMounted(async () => {
  //
});
</script>
<style lang="less">
.login-box {
  min-height: 100%;
  padding: 115px 0;

  .header {
    justify-content: center;
    width: 100%;

    .logo {
      width: 40px;
    }

    .title {
      font-size: 30px;
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
    width: 380px;
    margin: 50px auto 0;
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
</style>
