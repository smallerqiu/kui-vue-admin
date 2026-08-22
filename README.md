# KUI Vue Pro

基于 Vue 3、TypeScript 和 KUI Vue 的企业级后台解决方案。项目包含完整的应用外壳、权限体系和常见业务页面，可作为中后台项目的开发起点。

## 功能

- 响应式工作台、深浅主题和移动端侧栏
- 文件路由、多页签、面包屑和全局菜单搜索
- 登录、角色菜单过滤和路由权限守卫
- 订单、商品、客户、用户和角色管理
- ECharts 经营分析与访问趋势
- 通知中心、操作日志和系统设置
- Vitest 自动化测试与 GitHub Actions CI

## 技术栈

- Vue 3 + TypeScript + Vite
- KUI Vue + KUI Icons
- Pinia + Vue Router
- ECharts + Vue ECharts
- Vitest + jsdom

## 本地开发

```bash
git clone https://github.com/smallerqiu/kui-vue-admin.git
cd kui-vue-admin
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

演示账号：`admin@k-ui.cn` / `123456`。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VITE_APP_NAME` | `KUI Vue Pro` | 应用完整名称 |
| `VITE_APP_SHORT_NAME` | `KUI Pro` | 侧栏简称 |
| `VITE_APP_DESCRIPTION` | - | 应用描述 |
| `VITE_API_BASE_URL` | `/api` | API 请求前缀或完整地址 |
| `VITE_SITE_URL` | `https://admin.k-ui.cn` | 部署地址 |

## 质量检查

```bash
pnpm typecheck
pnpm test
pnpm build
```

也可运行 `pnpm check` 同时执行类型检查和测试。

## 部署

构建产物位于 `dist`：

```bash
pnpm build
```

仓库提供了 [Dockerfile](./Dockerfile) 和 [Nginx 配置](./deploy/nginx.conf)。Nginx 已包含 SPA history fallback；部署时请将 `/api/` 的上游地址替换为实际后端服务。
