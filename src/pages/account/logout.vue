<template>
  <div></div>
</template>
<script setup lang="ts">
import { message } from "kui-vue";
import { onMounted } from "vue";
onMounted(() => {
  message.success("Account logged out, please log in again.");
  localStorage.removeItem("token");
  localStorage.removeItem("user_info");
  setTimeout(() => {
    window.location.href = "/account/login";
  }, 1000);
});
</script>
