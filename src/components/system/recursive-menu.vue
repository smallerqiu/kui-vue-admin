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
import * as kuiIcons from "kui-icons";
import type { IconType, MenuOptionsProps } from "kui-vue";
import { inject, onMounted, ref, type PropType } from "vue";
import RecursiveMenu from "./recursive-menu.vue";
const $t = inject<(key: string) => string>("$t", (key: string) => key);
const icons = ref<Record<string, IconType[]>>(kuiIcons);
const props = defineProps({
  item: Object as PropType<MenuOptionsProps>,
  isPopup: Boolean,
});

const menu = ref<MenuOptionsProps>();
const menuItem = ref<Record<string, any>>();
const item = props.item as MenuOptionsProps;

onMounted(() => {
  const { children } = item;
  if (children) {
    const showChildren = children.filter((x: any) => !x.hidden && x.meta);
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
