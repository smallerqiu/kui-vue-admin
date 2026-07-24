<template>
  <span class="vjs-tree-brackets" @click.stop="toggleBrackets">{{ data }}</span>
</template>

<script setup lang="ts">
import "./styles/brackets.less";
const emit = defineEmits(["click"]);

const props = defineProps({
  data: {
    required: true,
    type: String,
  },
});

const toggleBrackets = (e:MouseEvent) => {
  emit("click", e);
};
</script>
