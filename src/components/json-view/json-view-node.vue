<template>
  <div
    :class="{
      'vjs-tree-node': true,
      'has-selector': showSelectController,
      'has-carets': showIcon,
      'is-highlight': highlightSelectedNode && checked,
    }"
    @click="handleNodeClick"
  >
    <span v-if="showLineNumber" class="vjs-node-index">
      {{ node.id + 1 }}
    </span>

    <check-controller
      v-if="
        showSelectController && selectable && node.type !== 'objectEnd' && node.type !== 'arrayEnd'
      "
      :is-multiple="isMultiple"
      :checked="checked"
      @change="handleSelectedChange"
    />

    <div class="vjs-indent">
      <div
        v-for="(_, index) in node.level"
        :key="index"
        :class="{
          'vjs-indent-unit': true,
          'has-line': showLine,
        }"
      />
      <carets v-if="showIcon" :node-type="node.type" @click="handleIconClick" />
    </div>

    <span v-if="node.key" class="vjs-key">
      <slot name="key" :node="node" :defaultKey="prettyKey">{{ prettyKey }}</slot>
      <span class="vjs-colon">{{ `:${showKeyValueSpace ? " " : ""}` }}</span>
    </span>

    <span>
      <brackets v-if="node.type !== 'content'" :data="node.content" @click="handleBracketsClick" />

      <span
        v-else
        :class="valueClass"
        @click="
          editable && (!editableTrigger || editableTrigger === 'click')
            ? handleValueEdit
            : undefined
        "
        @dblclick="editable && editableTrigger === 'dblclick' ? handleValueEdit : undefined"
      >
        <input
          v-if="editable && editing"
          :value="defaultValue"
          @change="handleInputChange"
          :style="{
            padding: '3px 8px',
            border: '1px solid #eee',
            boxShadow: 'none',
            boxSizing: 'border-box',
            borderRadius: 5,
            fontFamily: 'inherit',
          }"
        />
        <slot v-else name="value" :node="node" :defaultValue="defaultValue">{{
          defaultValue
        }}</slot>
      </span>

      <span v-if="node.showComma">,</span>

      <span v-if="showLength && collapsed" class="vjs-comment"> // {{ node.length }} items </span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Brackets from "./brackets.vue";
import Carets from "./carets.vue";
import CheckController from "./check-controller.vue";
import "./styles/json-view-node.less";
import { getDataType, stringToAutoType } from "./utils";

const emit = defineEmits([
  "value-change",
  "icon-click",
  "brackets-click",
  "selected-change",
  "node-click",
]);

const props = defineProps({
  node: {
    required: true,
    type: Object,
  },
  collapsed: Boolean,
  showDoubleQuotes: Boolean,
  showLength: Boolean,
  checked: Boolean,
  selectableType: {
    type: String,
    default: "",
  },
  showSelectController: {
    type: Boolean,
    default: false,
  },
  showLine: {
    type: Boolean,
    default: true,
  },
  showLineNumber: {
    type: Boolean,
    default: false,
  },
  selectOnClickNode: {
    type: Boolean,
    default: true,
  },
  nodeSelectable: {
    type: Function,
    default: () => true,
  },
  highlightSelectedNode: {
    type: Boolean,
    default: true,
  },
  showIcon: {
    type: Boolean,
    default: false,
  },
  showKeyValueSpace: {
    type: Boolean,
    default: true,
  },
  editable: {
    type: Boolean,
    default: false,
  },
  editableTrigger: {
    type: String,
    default: "click",
  },
});

const editing = ref(false);

const valueClass = computed(() => {
  return `vjs-value vjs-value-${dataType.value}`;
});

const dataType = computed(() => {
  return getDataType(props.node.content);
});

const prettyKey = computed(() => {
  return props.showDoubleQuotes ? `"${props.node.key}"` : props.node.key;
});

const selectable = computed(() => {
  return props.nodeSelectable(props.node) && (isMultiple.value || isSingle.value);
});

const isMultiple = computed(() => {
  return props.selectableType === "multiple";
});

const isSingle = computed(() => {
  return props.selectableType === "single";
});

const defaultValue = computed(() => {
  let value = props.node?.content;
  if (value === null || value === undefined) {
    value += "";
  }
  return dataType.value === "string" ? `"${value}"` : value;
});

const handleInputChange = (e: Event) => {
  const source = (e.target as HTMLInputElement).value;
  const value = stringToAutoType(source);
  emit("value-change", value, props.node.path);
};

const handleIconClick = () => {
  emit("icon-click", !props.collapsed, props.node.path);
};

const handleBracketsClick = () => {
  emit("brackets-click", !props.collapsed, props.node.path);
};

const handleSelectedChange = () => {
  emit("selected-change", props.node);
};

const handleNodeClick = () => {
  emit("node-click", props.node);
  if (selectable.value && props.selectOnClickNode) {
    emit("selected-change", props.node);
  }
};

const handleValueEdit = (e: PointerEvent) => {
  if (!props.editable) return;
  if (!editing.value) {
    editing.value = true;
    const handle = (innerE: PointerEvent) => {
      if (
        innerE.target !== e.target &&
        (innerE.target as HTMLElement)?.parentElement !== e.target
      ) {
        editing.value = false;
        document.removeEventListener("click", handle);
      }
    };
    document.removeEventListener("click", handle);
    document.addEventListener("click", handle);
  }
};
</script>
