<template>
  <SubMenu
    v-if="menu"
    :key="item.key"
    :title="$t(`route.${item.key}`) || item.meta.title"
    :icon="icons[item.meta.icon]"
    :isPopup="isPopup"
  >
    <RecursiveMenu :item="data" :key="item.key" v-for="data in item.children" />
  </SubMenu>
  <MenuItem
    :key="menuItem.key"
    :icon="icons[menuItem.meta.icon]"
    :isPopup="isPopup"
    v-else-if="menuItem"
  >
    {{ $t(`route.${menuItem.key}`) || menuItem.meta.title }}
  </MenuItem>
</template>

<script setup lang="ts">
import { useTranslate } from "@/lang/useTranslate.ts";
import * as kuiIcons from "kui-icons";
import type { IconType, MenuOptionsProps } from "kui-vue";
import { onMounted, ref, type PropType } from "vue";
import RecursiveMenu from "./recursive-menu.vue";

type MenuItem = Omit<MenuOptionsProps, "children" | "key" | "meta" | "path"> & {
  children?: MenuItem[];
  key: string;
  meta: {
    title: string;
    icon: string;
  };
  path: string;
  hidden?: boolean;
};

const $t = useTranslate();
const icons = ref<Record<string, IconType[]>>(kuiIcons);
const props = defineProps({
  item: Object as PropType<MenuItem>,
  isPopup: Boolean,
});

const menu = ref<MenuItem>();
const menuItem = ref<MenuItem>();
const item = props.item as MenuItem;

onMounted(() => {
  const { children } = item;
  if (children) {
    const showChildren = children.filter((x) => !x.hidden && x.meta);
    if (showChildren.length > 1) {
      menu.value = item;
    } else if (showChildren.length === 1) {
      const child = { ...showChildren[0] };
      child.key = child.path;
      child.path = item.path ? item.path + "/" + child.path : child.path;
      menuItem.value = child;
    } else if (!item.hidden) {
      menuItem.value = item;
    }
  } else if (!item.hidden) {
    menuItem.value = item;
  }
});
</script>
