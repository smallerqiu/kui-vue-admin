<template>
  <Sider :class="['sys-sider', { 'sys-sider-collapsed': collapsed }]">
    <div class="logo-box">
      <img src="/favicon.svg" class="logo" />
      <transition name="sys-sider-title">
        <span class="sys-sider-title" v-show="!collapsed">Kui Vue Admin</span>
      </transition>
    </div>
    <Menu
      class="sys-menu"
      v-model="activeMenu"
      @openChange="openChange"
      :openKeys="openKeys"
      :inlineCollapsed="collapsed"
      style="border: none"
      @select="go"
      mode="inline"
    >
      <RecursiveMenu v-for="item in routes" :item="item" :key="item.key" />
      <!-- <MenuItem v-for="route in routes" :route="route" :key="route.key" /> -->
    </Menu>
  </Sider>
</template>
<script setup lang="ts">
import type { MenuSelectEvent } from "kui-vue";
import { computed, ref, type PropType } from "vue";
import { useRouter } from "vue-router";
import RecursiveMenu from "./recursive-menu.vue";
const router = useRouter();
const props = defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  },
  activeMenu: Array as PropType<string[]>,
  routes: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
});

const activeMenu = computed(() => {
  return props.activeMenu;
});

const localOpenKeys = localStorage.getItem("openKeys");
const defaultOpenKeys = JSON.parse(localOpenKeys || "[]");
const openKeys = ref(defaultOpenKeys);

const openChange = (keys: string[]) => {
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
};
</script>
<style lang="less">
.sys-sider {
  left: 0;
  position: relative;
  border: 1px solid var(--kui-color-border);
  transition: width 0.3s ease 0s;
  width: 200px;
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
    }

    .sys-sider-title {
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      margin-left: 8px;
      width: calc(100% - 70px);
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
  width: 60px;

  .logo-box {
    padding-left: calc(50% - 16px);
    transition: padding 0.2s ease-in-out 0.2s;
  }
}
</style>
