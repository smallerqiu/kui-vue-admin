<template>
  <CodeEditor
    :model-value="formattedValue"
    language="json"
    readonly
    :height="height"
    :line-numbers="lineNumbers"
    :line-wrapping="lineWrapping"
    :aria-label="ariaLabel"
  />
</template>
<script setup lang="ts">
import { computed } from "vue";
import CodeEditor from "./CodeEditor.vue";
const props = withDefaults(
  defineProps<{
    data?: unknown;
    height?: string | number;
    lineNumbers?: boolean;
    lineWrapping?: boolean;
    ariaLabel?: string;
  }>(),
  {
    height: 480,
    lineNumbers: true,
    lineWrapping: true,
    ariaLabel: "JSON viewer",
  },
);
const formattedValue = computed(() => {
  if (typeof props.data === "string") {
    try {
      return JSON.stringify(JSON.parse(props.data), null, 2);
    } catch {
      return JSON.stringify(props.data);
    }
  }
  try {
    return JSON.stringify(props.data, null, 2) ?? "null";
  } catch {
    return String(props.data ?? "null");
  }
});
</script>
