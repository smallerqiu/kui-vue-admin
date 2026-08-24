<template>
  <Modal
    v-model="visible"
    :footer="false"
    :show-close="false"
    :width="600"
    centered
    class="command-modal"
  >
    <div class="command-search">
      <Icon :type="Search" />
      <input
        ref="inputRef"
        v-model="keyword"
        role="combobox"
        aria-controls="command-results"
        :aria-activedescendant="results[activeIndex] ? `command-result-${activeIndex}` : undefined"
        placeholder="搜索菜单或页面…"
        @keydown="handleKeydown"
      />
      <kbd>ESC</kbd>
    </div>
    <div id="command-results" class="command-results" role="listbox">
      <button
        v-for="(item, index) in results"
        :id="`command-result-${index}`"
        ref="resultRefs"
        :key="item.path"
        type="button"
        role="option"
        :aria-selected="index === activeIndex"
        :class="{ active: index === activeIndex }"
        @mouseenter="activeIndex = index"
        @click="go(item.path)"
      >
        <span class="result-icon"><Icon :type="item.icon || File" /></span>
        <span>
          <strong>{{ item.title }}</strong>
          <small>{{ item.parents.join(" / ") || "首页" }}</small>
        </span>
        <Icon :type="CornerDownLeft" />
      </button>
      <Empty v-if="!results.length" description="没有找到匹配页面" />
    </div>
    <Flex class="command-help" justify="space-between">
      <Space>
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd>
          选择
        </span>
        <span>
          <kbd>↵</kbd>
          打开
        </span>
      </Space>
      <span>仅展示当前角色可访问页面</span>
    </Flex>
  </Modal>
</template>

<script setup lang="ts">
import type { AdminMenuItem } from "@/components/system/useMenu";
import { CornerDownLeft, File, Search } from "kui-icons";
import type { IconType } from "kui-vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

interface SearchItem {
  title: string;
  path: string;
  parents: string[];
  icon?: IconType[];
}
const props = defineProps<{
  routes: AdminMenuItem[];
  icons: Record<string, IconType[]>;
}>();
const router = useRouter();
const visible = ref(false);
const keyword = ref("");
const activeIndex = ref(0);
const inputRef = ref<HTMLInputElement>();
const resultRefs = ref<HTMLButtonElement[]>([]);
const flatten = (items: AdminMenuItem[], parents: string[] = []): SearchItem[] =>
  items.flatMap((item) => {
    const current = {
      title: item.meta.title,
      path: item.path,
      parents,
      icon: item.meta.icon ? props.icons[item.meta.icon] : undefined,
    };
    return item.children?.length
      ? [current, ...flatten(item.children, [...parents, item.meta.title])]
      : [current];
  });
const allItems = computed(() =>
  flatten(props.routes).filter((item) => item.path && item.path !== "/"),
);
const results = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return (
    query
      ? allItems.value.filter((item) =>
          `${item.title} ${item.parents.join(" ")} ${item.path}`.toLowerCase().includes(query),
        )
      : allItems.value
  ).slice(0, 10);
});
const scrollToActive = () =>
  nextTick(() => resultRefs.value[activeIndex.value]?.scrollIntoView({ block: "nearest" }));
watch(results, () => {
  activeIndex.value = 0;
  scrollToActive();
});
watch(activeIndex, scrollToActive);
watch(visible, (opened) => {
  if (opened) nextTick(() => inputRef.value?.focus());
  else keyword.value = "";
});
const open = () => {
  visible.value = true;
};
const go = (path: string) => {
  visible.value = false;
  router.push(path);
};
const handleKeydown = (event: KeyboardEvent) => {
  const count = results.value.length;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    event.stopPropagation();
    if (count) activeIndex.value = (activeIndex.value + 1) % count;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    event.stopPropagation();
    if (count) activeIndex.value = (activeIndex.value - 1 + count) % count;
  }
  if (event.key === "Enter" && results.value[activeIndex.value]) {
    event.preventDefault();
    event.stopPropagation();
    go(results.value[activeIndex.value].path);
  }
  if (event.key === "Escape") visible.value = false;
};
const handleShortcut = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    open();
  }
};
onMounted(() => window.addEventListener("keydown", handleShortcut));
onBeforeUnmount(() => window.removeEventListener("keydown", handleShortcut));
defineExpose({ open });
</script>

<style lang="less">
.command-modal .k-modal-body {
  padding: 0;
}
.command-search {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--kui-color-border);
  font-size: 18px;
}
.command-search input {
  width: 100%;
  color: var(--kui-color-text);
  font: inherit;
  font-size: 16px;
  border: 0;
  outline: 0;
  background: transparent;
}
.command-search kbd,
.command-help kbd {
  padding: 2px 6px;
  color: var(--kui-color-text-description);
  border: 1px solid var(--kui-color-border);
  border-radius: 4px;
  background: var(--kui-color-bg-component);
  font: inherit;
  font-size: 11px;
}
.command-results {
  max-height: min(420px, 60vh);
  padding: 8px;
  overflow: auto;
}
.command-results > button {
  display: grid;
  width: 100%;
  grid-template-columns: auto 1fr auto;
  gap: 11px;
  align-items: center;
  padding: 10px;
  color: var(--kui-color-text);
  text-align: left;
  border: 0;
  border-radius: var(--kui-control-radius);
  background: transparent;
  cursor: pointer;
}
.command-results > button.active {
  color: var(--kui-color-primary);
  background: var(--kui-color-item-selected);
  box-shadow: inset 3px 0 var(--kui-color-primary);
}
.command-results > button > span:nth-child(2) {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.command-results small {
  color: var(--kui-color-text-description);
}
.command-results > button > .k-icon {
  color: var(--kui-color-icon);
}
.result-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  color: var(--kui-color-primary);
  border-radius: var(--kui-control-radius);
  background: var(--kui-theme-fill-bg);
}
.command-help {
  padding: 10px 16px;
  color: var(--kui-color-text-description);
  border-top: 1px solid var(--kui-color-border);
  font-size: 11px;
}
</style>
