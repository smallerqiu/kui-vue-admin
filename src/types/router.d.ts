import "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    title?: string;
    icon?: string;
    order?: number;
    showInMenu?: boolean;
    roles?: string[];
    activeMenu?: string; // 用于高亮非菜单页面的父级菜单
  }
}
