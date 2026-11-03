# CDPC 统一产品总架构与新旧功能映射

- 日期：2026-11-01
- 状态：架构基线 / 待分阶段实施
- 仓库：`maoyiren/Pixcape`
- 基线：`main`（审查时 HEAD: `b4cbe86aeeda59c85cd41376665ce85db4bf380e`）
- 产品定位：Minecraft 皮肤、服装与创作社区平台

> 本文替代旧的“创作工坊 / 衣橱 / 创作者中心”并列式一级导航规划。本文是目标架构与迁移映射，不代表下述功能已经全部实现。

## 1. 产品主次与一级导航

产品主次固定为：

1. **角色换装：核心体验**——用户最先感知、最常使用的角色搭配与预览。
2. **设计创作：生产能力**——AI、像素编辑、服装设计、项目管理。
3. **素材社区：内容生态**——素材发现、收藏、发布、互动与创作者关系。

一级导航仅保留六项：

| 一级入口 | 目标路由 | 职责 | 现有来源 / 迁移 |
|---|---|---|---|
| 首页 | `/` | 推荐内容、最近项目、快速开始 | 保留 `app/page.tsx`，从工具卡片首页改为平台首页 |
| 换装 | `/wardrobe` | 3D 角色、皮肤、服装配件、搭配保存与导出 | 合并现有 `app/wardrobe`、`app/dress-up`、`src/PresetStudio.tsx` 中有效换装逻辑 |
| 创作 | `/create` | 项目入口；AI 生成、像素编辑、服装设计工具切换 | 整合 `/workbench`、`/ai`、`/editor`、`/bench` 与相关 `src` 功能 |
| 素材库 | `/assets` | 皮肤、披肩、外套、披风、帽子、裤子、鞋子等素材发现、筛选、收藏、获取 | 当前没有完整独立模块；从现有预设素材目录和创作素材提取 |
| 社区 | `/community` | 作品广场、作品详情、创作者、点赞评论收藏、发布审核 | 部分创作者资料在 `/creator`；发布与互动链路缺失 |
| 我的 | `/me` | 角色、皮肤、服装、搭配、项目、收藏、发布、账户设置 | 整合 `/account`、`/creator` 和未来用户资产页 |

后台继续独立为 `/admin`，不占用六个一级入口。管理后台保留用户、审核、统计和系统配置职责。

旧路由在迁移期间提供 Next.js 内部兼容重定向，不再作为重复产品入口：
- `/workbench` → `/create`
- `/workbench/ai`、`/ai` → `/create?tool=ai`
- `/workbench/edit`、`/editor` → `/create?tool=editor`
- `/workbench/dress`、`/dress-up` → `/wardrobe`
- `/account`、`/creator` → `/me` 对应子页（保留必要的公开创作者主页独立 URL）
- `/bench` 先检查实际用途，再决定重定向；不得盲目删除。

## 2. 当前 main 代码审查结论

### 已有、应保留

- Next.js App Router 主框架、共享根布局和 Mantine Provider。
- NextAuth 登录、账户、角色权限、管理员后台和审计基础。
- `skinview3d` 依赖及现有 3D 预览能力。
- `src/PresetStudio.tsx`、`src/AiSkinStudio.tsx`、`src/ThreeCapePreview.tsx` 等现有工具逻辑，迁移前先拆分可复用业务逻辑。
- 64×64 PNG 处理、皮肤贴图与 Blockbench 桥接；保留必要的第三方许可与非官方声明。
- Prisma 多数据库适配、用户、创作者资料、项目和审计记录。

### 已有但必须整合 / 改造

- `app/components/site-nav.tsx`：目前导航仍是首页、创作工坊、AI 创作、衣服选装、单品编辑器、创作者中心；改为六项统一导航，并支持 PC / 移动端、登录态和当前路由状态。
- `app/wardrobe/page.tsx`：当前渲染 `NextStudio mode="wardrobe"`，其内部动态加载 `src/App`，并非独立 Next.js 原生换装模块。
- `app/dress-up/page.tsx`：有独立 `DressUpStudio`、skinview3d、分类和本地穿搭保存；与 `/wardrobe` 重复，合并后下线旧入口。
- `app/workbench/page.tsx`：目前是三个入口卡片，不是实际创作工作区；改为新的 `/create` 项目与工具工作区。
- `app/ai`、`app/editor`、`app/workbench/*`：当前通过 `NextStudio` 动态加载旧 `src/App`，迁移为 Next.js 页面与 Client Components。
- `app/account`、`app/creator`：合并到 `/me` 的资产与资料分区；公开创作者主页仍可保留可分享的独立 URL。

