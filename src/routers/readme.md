# 自动子路由配置指南

vue-router/vite（基于原 unplugin-vue-router 逻辑）完全支持子路由（嵌套路由）、动态路由、甚至并行路由。
它的核心机制是基于文件和目录的层级结构来自动生成嵌套的 children 路由配置。
嵌套子路由（Nested Routes）的两种配置方式
只要在 src/pages 目录下按照特定约定组织文件，它就会自动生成带 children: [...] 的路由配置。

# 方式一：文件夹同名目录法

如果想要一个父页面组件 <Layout>（带有 <router-view />），并且包含多个子页面，只需让文件夹的名称与父级页面文件名相同。
目录结构：

src/pages/
├── dashboard.vue <--- 父路由组件 (必须包含 <router-view />)
└── dashboard/ <--- 与父路由同名的文件夹
├── index.vue <--- 默认子路由路径: /dashboard
├── profile.vue <--- 子路由路径: /dashboard/profile
└── settings.vue <--- 子路由路径: /dashboard/settings

父页面组件内容 (src/pages/dashboard.vue)：
<template>

  <div class="dashboard-layout">
    <aside>侧边栏导航</aside>
    <main>
      <!-- 子路由渲染出口 -->
      <router-view />
    </main>
  </div>
</template>

自动生成的路由结构相当于：
{
path: '/dashboard',
component: () => import('src/pages/dashboard.vue'),
children: [
{ path: '', component: () => import('src/pages/dashboard/index.vue') },
{ path: 'profile', component: () => import('src/pages/dashboard/profile.vue') },
{ path: 'settings', component: () => import('src/pages/dashboard/settings.vue') }
]
}

# 方式二：使用 [id] 动态参数嵌套

如果需要做类似 /users/123/posts 的带参数子路由：
目录结构：
src/pages/
├── users/
│ ├── index.vue <--- /users (列表页)
│ ├── [id].vue <--- /users/:id (父页面组件，内含 <router-view />)
│ └── [id]/ <--- 与 [id].vue 对应的文件夹
│       ├── index.vue <--- /users/:id (默认详情)
│       └── posts.vue <--- /users/:id/posts (用户文章列表)

> 补充技巧：不影响 URL 路径的布局组 (Route Groups)

如果只是想让几个页面共享同一个 Layout，但不希望 URL 增加一层路径，可以使用小括号 (group) 文件夹语法：
目录结构：
src/pages/
├── (admin)/ <--- 用小括号包起来的文件夹，不会加到 URL 路径里
│ ├── \_layout.vue <--- 布局入口
│ ├── dashboard.vue <--- URL 是 /dashboard，而不是 /(admin)/dashboard
│ └── users.vue <--- URL 是 /users
