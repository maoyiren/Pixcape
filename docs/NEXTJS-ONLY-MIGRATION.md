# CDPC Next.js 唯一页面架构迁移方案

- 日期：2026-10-25
- 状态：已确立迁移方向；迁移尚未完成
- 目标仓库：`maoyiren/Pixcape`

## 决策

CDPC 的所有用户可见页面和交互统一由 Next.js App Router 实现。用户不应从 Next.js 页面跳转到独立 Vite 页面，也不应看到“编辑器尚未连接”“配置 NEXT_PUBLIC_EDITOR_URL 后再打开”这类中转页。

Vite 旧页面将逐步下线。Vite 可以在迁移期间作为开发/构建工具，但不得继续作为独立的正式用户界面入口。最终是否保留 Vite 构建依赖，只取决于迁移后仍然需要的引擎/构建任务，不作为保留旧 UI 的理由。

## 迁移原则

1. **Next.js 是唯一产品入口**：首页、登录注册、个人中心、创作者中心、管理后台、AI 创作、像素编辑器、衣橱选装和 3D 预览均使用 Next.js 路由与共享布局。
2. **不以跳转页冒充功能页**：`/ai`、`/editor`、`/wardrobe` 必须直接呈现可用功能，而不是跳往 `/studio/`、外部编辑器地址或另一个 Vite SPA。
3. **先迁移功能，再删除旧实现**：复用现有像素编辑、AI 请求、服装素材、skinview3d/Three.js 和 Blockbench 桥接逻辑；将可复用的业务逻辑提取为框架无关模块，再由 Next.js Client Components 承载交互。不要为了删除 Vite 页面而丢失真实能力。
4. **统一认证和数据链路**：页面内操作直接使用现有 Next.js API、Server Actions 和认证会话；禁止在两个 SPA 之间重复维护登录状态。
5. **旧 URL 仅作兼容**：历史链接可以在 Next.js 服务端重定向到对应 Next.js 路由，但不得再将用户送到 Vite 的 `index.html`。
6. **组件体系统一**：页面外壳、表单、弹窗、通知、导航和工具栏遵循 Mantine + Tailwind CSS v4 规范；仅保留确有必要的绘图/3D 渲染引擎，不把旧页面 CSS 当作新的设计系统。
7. **分阶段删除**：每项旧页面/构建产物都先检查依赖、测试与生产入口，确认 Next.js 对应功能可用后才删除。不得直接删掉 `src/` 或整个 Vite 配置来制造“已迁移”假象。

## 当前仓库已核对的事实

- `app/ai/page.tsx`、`app/editor/page.tsx` 和 `app/wardrobe/page.tsx` 当前都复用 `app/components/editor-entry.tsx`。
- 该入口组件默认将用户引导到同一部署中的 `/studio/?mode=...`；如果配置 `NEXT_PUBLIC_EDITOR_URL`，则可能跳转到另一个地址。
- `app/studio/page.tsx` 仍然是带有外部/内置编辑器跳转的中转页。
- 根 `package.json` 同时保留 Vite `dev/build` 脚本和 Next.js `next:dev/next:build/next:start` 脚本。
- Vite 源码包含 AI Studio、Preset Studio、3D 披风预览等实际业务实现，不能在没有迁移和回归的情况下整目录删除。
- 因此目前的 Next.js AI/编辑器/衣橱路由还不是完全原生的 Next.js 功能页；本文件记录的是需要实施的迁移目标，不宣称迁移已经完成。

## 实施阶段与验收清单

### 阶段 A：清点入口与消除中转体验

- [ ] 盘点全站指向 `/studio/`、`NEXT_PUBLIC_EDITOR_URL`、Vite SPA 和 `index.html` 的链接、重写、代理及部署配置。
- [ ] 绘制 AI、编辑器、衣橱三条功能链的实际依赖图，标注可复用业务逻辑、React UI、静态资源和第三方引擎。
- [ ] 将所有用户可见入口固定到 Next.js 正式路由；兼容旧 URL 时仅在 Next.js 内部重定向。
- [ ] 移除生产 UI 对外部编辑器地址的依赖；不再将“配置 URL”作为用户可见功能的前置条件。
- [ ] 增加路由回归测试，断言用户操作不会导航到 `/studio/`、Vite `index.html` 或独立编辑器域名。

### 阶段 B：迁移 AI 创作

- [ ] 将文本生成、参考图上传、模型选择、任务状态、错误提示、结果预览和保存/继续编辑流程改为 Next.js 页面。
- [ ] 复用现有服务端 AI API 与配置，不在浏览器暴露密钥。
- [ ] 确保模型不可用、超时、失败、重试和重复提交均有真实状态反馈。
- [ ] 通过 AI API 单元/集成测试和浏览器流程测试后，删除旧 AI 页面入口。

### 阶段 C：迁移衣橱选装与 3D 预览

- [ ] 将素材分类、搜索、筛选、单件试穿、搭配清单、替换/脱下、保存穿搭和继续编辑迁移到 Next.js。
- [ ] 将 3D 预览封装为 Next.js Client Component，保留 skinview3d/Three.js 引擎与必要模型/贴图资源。
- [ ] 独立保留披肩、外套、披风的数据分类与渲染规则。
- [ ] 验证触摸/鼠标 360° 旋转、动作切换、背景切换、材质清晰度和窄屏布局。
- [ ] 通过真实素材和浏览器回归后，移除 Vite 衣橱 UI。

### 阶段 D：迁移像素编辑器与 Blockbench 桥接

- [ ] 将画布、工具栏、图层、颜色/属性面板、撤销重做、导入与导出放入 Next.js Client Components。
- [ ] 将纯业务逻辑与数据处理抽离成可复用模块；不依赖 Vite 专属全局变量或路由。
- [ ] 验证 64×64 皮肤 PNG、目标素材格式、保存草稿、导出和 Blockbench 导入桥接。
- [ ] 只有在 Next.js 编辑器功能回归通过后，才删除旧编辑器 UI 入口及专属资源。

### 阶段 E：生产切换与移除旧 UI

- [ ] Docker 生产入口只启动 Next.js 应用及必要的后端依赖；确认无需为用户页面启动第二个 SPA 服务。
- [ ] 清理旧 Vite 路由回退、`/studio/` 生产入口、过期环境变量文档与部署配置。
- [ ] 移除不再被 Next.js 或必要构建任务引用的 Vite UI 依赖、页面文件和样式。
- [ ] 如 Vite 仍用于构建 Blockbench 等必要资产，明确保留为内部构建步骤，不向用户提供独立 Vite 页面。
- [ ] 完成 Next.js build、TypeScript、单元/安全集成测试、Playwright 全流程测试、Docker build 和部署后冒烟测试。
- [ ] 确认主导航、登录态、账户入口、管理员权限、移动端和所有核心功能均在同一 Next.js 应用内工作。

## 完成定义

只有当正式页面入口不再跳转到 Vite、AI/编辑器/衣橱功能在 Next.js 页面内真实可用、旧 UI 已移除、生产 Docker 和全套回归通过，才可将迁移标记为完成。在此之前，阶段状态必须保持未完成。