### 当前缺失，不得伪装为已完成

- 当前 Prisma 核心业务模型只有 `User`、`CreatorProfile`、`Project`、`AuditLog`、认证与设置模型；没有统一的 Character、Skin、Clothing、Accessory、Outfit、Asset、Publication、收藏和互动模型。
- `Project.assetKey` 只是可选字符串，不构成资产关系与版本管理。
- 没有完整的素材库搜索、收藏、授权/来源信息和获取流程。
- 没有完整社区作品发布、作品详情、点赞、评论、收藏与审核链路。
- 当前创作者页明确说明作品管理仍在接入，不应宣传为已具备完整社区。
- 旧 Vite/React 源码、Vite 配置和相关依赖仍在仓库。默认开发/构建入口已切为 Next.js，但这不等于 Vite UI 及其依赖已全部迁移和删除。

## 3. PR #30 的审查结论

PR #30（已合并，merge commit `47ae985848a0d5cc3f762a1528a8cb3d7791e9ef`）是一次小范围整合：
- 合并了账户页导航使用 Next.js Link、响应式卡片 padding 等改动。
- PR 描述明确保留当时 main 的路由、认证和编辑器修复，不重新引入旧版导航、旧 Mantine provider 和旧 `/dress-up` 实现。
- PR #30 不包含统一资产模型、六项一级导航、完整换装工作台、素材库或社区系统。
- 因此 PR #30 的合并不能作为新产品架构完成的依据；应保留其有效账户 UI 修复，不回滚其余历史整合成果。

## 4. 统一资产模型

原则：同一个创作对象从 AI 生成、像素编辑、3D 试穿、个人保存到社区发布，始终引用同一条 Asset / 业务实体记录；不允许各工具复制一份互不关联的数据。

建议的核心关系（逻辑模型，字段需在实现前进一步评审）：

| 实体 | 核心职责 | 关键关系 |
|---|---|---|
| Character | 用户角色 / 玩家外观容器 | owner、activeSkin、outfits |
| Skin | Minecraft 皮肤纹理与模型类型 | Asset、Character、Project |
| Clothing | 可穿戴服装定义 | Asset、category、作者、版本 |
| Accessory | 非服装配件定义 | Asset、category、作者、版本 |
| Outfit | 一套角色搭配 | Character、Skin、OutfitItem[] |
| OutfitItem | 搭配中的穿戴关系 | Outfit、Clothing/Accessory、层级、启用状态 |
| Asset | 文件与元数据统一记录 | owner、storage key、MIME、尺寸、hash、来源、授权、版本 |
| Project | 可编辑创作项目 | owner、关联 Character、输入/输出 Asset、版本 |
| Publication | 发布到社区的作品快照/引用 | owner、Project 或 Asset/Outfit、visibility、moderation |
| Favorite | 用户收藏关系 | user、Asset / Publication |
| Reaction / Comment | 社区互动 | user、Publication |

分类必须显式区分：`SKIN`、`SHAWL`（披肩）、`COAT`（外套）、`CAPE`（披风）、`HAT`、`PANTS`、`SHOES`、`OTHER_ACCESSORY`。披肩、外套、披风不可合并成同一类型。Mojang 官方披风不作为普通 PNG 服装素材导出。

Asset 记录至少需要：所有者、文件存储键、MIME、宽高/格式、哈希、来源、作者署名、许可/使用范围、公开状态、审核状态、版本和创建时间。文件二进制放对象存储或受控文件存储；数据库存元数据与关系，不将 PNG base64 当作长期业务数据。

## 5. 跨模块统一工作流

### AI → 编辑 → 换装 → 我的 → 社区

1. AI 生成任务输出候选结果和校验报告。
2. 用户确认后创建/更新 Asset，并挂接到当前 Project；未确认的临时输出不直接公开。
3. 单品编辑器通过 assetId / projectId 读取同一资产，保存新版本或派生资产，记录来源关系。
4. 换装器通过 assetId 将皮肤、服装或配件加载到 3D 角色；搭配只保存 Outfit 与 OutfitItem 引用，不复制贴图文件。
5. 用户可将 Asset、Outfit 或 Project 保存到个人空间。
6. 发布时创建 Publication，引用已保存的资产/搭配/项目版本，并经过授权检查和内容审核。
7. 其他用户收藏 Publication 或 Asset 时只建立 Favorite 关系；加入自己的搭配时引用允许复用的素材版本并记录许可。

