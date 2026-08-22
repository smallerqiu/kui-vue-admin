<template>
  <Layout class="layout-back">
    <div v-if="isMobile && mobileOpen" class="mobile-sider-mask" @click="mobileOpen = false"></div>
    <Sider
      :class="{ 'mobile-sider': isMobile, 'mobile-sider-open': mobileOpen }"
      :routes="routes"
      :collapsed="isMobile ? false : collapsed"
      :activeMenu="activeMenu"
      @select="mobileOpen = false"
    />
    <Content class="k-sys-main">
      <Flex class="header-nav" vertical>
        <Flex class="top-nav" justify="space-between">
          <Space class="top-nav-start">
            <Button
              :icon="isMobile ? MenuIcon : (!collapsed ? PanelLeftClose : PanelRightClose)"
              @click="toggle"
              size="small"
            />
            <Button class="command-trigger" size="small" :icon="Search" @click="commandMenuRef?.open()">
              <span>搜索</span><kbd>⌘ K</kbd>
            </Button>
            <ButtonGroup class="history-actions">
              <Button size="small" :icon="ChevronLeft" @click="router.back" />
              <Button
                size="small"
                :icon="ChevronRight"
                @click="router.forward"
              />
            </ButtonGroup>
            <Breadcrumb class="header-breadcrumb">
              <BreadcrumbItem
                v-for="item in Breadcrumbs"
                :icon="icons[item?.meta?.icon]"
              >
                {{ $t(`route.${item.path}`) || item?.meta?.title }}
              </BreadcrumbItem>
            </Breadcrumb>
          </Space>
          <Space :size="10">
            <Dropdown trigger="click" placement="bottom-right">
              <Badge :count="notificationStore.unreadCount" :max-count="99">
                <Button size="small" :icon="Bell" />
              </Badge>
              <template #overlay><NotificationPanel /></template>
            </Dropdown>
            <Tooltip :title="`${$t('menu.langTip')}`" placement="bottom">
              <Button size="small" :icon="Languages" @click="changeLang" />
            </Tooltip>
            <Button
              :icon="localTheme == 'dark' ? Sun : Moon"
              size="small"
              @click="switchMode"
            />
            <Dropdown placement="bottom-right" arrow>
              <Button size="small">
                <Avatar
                  style="background: #3a95ff"
                  :size="14"
                  :src="user.avatar"
                ></Avatar>
                <span>{{ user.fullName || "Guest" }}</span>
              </Button>
              <template #overlay>
                <Menu>
                  <MenuItem key="profile" @click="router.push('/profile')">个人中心</MenuItem>
                  <MenuItem key="logout">
                    <a href="javascript:;" @click="logout">{{
                      $t("menu.log_out")
                    }}</a>
                  </MenuItem>
                </Menu>
              </template>
            </Dropdown>
          </Space>
        </Flex>
        <Tab />
      </Flex>
      <div class="container">
        <Main />
      </div>
    </Content>
  </Layout>
  <Theme />
  <CommandMenu ref="commandMenuRef" :routes="routes" :icons="icons" />
</template>
<script setup lang="ts">
import Sider from "@/components/system/sider.vue";
import Main from "@/components/system/sys-main.vue";
import Tab from "@/components/system/tab.vue";
import Theme from "@/components/system/theme.vue";
import NotificationPanel from "@/components/system/notification-panel.vue";
import CommandMenu from "@/components/system/command-menu.vue";
import { useTranslate } from "@/lang/useTranslate.ts";
import { useTabViewsStore } from "@/stores/tabs.ts";
import { useAuthStore } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme.ts";
import { useNotificationStore } from "@/stores/notifications";
import { filterMenuByRoles } from "@/routers/permissions";
import * as kuiIcons from "kui-icons";
import {
  ChevronLeft,
  ChevronRight,
  Bell,
  Languages,
  Menu as MenuIcon,
  Search,
  Moon,
  PanelLeftClose,
  PanelRightClose,
  Sun,
} from "kui-icons";
import { theme, type IconType } from "kui-vue";
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
const icons = ref<Record<string, IconType[]>>(kuiIcons);
const themeStore = useThemeStore();
const tabViewsStore = useTabViewsStore();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const route = useRoute();
const router = useRouter();

const localTheme = computed(() => themeStore.theme);
const $t = useTranslate();
const changeLang = inject<() => void>("changeLang");
const collapsed = ref(false);
const isMobile = ref(false);
const mobileOpen = ref(false);
const commandMenuRef = ref<InstanceType<typeof CommandMenu>>();
const routes = computed(() => filterMenuByRoles(tabViewsStore.routes, authStore.roles));
const user = computed(() => authStore.user);

