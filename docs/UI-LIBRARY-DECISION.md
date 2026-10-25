# CDPC UI 技术栈决策（更新版）

日期：2026-10-23  
适用范围：Next.js 主站与 Vite 创作工坊  
状态：分阶段迁移；以每个 PR 的锁文件、构建与回归结果为准。

## 用户确认的目标技术栈

- **Mantine**：主要通用交互组件，包括表单控件、弹窗、抽屉、通知、菜单、标签页、表格和加载状态。
- **Tailwind CSS v4**：布局、响应式、间距、网格与页面级样式。先在明确边界内接入，避免和既有 CSS 全局冲突。
- **shadcn/ui**：作为精选的补充组件来源，优先考虑 Command、需要 Radix 的定制菜单等。不得将所有组件无差别复制进项目。
- **Lucide React**：统一图标。
- **React Hook Form + Zod**：复杂表单校验；保留服务端校验与既有 API 契约。
- **Playwright**：浏览器级回归测试。

## 迁移原则

1. 不在一个 PR 内无差别替换全站所有控件。
2. 先检查根目录与 `ai-api` 的包管理和锁文件；两者保持独立、可重复安装。
3. Tailwind CSS v4 使用对应的 Vite 或 PostCSS 集成方式，确认与 Next.js、Vite 双入口的兼容性后再落地。
4. Mantine 主题与 CSS reset 必须明确加载位置，避免覆盖皮肤编辑器画布和 Blockbench iframe 外壳。
5. shadcn/ui 仅在有明确场景时加入；同类控件确定单一默认实现，避免维护两套按钮、表单或弹窗。
6. UI 迁移不得修改 NextAuth、OAuth 回调、数据模型或导出协议，除非另有独立修复任务。
7. 每一阶段运行 TypeScript、测试、Next.js 构建、Vite 构建及可执行的浏览器测试；未执行的项目标记为未验证。

## 实施顺序

1. 统一全站导航、按钮语义和响应式布局。
2. 独立衣服选装入口已连接项目现有 skinview3d 和已知披肩/外套/披风素材；尚未接入的服装分类必须保持不可用状态。
3. 以 Mantine 迁移登录/注册和设置表单作为首个组件试点。
4. 建立 Tailwind CSS v4 token/布局约定，并逐页迁移。
5. 在明确场景引入 shadcn/ui 组件。
6. 创作工坊、AI、素材库、社区与后台逐模块迁移。
7. 认证、导入导出、穿搭保存、移动端与生产镜像全量回归。

## 本次实现边界

本分支已建立独立衣服选装页面，并将已知披肩、外套和披风素材接入 skinview3d 实时预览，支持本地 64×64 PNG 导入、Steve/Alex 模型、旋转/缩放和背景色调整。上衣、裤子、鞋子和帽子当前没有确认可用的正式素材，页面明确显示尚未接入。穿搭持久化和本页导出仍未实现。Mantine 与 Tailwind CSS v4 的依赖及锁文件已在迁移分支接入；登录/注册已开始使用 Mantine 控件，Next.js 与 Vite 入口均已接入 Provider 和 Tailwind utilities。双入口构建与浏览器回归仍待当前 PR 的 GitHub Actions 结果确认。

## Phase 2 implementation — shared account form primitives

Date: 2026-10-25

Implemented on branch `feat/cdpc-ui-phase2-design-tokens`:
- Added semantic control tokens for consistent height, radius, borders, and focus treatment.
- Standardized login/register input sizing, placeholder contrast, validation borders, primary/provider button states, magic-link disclosure, and mobile full-width behavior.
- Added consistent provider-group spacing and distinct error/success feedback surfaces.
- Added regression assertions for shared tokens, login/register controls, provider buttons, and feedback states.
- Added reduced-motion handling to account-page interactions.
- Kept styles scoped to `.cdpc-page` so the skin editor canvas and Blockbench surface are not affected.

Validation boundary:
- This phase is the shared CSS primitive implementation using existing class names; it is not a Mantine or Tailwind CSS v4 migration. The regression test is committed with the phase and must pass in CI before merge.
- The repository still needs a reproducible npm environment to install the libraries and regenerate `package-lock.json`. Do not add dependency declarations without updating the lockfile and passing both Next.js and Vite builds.
- The next phase is a separate root npm package/lockfile migration for Tailwind CSS v4 and Mantine, then a Mantine pilot on login/register only before expanding.



## Phase 3 — Mantine + Tailwind CSS v4 pilot

