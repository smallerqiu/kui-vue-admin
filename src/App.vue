<template>
  <ConfigProvider :locale="locale">
    <Watermark :content="userEmail" :fullscreen="true" :z-index="1010" />
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>
  </ConfigProvider>
</template>
<script setup lang="ts">
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import ui_en from "kui-vue/locale/en";
import ui_zh from "kui-vue/locale/zh-CN";
import { computed, provide, ref } from "vue";
import local_en from "./lang/en";
import local_zh from "./lang/zh";
const lang = ref(localStorage.getItem("lang") || "en");
if (lang.value === "zh") {
  dayjs.locale("zh-cn");
}
const userEmail = computed(() => {
  const user = localStorage.getItem("user_info") || "{}";
  return JSON.parse(user).email || "";
});

const messages = computed(() => (lang.value === "en" ? en : zh));
const locale = computed(() => messages.value);

const en = {
  ...ui_en,
  ...local_en,
};

const zh = {
  ...ui_zh,
  ...local_zh,
};

const t = (obj: any, path: string, defaultValue: any = null) => {
  if (obj == null || !path) return defaultValue;

  const keys = String(path).split(".").filter(Boolean);
  let cur = obj;

  for (const k of keys) {
    if (cur != null && Object.prototype.hasOwnProperty.call(cur, k)) {
      cur = cur[k];
    } else {
      return defaultValue;
    }
  }
  return cur;
};

const $t = (key: string, defaultValue?: any) =>
  t(messages.value, key, defaultValue);

const changeLang = () => {
  const value = lang.value === "en" ? "zh" : "en";
  localStorage.setItem("lang", value);
  lang.value = value;
};

provide("$t", $t);
provide("changeLang", changeLang);
</script>
