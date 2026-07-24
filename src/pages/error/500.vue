<template>
  <div class="page-error">
    <h1>500</h1>
    <h2>{{ $t("tip.title_500") }}</h2>
    <p>{{ $t("tip.desc_500") }}</p>
    <Space>
      <Button @click="reload">Try again</Button>
    </Space>
    <Theme />
  </div>
</template>
<route lang="yaml">
meta:
  showInMenu: false
</route>
<script setup lang="ts">
import { inject } from "vue";
import Theme from "../../components/system/theme.vue";
const $t = inject<(key: string) => string>("$t", (key: string) => key);
const reload = () => {
  window.history.go(-1);
};
</script>
