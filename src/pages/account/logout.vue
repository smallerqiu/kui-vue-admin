<template>
  <div></div>
</template>
<route lang="yaml">
meta:
  showInMenu: false
</route>
<script setup lang="ts">
import { message } from "kui-vue";
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../../stores/auth";
const router = useRouter();
const authStore = useAuthStore();
onMounted(async () => {
  try {
    await authStore.logout();
    message.success("已退出登录");
  } catch {
    message.warning("本地登录已清除，服务端会话撤销未确认，请检查网络。");
  } finally {
    await router.replace("/account/login");
  }
});
</script>
