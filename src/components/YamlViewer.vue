<template>
  <CodeEditor
    :model-value="modelValue"
    language="yaml"
    readonly
    :height="height"
    :line-numbers="lineNumbers"
    :line-wrapping="lineWrapping"
    :aria-label="ariaLabel"
  />
</template>
<script setup lang="ts">
import CodeEditor from "./CodeEditor.vue";
withDefaults(
  defineProps<{
    modelValue?: string;
    height?: string | number;
    lineNumbers?: boolean;
    lineWrapping?: boolean;
    ariaLabel?: string;
  }>(),
  { modelValue: "", height: 480, lineNumbers: true, lineWrapping: true, ariaLabel: "YAML viewer" }
);
</script>
