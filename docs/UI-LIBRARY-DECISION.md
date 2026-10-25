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

本分支已建立独立衣服选装页面，并将已知披肩、外套和披风素材接入 skinview3d 实时预览，支持本地 64×64 PNG 导入、Steve/Alex 模型、旋转/缩放和背景色调整。上衣、裤子、鞋子和帽子当前没有确认可用的正式素材，页面明确显示尚未接入。穿搭持久化和本页导出仍未实现。Mantine/Tailwind CSS v4/shadcn 的依赖迁移尚未完成；需要在具备 npm registry 的开发环境中更新锁文件并通过双入口构建后再扩大迁移。

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

