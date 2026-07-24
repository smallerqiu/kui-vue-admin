<template>
  <div
    ref="tree"
    :class="{
      'vjs-tree': true,
      'is-virtual': virtual,
    }"
    @scroll="virtual ? handleTreeScroll() : undefined"
    :style="
      showLineNumber
        ? {
            paddingLeft: `${Number(originFlatData.length.toString().length) * 12}px`,
          }
        : {}
    "
  >
    <div class="vjs-tree-list" :style="virtual && { height: `${height}px` }">
      <div
        class="vjs-tree-list-holder"
        :style="virtual && { height: `${flatData.length * itemHeight}px` }"
      >
        <div
          class="vjs-tree-list-holder-inner"
          :style="virtual && { transform: `translateY(${translateY}px)` }"
        >
          <JsonViewNode
            v-for="item in visibleData"
            :key="item.id"
            :node="item"
            :collapsed="!!hiddenPaths[item.path]"
            :show-double-quotes="showDoubleQuotes"
            :show-length="showLength"
            :collapsed-on-click-brackets="collapsedOnClickBrackets"
            :checked="selectedPaths.includes(item.path)"
            :selectable-type="selectableType"
            :show-line="showLine"
            :show-line-number="showLineNumber"
            :show-select-controller="showSelectController"
            :select-on-click-node="selectOnClickNode"
            :node-selectable="nodeSelectable"
            :highlight-selected-node="highlightSelectedNode"
            :show-icon="showIcon"
            :show-key-value-space="showKeyValueSpace"
            :editable="editable"
            :editable-trigger="editableTrigger"
            @node-click="handleNodeClick"
            @brackets-click="handleBracketsClick"
            @icon-click="handleIconClick"
            @selected-change="handleSelectedChange"
            @value-change="handleValueChange"
            :style="itemHeight && itemHeight !== 20 ? { lineHeight: `${itemHeight}px` } : {}"
          >
            <template #key="slotProps">
              <slot name="nodeKey" :node="slotProps.node" :defaultKey="slotProps.defaultKey" />
            </template>

            <template #value="slotProps">
              <slot
                name="nodeValue"
                :node="slotProps.node"
                :defaultValue="slotProps.defaultValue"
              />
            </template>
          </JsonViewNode>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import JsonViewNode from "./json-view-node.vue";
import "./styles/json-view.less";
import { cloneDeep, jsonFlatten } from "./utils";

const emit = defineEmits([
  "update:selectedValue",
  "selected-change",
  "node-click",
  "brackets-click",
  "icon-click",
  "input",
]);

