<template>
  <SubMenu
    v-if="visibleChildren.length"
    :key="item.key"
    :title="$t(`route.${item.key}`) || item.meta.title"
    :icon="item.meta.icon ? icons[item.meta.icon] : undefined"
  >
    <RecursiveMenu
      :item="data"
      :key="data.key"
      v-for="data in visibleChildren"
    />
  </SubMenu>
  <MenuItem
    :key="item.path"
    :icon="item.meta.icon ? icons[item.meta.icon] : undefined"
    v-else
  >
    {{ $t(`route.${item.key}`) || item.meta.title }}
  </MenuItem>
</template>

<script setup lang="ts">
import { useTranslate } from "@/lang/useTranslate.ts";
import * as kuiIcons from "kui-icons";
import type { IconType } from "kui-vue";
import { computed, ref, type PropType } from "vue";
import RecursiveMenu from "./recursive-menu.vue";
import type { AdminMenuItem } from "./useMenu";

const $t = useTranslate();
const icons = ref<Record<string, IconType[]>>(kuiIcons);
const props = defineProps({
  item: { type: Object as PropType<AdminMenuItem>, required: true },
});
const item = props.item;
const visibleChildren = computed(() => item.children || []);
</script>