const localCollapsed = computed(
  () => localStorage.getItem("collapsed") === "1",
);
const Breadcrumbs = ref<any[]>([]);
onMounted(() => {
  collapsed.value = localCollapsed.value;
  mediaQuery = window.matchMedia("(max-width: 860px)");
  syncViewport(mediaQuery);
  mediaQuery.addEventListener("change", syncViewport);
});
let mediaQuery: MediaQueryList | undefined;
const syncViewport = (event: MediaQueryList | MediaQueryListEvent) => {
  isMobile.value = event.matches;
  if (!event.matches) mobileOpen.value = false;
};
onBeforeUnmount(() => mediaQuery?.removeEventListener("change", syncViewport));
const getPath = (tree: any, targetKey: string) => {
  const path: string[] = [];
  const nodePaths: string[] = [];
  const dfs = (nodes: any) => {
    if (!Array.isArray(nodes)) return false;

    for (const node of nodes) {
      path.push(node.key);
      nodePaths.push(node);
      if (node.key === targetKey) return true;

      if (dfs(node.children)) return true;

      path.pop();
      nodePaths.pop();
    }
    return false;
  };

  const found = dfs(tree);
  Breadcrumbs.value = nodePaths;
  return found ? path.slice().reverse() : [];
};

const keys = getPath(routes.value, route.path);
const activeMenu = ref(keys);

watch(
  [() => route.fullPath, routes],
  () => {
    const keys = getPath(routes.value, route.path);
    activeMenu.value = keys;
    if (isMobile.value) mobileOpen.value = false;
  },
);
const toggle = () => {
  if (isMobile.value) {
    mobileOpen.value = !mobileOpen.value;
    return;
  }
  collapsed.value = !collapsed.value;
  localStorage.setItem("collapsed", collapsed.value ? "1" : "0");
};
const logout = () => {
  router.push("/account/logout");
};

const switchMode = (event: MouseEvent) => {
  theme.setThemeMode(event, (isDark: boolean) => {
    themeStore.setTheme(isDark ? "dark" : "light");
  });
};
</script>

<style lang="less">
.layout-back {
  .container {
    padding: 7px 10px 10px 10px;
  }
  .top-nav {
    padding: 10px 0 10px 0;
    gap: 12px;
  }

  .command-trigger {
    min-width: 150px;
    justify-content: flex-start;
    color: var(--kui-color-text-description);

    kbd { margin-left: auto; color: var(--kui-color-text-placeholder); font: inherit; font-size: 11px; }
  }

  .header-nav {
    padding: 0px 10px 4px 10px;
    position: sticky;
    top: 0;
    z-index: 1001;
    background-color: var(--kui-color-bg);
  }

  .k-sys-main .nav {
    padding: 16px 0 0 16px;
  }

  .if-top-menu {
    line-height: 61px;
  }

  .k-sys-main {
    display: flex;
    flex-direction: column;
    // overflow: hidden;
  }
  .k-layout-sider {
    position: sticky;
    top: 10px;
    height: calc(100vh - 20px);
    box-sizing: border-box;
    overflow: hidden;
  }

  .k-layout-footer {
    text-align: center;
    color: #999;
  }
}

.mobile-sider-mask {
  position: fixed;
  z-index: 1100;
  inset: 0;
  background: var(--kui-color-mask);
  animation: mobile-mask-in var(--kui-motion-duration-fast);
}

@keyframes mobile-mask-in { from { opacity: 0; } }

@media (max-width: 860px) {
  .layout-back {
    .mobile-sider {
      position: fixed;
      z-index: 1101;
      top: 0;
      bottom: 0;
      left: 0;
      width: min(280px, calc(100vw - 52px));
      height: 100vh;
      margin: 0;
      border-width: 0 1px 0 0;
      border-radius: 0 var(--kui-card-radius) var(--kui-card-radius) 0;
      transform: translateX(-105%);
      transition: transform var(--kui-motion-duration) var(--kui-motion-easing);
      box-shadow: var(--kui-pop-shadow);
    }

    .mobile-sider-open { transform: translateX(0); }
    .header-nav { padding: 0 8px 4px; }
    .container { padding: 6px 4px 10px; }
    .history-actions, .header-breadcrumb { display: none; }
    .command-trigger { min-width: auto; }
    .command-trigger span, .command-trigger kbd { display: none; }
    .top-nav-start { min-width: 0; }
    .top-nav .k-space:last-child > .k-tooltip:first-child { display: none; }
    .top-nav .k-avatar + span { display: none; }
  }
}
</style>