Date: 2026-10-25  
Branch: `feat/cdpc-ui-library-migration`  
PR: https://github.com/maoyiren/Pixcape/pull/23

Implemented:
- Added Mantine core/hooks and Tailwind CSS v4 packages; the root package lockfile was generated rather than hand-edited.
- Added a shared Mantine theme to the Next.js and Vite entry points.
- Migrated login and registration controls to Mantine while retaining NextAuth provider IDs, callback URLs, registration API, and React Hook Form + Zod validation.
- Configured `@tailwindcss/postcss` for Next.js and `@tailwindcss/vite` for Vite.
- Loaded Tailwind theme and utilities without importing the Tailwind preflight reset, to reduce global CSS impact on the skin editor.

Not yet validated:
- Current GitHub Actions CI, Next.js security/build checks, and Docker smoke build must complete successfully before merge.
- Check the login/register visual states and mobile layout in a browser; fix any Mantine/CSS specificity issues before expanding the migration.
- Do not migrate editor canvas, Blockbench surfaces, OAuth internals, or data contracts in this phase.


## Phase 4 — 全站统一组件体系（目标范围扩展）

Date: 2026-10-25

用户确认：不是只迁移登录/注册；**CDPC 所有产品界面都纳入统一 UI 体系**，包含 Next.js 主站、创作者工作台、衣服选装、皮肤/披肩/外套/披风编辑器、AI 生成、素材与模板库、社区/作品详情、账户设置、管理员后台、帮助与空状态/错误状态，以及移动端布局。

### 全站约定

- **Mantine** 是通用业务控件的默认实现：按钮、输入、选择器、弹窗、抽屉、菜单、通知、标签页、表格、分页、加载与反馈状态。
- **Tailwind CSS v4** 是布局和设计 token 的默认工具：容器、栅格、间距、断点、排版和页面组合；避免每个页面继续新增互不一致的私有布局系统。
- **shadcn/ui** 是按需引入的可定制组件来源，不要求每个控件都同时维护 Mantine 与 shadcn 两份实现。使用前确认场景和依赖；同类交互在全站只保留一个默认实现。
- **Lucide React** 统一图标语义与尺寸。按钮、输入、提示、危险操作和键盘焦点行为使用共享规范。
- **皮肤画布、skinview3d、Blockbench iframe/工作区** 属于专业编辑表面：统一外围工具栏、面板、对话框和响应式框架，但不得让全局 CSS reset 或普通表单组件破坏 canvas、3D 交互、像素精度或 iframe。
- 所有路由共享导航、页脚、页面宽度、标题层级、加载/错误/空状态和移动端规则；已登录用户进入 `/workbench`，减少登录后再次寻找入口的步骤。
- 注册即创作者的产品流程、衣服选装独立入口、现有登录/OAuth 回调与后端 API 契约继续保留；UI 迁移不以重写业务逻辑为代价。

### 迁移顺序与验收

1. 建立共享 tokens、页面容器、导航/页脚、按钮/表单/反馈和移动端规范。
2. 完成登录、注册、账户资料与认证状态。
3. 迁移创作者工作台、衣服选装、皮肤编辑器外围工具栏和资源面板。
4. 迁移 AI 生成、素材/模板库、作品发布/详情、社区与个人创作者页面。
5. 迁移管理员后台、配置表单、健康检查和管理表格。
6. 覆盖帮助、404/500、权限不足、空列表、加载中、提交失败/成功等状态。
7. 每组页面完成桌面和移动端浏览器回归，并验证键盘可访问性、焦点状态、表单语义、Next.js 与 Vite 双入口构建。

### 验收边界

“全站统一”表示所有页面逐步遵循同一套 token、布局和默认组件规则，不表示本次提交已经完成全站迁移。PR #23 当前只是 Mantine + Tailwind CSS v4 的基础设施与登录/注册试点；全站其余模块需分批实施并逐批验证。shadcn/ui 尚需按实际场景评估和接入，不应在未安装、未验证前声称已经全面使用。


## Phase 4 implementation update — creator profile form

Date: 2026-10-25

- Migrated the creator profile form's public display-name and bio fields to Mantine `TextInput` and `Textarea`, and the submit action to Mantine `Button`.
- Preserved the existing server action, field names, required/minimum/maximum constraints, profile defaults, and success/error query-state messages.
- This is an incremental route migration; account overview, admin settings, home page, editor panels and other product surfaces remain in the staged rollout and must not be described as fully migrated yet.
- The earlier browser regression exposed a Mantine accessible-name difference for the password field. The locator now targets the stable `#login-password` ID; the next CI run must confirm this regression is resolved.
