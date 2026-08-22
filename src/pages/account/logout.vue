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
import { clearAuthSession } from "../../utils/auth";
const router = useRouter();
onMounted(() => {
  message.success("Account logged out, please log in again.");
  clearAuthSession();
  setTimeout(() => {
    router.replace("/account/login");
  }, 1000);
});
</script>
