<template>
  <!-- click.stop 避免向上冒泡触发 tree.vue 的 click 事件-->
  <label
    :class="[`vjs-check-controller`, checked ? 'is-checked' : '']"
    @click.stop
  >
    <span :class="`vjs-check-controller-inner is-${uiType}`" />
    <input
      :checked="model"
      :class="`vjs-check-controller-original is-${uiType}`"
      :type="uiType"
      @change="$emit('change', model)"
    />
  </label>
</template>

<script setup lang="ts">
import { computed } from "vue";
import "./styles/check-controller.less";
const props = defineProps({
  checked: {
    type: Boolean,
    default: false,
  },
  isMultiple: Boolean,
});
const uiType = computed(() => (props.isMultiple ? "checkbox" : "radio"));
const emit = defineEmits(["input", "change"]);
const model = computed({
  get() {
    return props.checked;
  },
  set(val) {
    emit("input", val);
  },
});
</script>