跨页面状态以服务端持久化的 projectId / assetId / outfitId 为主；客户端状态仅用于即时预览和未保存草稿。LocalStorage 可作临时缓存/离线恢复，不得作为唯一保存机制。

## 6. 分阶段实施与验收门槛

### 阶段 0：架构与数据迁移设计（当前）
- [x] 审查 main、PR #30、现有 Next.js-only 迁移说明与 Prisma schema。
- [x] 形成新旧功能映射与缺失清单。
- [ ] 评审资产实体字段、文件存储、访问权限、授权/署名和迁移策略。
- [ ] 为旧 URL 定义兼容策略与逐步下线时间表。

### 阶段 1：统一导航与换装核心（最高优先级）
- [ ] 全站一级导航切换为：首页、换装、创作、素材库、社区、我的；后台独立。
- [ ] `/wardrobe` 成为唯一真实换装入口；合并重复换装实现，旧 URL 兼容重定向。
- [ ] 3D 角色预览、皮肤导入/选择、分类选装、穿脱/替换、360°旋转、动作、背景、保存/恢复、PNG 导出。
- [ ] 披肩、外套、披风及其他服装分类/渲染规则分别验收。
- [ ] PC / 移动端响应式与触摸旋转测试。

验收必须通过真实浏览器操作：导入一张 64×64 PNG → 选穿至少一种披肩/外套/披风 → 穿脱与替换 → 旋转人物 → 保存搭配 → 刷新恢复 → 导出 PNG 并验证尺寸、透明度和像素内容。

### 阶段 2：统一资产模型与创作工作区
- [ ] 建立 Asset / Character / Skin / Clothing / Accessory / Outfit / OutfitItem / Project 关系与多数据库迁移。
- [ ] 将 AI 和像素编辑器迁移为 Next.js Client Components，复用现有引擎与算法。
- [ ] AI 输出、编辑器保存、换装加载都使用同一 assetId / projectId。
- [ ] 保存项目、版本历史、错误反馈和权限校验。

### 阶段 3：素材库与个人资产
- [ ] `/assets` 分类、搜索、筛选、详情、收藏、授权说明与使用入口。
- [ ] `/me` 管理角色、皮肤、服装、配件、搭配、项目、收藏、发布和账户设置。
- [ ] 云端保存、删除、私有/公开状态和跨设备恢复。

### 阶段 4：社区与创作者生态
- [ ] `/community` 作品广场、详情、创作者主页、发布流程。
- [ ] 点赞、评论、收藏、举报、审核、版权/授权和原创声明。
- [ ] 管理后台接入真实审核和统计数据；不展示虚构指标。

### 阶段 5：全站验收与发布
- [ ] Next.js App Router 页面统一；清除用户可见的 Vite SPA 入口与中转页。
- [ ] 保留必要的 3D/绘图/Blockbench 构建依赖，只有确认无引用后才删除 Vite 依赖和配置。
- [ ] Next.js build、TypeScript、单元/集成、安全、Playwright、Docker 多数据库冒烟测试。
- [ ] Preview 和生产部署后，逐条验证登录、换装、保存、导出、创作、素材库、社区和管理后台。

## 7. 工程约束

- 不推倒重写；复用经验证的 3D、像素编辑、AI API、PNG 处理和认证逻辑。
- Next.js App Router 是唯一产品页面与路由体系；旧 Vite 可在迁移期间保留为构建/源码依赖，但不能成为用户可见页面。
- 所有上传和生成文件必须做格式、尺寸、大小、权限和安全校验。
- API Key 只存在服务端；AI 生成要有速率限制、任务状态和成本控制。
- 任何公开素材必须记录作者、来源和许可；未获得授权的素材不可作为可再分发内容。
- 管理后台仍使用 `/admin` 并执行服务端权限校验。
- 每阶段都要有可复现测试证据；路由存在、页面渲染或 CI build 通过，不代表业务流程完成。

## 8. 现有旧规划处理

审查时仓库 main 中不存在 `docs/UI-FUNCTION-REFACTOR-PLAN.md`（路径读取返回 404，当前树中也未发现该文件）；其部分历史目标与迁移记录可在 `docs/NEXTJS-ONLY-MIGRATION.md` 及 `docs/CDPC-COMPLETE-PROJECT-DOCUMENTATION.md` 中找到。后续以本文作为统一产品架构基线，并在实施时更新阶段状态，不再维护互相冲突的旧导航规划。
