<template>
  <div class="page-error">
    <h1>403</h1>
    <h2>{{ $t("tip.title_403") }}</h2>
    <p>{{ $t("tip.desc_403") }}</p>
    <Space>
      <Button @click="() => router.push('/')">Back to home</Button>
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
import { useRouter } from "vue-router";
import Theme from "../../components/system/theme.vue";
const router = useRouter();
const $t = inject<(key: string) => string>("$t", (key: string) => key);
</script>