const props = defineProps({
  collapsedNodeLength: {
    type: Number,
    default: Infinity,
  },
  data: {
    type: [String, Number, Boolean, Array, Object],
    default: null,
  },
  deep: {
    type: Number,
    default: Infinity,
  },
  rootPath: {
    type: String,
    default: "root",
  },
  virtual: {
    type: Boolean,
    default: false,
  },
  height: {
    type: Number,
    default: 400,
  },
  itemHeight: {
    type: Number,
    default: 20,
  },
  showLength: {
    type: Boolean,
    default: false,
  },
  showDoubleQuotes: {
    type: Boolean,
    default: true,
  },
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
  selectedValue: {
    type: [Array, String],
    default: () => "",
  },
  nodeSelectable: {
    type: Function,
    default: () => true,
  },
  highlightSelectedNode: {
    type: Boolean,
    default: true,
  },
  collapsedOnClickBrackets: {
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

const translateY = ref(0);
const visibleData = ref();

const originFlatData = computed(() => {
  return jsonFlatten(props.data, props.rootPath);
});

const initHiddenPaths = (originFlatData: any[], deep: number, collapsedNodeLength: number) => {
  return originFlatData.reduce((acc, item) => {
    const doCollapse = item.level >= deep || item.length >= collapsedNodeLength;
    if ((item.type === "objectStart" || item.type === "arrayStart") && doCollapse) {
      return {
        ...acc,
        [item.path]: 1,
      };
    }
    return acc;
  }, {});
};

const hiddenPaths = ref(
  initHiddenPaths(jsonFlatten(props.data, props.rootPath), props.deep, props.collapsedNodeLength)
);

const flatData = computed(() => {
  const originFlatDataValue = originFlatData.value;
  const hiddenPathsValue = hiddenPaths.value;

  let startHiddenItem = null;
  const data = [];
  const length = originFlatDataValue.length;
  for (let i = 0; i < length; i++) {
    const cur = originFlatDataValue[i];
    const item = {
      ...cur,
      id: i,
    };
    const isHidden = hiddenPathsValue[item.path];
    if (startHiddenItem && startHiddenItem.path === item.path) {
      const isObject = startHiddenItem.type === "objectStart";
      const mergeItem = {
        ...item,
        ...startHiddenItem,
        showComma: item.showComma,
        content: isObject ? "{...}" : "[...]",
        type: isObject ? "objectCollapsed" : "arrayCollapsed",
      };
      startHiddenItem = null;
      data.push(mergeItem);
    } else if (isHidden && !startHiddenItem) {
      startHiddenItem = item;
      continue;
    } else {
      if (startHiddenItem) continue;
      else data.push(item);
    }
  }
  return data;
});

const selectedPaths = computed({
  get() {
    const value = props.selectedValue;
    if (value && props.selectableType === "multiple" && Array.isArray(value)) {
      return value;
    }
    return [value];
  },
  set(val) {
    emit("update:selectedValue", val);
  },
});

const propsError = computed(() => {
  const error = props.selectableType && !props.selectOnClickNode && !props.showSelectController;
  return error
    ? "When selectableType is not null, selectOnClickNode and showSelectController cannot be false at the same time, because this will cause the selection to fail."
    : "";
});

const updateVisibleData = (flatDataValue: any[]) => {
  if (props.virtual) {
    const visibleCount = props.height / props.itemHeight;
    const scrollTop = (treeRef.value && (treeRef.value as HTMLElement).scrollTop) || 0;
    const scrollCount = Math.floor(scrollTop / props.itemHeight);
    let start =
      scrollCount < 0
        ? 0
        : scrollCount + visibleCount > flatDataValue.length
          ? flatDataValue.length - visibleCount
          : scrollCount;
    if (start < 0) {
      start = 0;
    }
    const end = start + visibleCount;
    translateY.value = start * props.itemHeight;
    visibleData.value = flatDataValue.filter((_, index) => index >= start && index < end);
  } else {
    visibleData.value = flatDataValue;
  }
};

const handleTreeScroll = () => {
  updateVisibleData(flatData.value);
};

const handleSelectedChange = ({ path }: any) => {
  const type = props.selectableType;
  if (type === "multiple") {
    const index = selectedPaths.value.findIndex((item) => item === path);
    const oldVal = [...selectedPaths.value];
    if (index !== -1) {
      selectedPaths.value.splice(index, 1);
    } else {
      selectedPaths.value.push(path);
    }
    emit("selected-change", selectedPaths.value, oldVal);
  } else if (type === "single") {
    if (selectedPaths.value[0] !== path) {
      const [oldVal] = selectedPaths.value;
      const newVal = path;
      selectedPaths.value = newVal;
      emit("selected-change", newVal, oldVal);
    }
  }
};

const handleNodeClick = (node: any) => {
  emit("node-click", node);
};

const updateCollapsedPaths = (collapsed: boolean, path: string) => {
  if (collapsed) {
    hiddenPaths.value = {
      ...hiddenPaths.value,
      [path]: 1,
    };
  } else {
    const newPaths = { ...hiddenPaths.value };
    delete newPaths[path];
    hiddenPaths.value = newPaths;
  }
};

const handleBracketsClick = (collapsed: boolean, path: string) => {
  if (props.collapsedOnClickBrackets) {
    updateCollapsedPaths(collapsed, path);
  }
  emit("brackets-click", collapsed);
};

const handleIconClick = (collapsed: boolean, path: string) => {
  updateCollapsedPaths(collapsed, path);
  emit("icon-click", collapsed);
};

const handleValueChange = (value: any, path: string) => {
  const newData = cloneDeep(props.data);
  const rootPath = props.rootPath;
  new Function("data", "val", `data${path.slice(rootPath.length)}=val`)(newData, value);
  emit("input", newData);
};

const treeRef = ref(null);

watch(
  () => propsError.value,
  (message) => {
    if (message) {
      throw new Error(`[VueJsonPretty] ${message}`);
    }
  },
  { immediate: true }
);

watch(
  () => flatData.value,
  (val) => {
    updateVisibleData(val);
  },
  { immediate: true }
);

watch(
  () => props.deep,
  (val) => {
    hiddenPaths.value = initHiddenPaths(originFlatData.value, val, props.collapsedNodeLength);
  }
);

watch(
  () => props.collapsedNodeLength,
  (val) => {
    hiddenPaths.value = initHiddenPaths(originFlatData.value, props.deep, val);
  }
);
</script>
