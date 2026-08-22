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
onMounted(() => {
  message.success("Account logged out, please log in again.");
  authStore.logout();
  setTimeout(() => {
    router.replace("/account/login");
  }, 1000);
});
</script>
