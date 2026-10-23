# CDPC UI 与表单库接入决策

日期：2026-10-23

## 决策摘要

- **UI 原语：继续扩展 Radix UI + Lucide React + 现有 CDPC 设计令牌。**
- **不引入 Mantine 作为第二套完整 UI 体系。**
- **复杂表单：React Hook Form + Zod + `@hookform/resolvers`。**
- **浏览器回归：Playwright。**
- 以上是代码与依赖层面的接入方案；只有 CI 成功后，才算完成验证。

## 代码盘点证据

- `src/AiSkinStudio.tsx` 已直接使用 `@radix-ui/react-tabs` 与 `@radix-ui/react-select`。
- `src/main.tsx` 加载 `src/styles.css` 和 `src/design-system.css`；设计系统已有颜色/边框等 CDPC token 与响应式编辑器 chrome。
- Next.js 有独立的 `app/next.css` 与共享导航 `app/components/site-nav.tsx`。
- `app/login/login-form.tsx` 与 `app/register/page.tsx` 原本大量使用手写 `useState` / 表单提交处理。
- `tests/unit/ui-design-system.test.ts` 已对共享 token、导航、无障碍焦点和窄屏规则进行静态回归检查。
- `tests/e2e/security.e2e.test.mjs` 是 Node `fetch` 请求级安全测试，不是浏览器自动化。

## 为什么继续使用 Radix

1. AI 创作模块已依赖 Radix Tabs 和 Select；整套切换会引入额外迁移和回归风险。
2. 现有 CSS 已形成两端各自的样式边界；直接叠加 Mantine 容易产生主题、间距、控件行为和打包体积的双重维护。
3. Radix 提供无样式原语，可沿用现有像素视觉风格，同时保持键盘操作、焦点和语义行为。
4. 先补齐常用原语的统一封装与导入规范；只有当现有原语无法经济满足复杂组件时，才针对单个组件做决策。

## 本批接入边界

- React Hook Form + Zod 首先用于注册表单；保留 `POST /api/register` 数据契约、服务端响应文案、默认普通用户权限，以及现有 NextAuth 认证流程。
- 客户端 schema 仅用于更早、更一致的用户反馈；服务端仍必须独立执行校验、密码处理、邮箱验证策略和限流。
- Playwright 运行真实 Chromium 浏览器，覆盖导航、登录页表单、注册字段校验、移动端横向溢出和 Vite 编辑器入口。
- 不更换 Three.js、skinview3d、Blockbench 或现有认证框架。

## 依赖安装与验收

- 根项目与 `ai-api` 各自生成独立 npm lockfile。
- 在 lockfile 落入分支后，将 CI 和 Docker 中对应的 `npm install` 改为 `npm ci`。
- 浏览器测试必须在 GitHub Actions 实际跑过；测试源码存在并不等于测试通过。
- 合并前确认单元/集成测试、生产构建、浏览器回归与 Docker smoke test 均通过；失败时先修复，不绕过检查。
