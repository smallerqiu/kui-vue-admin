# create-kui-vue-pro

Create a KUI Vue Pro administration project from Git. Requires Git and repository access. The npm package contains only the CLI, not a separate template copy.

```bash
npm create kui-vue-pro@latest my-app
cd my-app
npm install
npm run dev
```

Also supports `pnpm create kui-vue-pro my-app` and `yarn create kui-vue-pro my-app`.

By default, the CLI fetches the repository's default branch. Select a branch or tag with `--ref`, or use a compatible fork with `--repo`:

```bash
npm create kui-vue-pro@latest my-app -- --ref main
npm create kui-vue-pro@latest my-app -- --repo https://github.com/your-org/kui-vue-admin.git
```

The destination must be empty. Dependency versions and the lockfile are preserved. Git history, repository workflows, CLI packages, build artifacts and `.env` secrets are excluded; `.env.example` is included. Dependencies are not installed automatically. Follow the generated README to configure the backend.

- Documentation: <https://vue.k-ui.cn/guide/pro>
- Online preview: <https://admin.k-ui.cn>
- Source: <https://github.com/smallerqiu/kui-vue-admin>
