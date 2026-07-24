<template>
  <Layout class="layout-back">
    <Sider :routes="routes" :collapsed="collapsed" :activeMenu="activeMenu" />
    <Content class="k-sys-main">
      <Flex class="header-nav" vertical>
        <Flex class="top-nav" justify="space-between">
          <Space>
            <Button
              :icon="!collapsed ? PanelLeftClose : PanelRightClose"
              @click="toggle"
              size="small"
            ></Button>
            <ButtonGroup>
              <Button
                size="small"
                :icon="ChevronLeft"
                @click="router.back"
              ></Button>
              <Button
                size="small"
                :icon="ChevronRight"
                @click="router.forward"
              ></Button>
            </ButtonGroup>
            <Breadcrumb>
              <BreadcrumbItem
                v-for="item in Breadcrumbs"
                :icon="icons[item?.meta?.icon]"
              >
                {{ $t(`route.${item.path}`) || item?.meta?.title }}
              </BreadcrumbItem>
            </Breadcrumb>
          </Space>
          <Space :size="10">
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
</template>
<script setup lang="ts">
import Sider from "@/components/system/sider.vue";
import Main from "@/components/system/sys-main.vue";
import Tab from "@/components/system/tab.vue";
import Theme from "@/components/system/theme.vue";
import { useTabViewsStore } from "@/stores/tabs.ts";
import { useThemeStore } from "@/stores/theme.ts";
import * as kuiIcons from "kui-icons";
import {
  ChevronLeft,
  ChevronRight,
  Languages,
  Moon,
  PanelLeftClose,
  PanelRightClose,
  Sun,
} from "kui-icons";
import { theme, type IconType } from "kui-vue";
import { computed, inject, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
const icons = ref<Record<string, IconType[]>>(kuiIcons);
const themeStore = useThemeStore();
const tabViewsStore = useTabViewsStore();
const route = useRoute();
const router = useRouter();

const localTheme = computed(() => themeStore.theme);
const $t = inject<(key: string) => string>("$t", (key: string) => key);
const changeLang = inject<() => void>("changeLang");
const collapsed = ref(false);
const routes = computed(() => tabViewsStore.routes);

const user = ref(JSON.parse(localStorage.getItem("user_info") || "{}"));

const localCollapsed = computed(
  () => localStorage.getItem("collapsed") === "1",
);
const Breadcrumbs = ref<any[]>([]);
onMounted(() => {
  collapsed.value = localCollapsed.value;
});
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
  () => route.fullPath,
  () => {
    const keys = getPath(routes.value, route.path);
    activeMenu.value = keys;
  },
);
const toggle = () => {
  collapsed.value = !collapsed.value;
  localStorage.setItem("collapsed", collapsed.value ? "1" : "0");
};
const logout = () => {
  // 退出登录
  localStorage.removeItem("token");
  localStorage.removeItem("user_info");
  router.push({ path: "/account/login" });
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
</style>
