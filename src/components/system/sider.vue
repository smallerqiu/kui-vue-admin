<template>
  <Sider
    :class="['sys-sider', { 'sys-sider-collapsed': collapsed && !top, 'sys-sider-top': top }]"
    :collapsible="!top"
    :collapsed="top ? false : collapsed"
    :width="200"
    :collapsed-width="60"
  >
    <div class="logo-box">
      <img src="/favicon.svg" class="logo" />
      <transition name="sys-sider-title">
        <span class="sys-sider-title" v-show="top || !collapsed">
          {{ systemSettings.settings.shortName }}
        </span>
      </transition>
    </div>
    <Menu
      class="sys-menu"
      :model-value="props.activeMenu || []"
      @openChange="openChange"
      :openKeys="menuOpenKeys"
      :inlineCollapsed="top ? false : collapsed"
      style="border: none"
      @select="go"
      :mode="top ? 'horizontal' : 'inline'"
    >
      <RecursiveMenu v-for="item in routes" :item="item" :key="item.key" />
      <!-- <MenuItem v-for="route in routes" :route="route" :key="route.key" /> -->
    </Menu>
    <div class="app-version" :class="{ collapsed: collapsed && !top }">
      {{ collapsed && !top ? "1.0" : `Version ${appConfig.version}` }}
    </div>
  </Sider>
</template>
<script setup lang="ts">
import type { MenuSelectEvent } from "kui-vue";
import { computed, ref, type PropType } from "vue";
import { useRouter } from "vue-router";
import RecursiveMenu from "./recursive-menu.vue";
import type { AdminMenuItem } from "./useMenu";
import { useSystemSettingsStore } from "@/stores/system-settings";
import { appConfig } from "@/config/app";

const router = useRouter();
const systemSettings = useSystemSettingsStore();
const emit = defineEmits<{ select: [] }>();
const props = defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  },
  top: Boolean,
  activeMenu: Array as PropType<string[]>,
  routes: {
    type: Array as PropType<AdminMenuItem[]>,
    default: () => [],
  },
});
const routes = computed(() => props.routes);

const localOpenKeys = localStorage.getItem("openKeys");
const defaultOpenKeys = JSON.parse(localOpenKeys || "[]");
const openKeys = ref(defaultOpenKeys);
const emptyOpenKeys: string[] = [];
const menuOpenKeys = computed(() => (props.top ? emptyOpenKeys : openKeys.value));

const openChange = (keys: string[]) => {
  // Horizontal submenus are transient popups. Do not persist their hover state
  // or reuse the inline sidebar's expanded groups as active top-level items.
  if (props.top) return;
  localStorage.setItem("openKeys", JSON.stringify(keys));
  openKeys.value = keys;
};

const isOutPath = (path: string) => {
  return /^(https?:|mailto:|tel:)/.test(path);
};

const go = (event: MenuSelectEvent) => {
  if (isOutPath(event.key)) {
    return window.open(event.key);
  }
  router.push({ path: event.key });
  emit("select");
};
</script>
<style lang="less">
.sys-sider {
  left: 0;
  position: relative;
  border: 1px solid var(--kui-color-border);
  transition:
    width 0.3s ease,
    min-width 0.3s ease,
    max-width 0.3s ease,
    flex-basis 0.3s ease;
  display: flex;
  flex-direction: column;
  margin: 10px;
  border-radius: 16px;
  background-color: var(--kui-color-bg-component);

  .logo-box {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    padding: 10px;
    // background: var(--kui-color-bg);
    white-space: nowrap;
    overflow: hidden;

    .logo {
      transition: margin 300ms ease 300ms;
      width: 32px;
      height: 32px;
    }

    .sys-sider-title {
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      margin-left: 8px;
      width: calc(100% - 70px);
      font-weight: bold;
    }
  }

  .sider-bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    padding: 4px 4px;
    width: 100%;
    box-sizing: border-box;
    -webkit-backdrop-filter: blur(20px);
    backdrop-filter: blur(20px);

    .k-btn {
      width: 100%;
    }
  }

  .sys-menu {
    overflow: auto;
    flex: 1;
    background: none;
    .k-menu {
      background: none;
    }
    &::-webkit-scrollbar {
      width: 1px;
    }

    a {
      margin: 0;
      padding: 0;
      width: 100%;
    }
  }
  .app-version {
    padding: 10px;
    color: var(--kui-color-text-placeholder);
    font-size: 11px;
    text-align: center;
    border-top: 1px solid var(--kui-color-border);
  }
}

@keyframes sys-sider-title {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
    width: 0;
  }
}

.sys-sider-title-enter-active {
  transform-origin: 0% 0%;
  animation: sys-sider-title 0.3s reverse;
}

.sys-sider-title-leave-active {
  transform-origin: 0% 0%;
  animation: sys-sider-title 0.3s;
}

.sys-sider-collapsed {
  // Compatible with kui-vue versions whose Sider width was not reactive.
  width: 60px !important;
  min-width: 60px !important;
  max-width: 60px !important;
  flex-basis: 60px !important;

  .logo-box {
    padding-left: calc(50% - 16px);
    transition: padding 0.2s ease-in-out 0.2s;
  }
}

.sys-sider-top {
  width: calc(100% - 20px) !important;
  min-width: 0 !important;
  max-width: none !important;
  height: 64px !important;
  min-height: 64px !important;
  max-height: 64px !important;
  flex: 0 0 64px !important;
  flex-direction: row;
  align-items: center;
  overflow: visible;

  .logo-box {
    flex: 0 0 170px;
    width: 170px;
    padding: 0 14px;

    .sys-sider-title {
      width: auto;
      max-width: 112px;
    }
  }

  .sys-menu {
    flex: 1 1 auto;
    min-width: 0;
    height: 62px;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .app-version {
    flex: 0 0 auto;
    padding: 0 16px;
    border-top: 0;
    border-left: 1px solid var(--kui-color-border);
    line-height: 32px;
    white-space: nowrap;
  }
}
</style>
