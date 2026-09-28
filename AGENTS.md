## Kui Vue

- This project uses Vue 3 and Kui Vue. Prefer components and public APIs documented at https://k-ui.cn.
- Import components from `kui-vue` and icons from `kui-icons`; import `kui-vue/style/index.css` once.
- Read `node_modules/kui-vue/ai/skills/kui-vue/SKILL.md` before changing component usage. `kui-vue/metadata` is an export, not a directory; query the installed CLI or `node_modules/kui-vue/ai/kui-components.json`. Do not invent component APIs.
- Keep `theme`, `size`, and `shape` consistent and run typecheck/lint after edits.

## Backend integration

- The paired API project is `../kui-admin-api` (Cloudoll 4.3.0 + MySQL).
- Read `docs/backend-integration.md` before migrating a page. Do not treat enabling real authentication as completion of business-page integration.
- Keep IDs, money, permissions, pagination and response types aligned with the backend schemas. Never show success before the API succeeds or silently fall back to demo data on failure.
