# CDPC P0 完成实施清单

> 对应总架构：`docs/CDPC-TECHNICAL-ARCHITECTURE-V1.0.md`
> 执行方式：单一 P0 跟踪 PR，按可独立验收的阶段持续提交
> 状态：进行中；本文件是执行清单，不代表功能已经完成

## 目标

完成 CDPC 的最小可用生产闭环：用户能够安全登录，导入或创建 Minecraft 皮肤，进入唯一 Next.js Studio，选择素材并即时试穿，保存项目，重新打开并导出可用 PNG；服务端数据持久化在 PostgreSQL，生产 Docker 镜像可构建、启动并通过健康检查。

## P0-0：基线与安全前置

- [x] 从最新 `main` 创建独立实施分支，避免覆盖现有 PR。
- [x] 核对现有 PostgreSQL Only PR #61，记录其 lockfile / npm ci 阻塞。
- [ ] 更新本 PR 到最新 `main`，每阶段开始前检查上游变更。
- [ ] 确认生产 `DATABASE_URL` 的数据库类型、版本、备份状态和现存数据；未确认前禁止执行生产迁移或清理旧数据库文件。
- [ ] 对 PR #63 的产品实施主计划与架构 V1.0 做一次路由和验收口径对齐。

## P0-1：唯一 Next.js 运行入口与数据库

- [ ] Next.js App Router 是所有正式产品页面的唯一运行入口。
- [x] `/workbench` 保留为创作入口中心，链接到 `/ai`、`/editor`、`/studio`，不维护第二套编辑器状态（PR #64；CI #955 通过）。
- [x] `/studio` 是唯一换装/试穿/搭配工作区；`/workbench/ai`、`/workbench/edit`、`/workbench/dress` 与 `/dress-up`、`/bench` 只做保留查询参数的兼容重定向（PR #64 `tests/browser/legacy-routes.spec.ts`；CI #955 通过）。
- [ ] PostgreSQL 是唯一运行时数据库；只保留一份活动 Prisma Schema 和 Migration 路径。
- [ ] 移除运行时的 MySQL / SQLite provider 分支、驱动和测试矩阵；历史 migration 只有在生产数据库确认、备份与迁移策略通过后才可清理。
- [x] PR #61 head 上 lock-refresh #30 成功，`npm ci`、Prisma generate/migrate、PostgreSQL integration、unit、browser regression、Next.js build 均通过（CI #939；尚待同步 main 并合入）。
- [x] PR #61 head 上 Prisma generate、migration deploy、PostgreSQL 集成测试通过（CI #939、Preview/Security #736；尚待同步 main 并合入）。

## P0-2：认证、会话与权限

- [ ] 邮箱登录 / 注册 / 验证流程可用，错误反馈可理解。
- [ ] 已配置的 OAuth Provider 回调与账号绑定流程可用；未配置 Provider 必须明确显示不可用，不能伪装成功。
- [ ] 服务端会话校验、角色权限和资源所有权校验覆盖页面与 API。
- [ ] 管理员路由和管理 API 均由服务端授权；普通用户无法通过直接请求访问管理功能。
- [ ] 登录限流、密码重置和敏感操作审计有自动化测试。

## P0-3：皮肤编辑与项目保存闭环

- [ ] PNG 导入、尺寸 / 格式校验、Classic / Slim 模型识别。
- [ ] 皮肤编辑、撤销 / 重做、未保存状态提示和 PNG 导出。
- [ ] 项目、皮肤原件、编辑版本和导出结果有清晰的数据边界。
- [ ] 登录用户可保存、重新打开和删除自己的项目；游客本地项目登录后显式迁移，不静默覆盖。
- [ ] 数据库写入失败、网络中断和版本冲突有明确恢复提示。

## P0-4：素材与即时换装

> 渲染实现契约见 [docs/CDPC-STUDIO-ASSET-RENDER-CONTRACT.md](./CDPC-STUDIO-ASSET-RENDER-CONTRACT.md)。未定义并验证各类别 UV / 纹理契约前，不得把帽子、裤子、鞋子等类别接入现有通用 UV 合成路径。

- [ ] 素材分类区分披肩、帽子、裤子、上衣、外套、鞋子、披风、鞘翅；披肩 / 外套 / 披风不能混为一类。
- [ ] 素材库卡片预览显示渲染后的单件素材，不强制渲染完整人物。
- [ ] 在 Studio 中选择一件素材后立即看到人物穿戴效果；未导入皮肤时使用默认人物，导入皮肤后保留穿戴并切换用户皮肤。
- [ ] 替换、隐藏、移除素材后，人物预览即时更新。
- [ ] 保存 / 恢复搭配，刷新页面后状态一致。
- [ ] PNG 导出符合 Minecraft 皮肤纹理规范；明确区分皮肤 PNG 与非原生披风等平台展示内容。

### 素材来源与下载权限（P0-4 必须覆盖）

- [ ] 区分预览 / 试穿权限与下载 / 导出 / 再分发权限。
- [ ] 官方 Mojang / Microsoft 披风不提供应用内下载、导出或 JSON 纹理备份。
- [ ] 用户原创披风允许作者本人下载；其他用户仅在明确授权后下载，私有素材始终受所有权限制。
- [ ] 授权社区素材按 license scope 执行；来源未知的第三方素材默认禁止下载。
- [ ] 服务端下载 API、文件接口、批量导出和 JSON 备份统一执行权限校验，不能只隐藏前端按钮。
- [ ] 自动化覆盖官方披风拒绝下载、原创披风作者可下载、私有素材跨用户拒绝、未知来源默认拒绝及 JSON/API 绕过测试。

## P0-5：统一 Studio 体验

- [ ] Studio 支持项目打开、编辑、换装、搭配和预览，不出现重复工作台。
- [ ] 动作切换、视角切换和待机 / 播放控制采用精简交互，不堆叠大量按钮和二级弹窗。
- [ ] 3D 角色旋转、相机、动作与服装渲染使用统一状态，不由多个页面重复维护。
- [ ] 桌面端和移动端关键操作可用；加载、空、错误、离线、无权限状态完整。
- [ ] 动画不阻塞编辑、拖动、3D 帧率或 reduced-motion 用户。

## P0-6：生产构建与发布门禁

- [ ] TypeScript、lint、unit、PostgreSQL integration、核心 Playwright E2E 通过。
- [ ] Next.js production build 通过。
- [ ] Docker 镜像构建、容器启动、健康检查和关键路由 smoke test 通过。
- [ ] 部署文档、环境变量说明、数据库备份 / 恢复与回滚步骤准确。
- [ ] 发布后验证登录、导入、即时试穿、保存、重新打开和 PNG 导出。

## 必须通过的端到端验收旅程

1. 游客进入首页并打开 Studio。
2. 导入 64×64 皮肤 PNG，识别模型并在 3D 视图显示。
3. 选择一件服装素材，立即看到角色穿戴效果。
4. 替换或移除素材，3D 预览立即同步。
5. 保存项目 / 搭配，刷新页面后重新打开，状态保持一致。
6. 导出 PNG，并验证文件尺寸、透明通道和纹理结构。
7. 登录用户只能读取和修改自己的私有项目；普通用户不能访问后台管理 API。
8. 生产 Docker 容器连通 PostgreSQL，健康检查和关键路由正常。

## 当前已知阻塞与依赖

- PR #61（PostgreSQL Only）当前为 Draft；仓库 lock-refresh workflow 已重新生成根 `package-lock.json`，`npm ci` 已通过。首轮 Docker 检查发现 Next.js build 阶段没有 `DATABASE_URL`，已在两个 Dockerfile 的 build stage 加入仅用于构建的 PostgreSQL placeholder；最新 CI 正在重新验证。此 PR 不重复实现同一数据库切换。
- PR #60 是产品 / 交互主计划文档 PR；其中清单可作为需求来源，但文档合并不代表代码功能完成。
- 生产数据库实际类型、备份和现存数据尚未在本次执行中得到独立确认；生产迁移、数据删除和历史 migration 清理均为受保护步骤。
- OAuth、邮件、对象存储等外部 Provider 需要真实环境变量与回调配置；代码可以验证配置处理，但不能虚构密钥或声称外部服务已联通。

## PR 更新纪律

每次提交都更新本清单：将任务标记为完成前，必须附上对应代码位置、测试命令 / CI 运行链接或人工验收证据。未执行的测试标记为“未验证”，失败项记录错误与下一步。所有 P0 项通过后，才把本 PR 转为 Ready for review；合并和生产发布仍需单独确认数据安全与部署结果。


## 最新进度更新（2026-11-06 16:55 UTC）

- PR #61 head `aa6c4253a04c9a6ef35507e9f904a63d988326e9`：CI #939、Preview/Security #736、Docker smoke #946 均成功；Docker 的 publish / 1Panel deploy job 为 skipped，因此没有发布镜像或部署生产。
- PR #61 相对当前 main 落后 2 个提交（compare status: diverged），合并前必须同步并重跑检查；PR 仍为 Draft。
- PR #64 head `4d8d039d833a156a49580a69824eca4d973d0130`：CI #955、Preview/Security #745、Docker smoke #955 均成功。该 PR 当前 workflow 基于 main 的旧多数据库 CI/Docker 流程；不能把这些绿色结果误当成 PostgreSQL-only 集成验收。PR #61 合入后必须在新 main 上重跑。
- PR #64 仅完成旧路由查询参数保留重定向和工作台入口回归；不代表 Studio 核心换装、保存恢复或 PNG 导出闭环完成。
- 当前仍未确认生产 DATABASE_URL、生产数据库版本、备份可恢复性；不执行生产迁移、不触发 1Panel 发布。


## 最新进度更新（2026-11-07）

- PR #64 当前 head 的 CI #957、Preview/Security #746、Docker smoke #956 均成功；Docker publish 与 1Panel deploy 均 skipped。该组 workflow 仍基于旧多数据库基线，不构成 PostgreSQL-only 验收。
- 新增 [docs/CDPC-STUDIO-ASSET-RENDER-CONTRACT.md](./CDPC-STUDIO-ASSET-RENDER-CONTRACT.md)，明确单件预览、人物即时试穿、完整搭配预览 / 导出的边界，以及逐类别纹理契约和 P0 验收条件。
- Studio 静态审计确认：当前 UI 映射仅覆盖 SHAWL / COAT / CAPE；HAT / PANTS / SHOES 尚未接入；非披风素材共用一组 UV 矩形；素材卡片仍为 PNG 缩略图。上述项目继续保持未完成状态。
- PR #61 与 main 的差异仅涉及新增技术架构文档，没有与 PostgreSQL 实现文件发生重叠；但 PR #61 仍落后 main 两个提交。当前 GitHub 操作未提供安全的 Update branch 能力，因此没有伪造 merge commit 或强行移动分支。
- 本轮未合并 PR、未发布镜像、未执行生产迁移或部署。新增提交必须重新获得 CI 结果后才能计入验收。


## 最新验证更新（2026-11-07 10:35 UTC）

- PR #64 当前提交 `3a267a0201841a563ca507f8df71f79b95ab1a42` 的 CI #1029、Next.js Preview/Security #818、Docker smoke #1028 均成功。
- CI #1029 的 unit tests、PostgreSQL integration、MySQL integration、SQLite integration、Next.js production build、Playwright browser regression、AI API tests、AI API container build 和完整 CDPC Docker image build 均通过。
- Preview/Security #818 的 Prisma schema validation、PostgreSQL/MySQL/SQLite migrations、RBAC/ownership unit tests、PostgreSQL integration、Next.js production build、三种数据库 runtime image build 与 security E2E 均通过。
- Docker smoke #1028 的单一 runtime-switchable image build，以及 PostgreSQL/MySQL/SQLite 容器启动 smoke 均通过；publish 与 1Panel V2 deploy job 为 skipped，未发布镜像、未部署生产。
- 本轮修正 `tests/browser/studio-core.spec.ts`：在披肩仍处于选中状态时先验证独立预览，再切换外套并验证同槽位互斥；避免测试先切换外套、再错误要求已被移除的披肩仍可预览。提交为 `3a267a0`。
- `tests/browser/auth-navigation.spec.ts` 中已登录头像菜单到 `/u/[username]` 的端到端测试本轮通过，验证了个人主页链接 href、点击后 URL，以及菜单悬停、Escape 和外部点击关闭行为。此项有本轮 Playwright 通过证据；真实生产账号与生产域名仍未人工验收。
- 注意：以上 #1029/#818/#1028 仍使用当前 main 的多数据库测试矩阵，不是 PostgreSQL-only 最终基线。PR #61 仍为 Draft 且未合并；其 PostgreSQL-only 变更需在同步 main 后重跑并完成生产数据库/备份确认。
- 本轮未合并 PR、未发布镜像、未触发 1Panel 部署、未执行生产迁移。Studio 的单件真实渲染、完整分类 UV、皮肤导入/编辑/保存恢复/导出完整旅程仍未完成验收，不能因 CI 绿灯标记为完成。


## 最新验证更新（2026-11-07 13:30 UTC）

- PR #64 已将 PR #61 的 PostgreSQL-only 基线同步进 `feat/p0-core-completion`，当前分支提交为 `9ee7930bf5237dd9b589c914dd76acd35ac7c8bd`；相对 main 的同步关系与分支状态以 PR 当前 compare 为准。该变更尚未合并 main。
- PostgreSQL-only 基线变更包括：单一 PostgreSQL Prisma schema / migration 路径、移除 MySQL / SQLite 专用 schema 与集成测试、更新 CI 和 Docker 构建流程；`playwright.config.ts` 保留 PostgreSQL 测试连接与下载测试支持。
- 新 head 的 CI #1036（run `42376966382`）成功：PostgreSQL migration、unit / integration、依赖安全检查、Next.js production build、Playwright browser regression、AI API tests、AI API container build、完整 Pixcape + Blockbench Docker image build 均通过。
- Preview/Security #825（run `42376966431`）成功：PostgreSQL migration、RBAC / ownership、PostgreSQL integration、Next.js build、安全 E2E 与 PostgreSQL runtime image 均通过。
- PostgreSQL Docker smoke #1035（run `42376966372`）成功：PostgreSQL-only image build、容器启动、health / route smoke 均通过。
- Lockfile refresh #33（run `42376966379`）成功。
- 本轮 CI 曾发现 128×128 PNG 导出浏览器测试在导入后立即点击导出按钮失败。证据显示按钮当时处于 disabled（Studio 正在异步刷新 3D 皮肤预览），属于测试未等待异步状态完成；提交 `9ee7930` 增加按钮 enabled 等待后，完整 browser regression 通过。没有移除产品侧禁用保护，也没有降低 PNG 文件名和像素尺寸断言。
- 当前渲染能力边界仍为：SHAWL / COAT 使用各自完整 Minecraft skin alpha atlas；CAPE 是独立背部装备；HAT / PANTS / SHOES 仍未启用。实际源素材 Classic / Slim、64 / 128px 的视觉检查与像素级 fixture/hash 审核仍未完成，不能据此标记完整 UV 验收通过。
- PR 继续保持 Draft。CI 成功不等于真实 OAuth / 邮件配置、生产账号、移动端视觉验收、生产 PostgreSQL 数据库确认、备份恢复演练或回滚方案已通过。Docker publish 与 1Panel deploy 未执行；没有发布镜像、生产迁移或生产部署。


## 最新验证更新（2026-11-07 14:28 UTC）

- PR #64 提交 `91fda2806dae2ba32c8f897a03f62b7df5e29d63`：新增目录卡片独立、懒加载 3D 预览组件 `app/studio/catalog-garment-preview.tsx`，目录卡片不再显示平面 PNG 缩略图；披肩 / 外套使用透明皮肤 UV 图集，披风使用独立背部装备渲染。
- 为避免目录重构后浏览器回归仍定位旧 PNG 缩略图，`tests/browser/auth-navigation.spec.ts` 已改为检查 `.dressup-item-render`。
- PNG 导出改为 `canvas.toBlob()` + object URL 下载，避免大尺寸 canvas 使用 data URL 的内存峰值；下载后延迟回收 object URL。
- 提交 `c23ec891` 首次 CI 发现新预览组件未进入 Git tree（构建报 module not found）；随后提交 `91fda28` 补回组件文件并重跑完整 workflow。不得把该次失败隐藏或算作通过。
- 最终 head `91fda28` 的 CI #1044（run `42381456139`）成功，包含 Playwright browser regression；Preview / Security #833（run `42381456158`）成功；PostgreSQL Docker smoke #1042（run `42381456137`）成功；Lockfile refresh #39（run `42381456162`）成功。
- 目录 3D 预览当前只支持已验证的披肩、外套、披风。帽子 / 裤子 / 鞋子仍显示未接入状态；没有为其虚构 UV。实际素材 Classic / Slim、64 / 128px 的像素级视觉验收仍未完成。
- 以上 CI 只证明构建和自动化回归通过，不代表真实素材视觉验收、移动端体验、生产 OAuth / 邮件配置、生产 PostgreSQL 备份恢复或回滚演练完成。PR 继续保持 Draft；publish 与 1Panel deploy 均 skipped，未发布镜像、未迁移或部署生产。


## 最新实施更新（2026-11-07 15:30 UTC）

- 修复最新 CI #1059 的两个浏览器回归定位问题：素材卡片点击改用 `.dressup-item`，避免误匹配独立收藏按钮；待最新 CI #1060 验证。
- 增加 PostgreSQL 素材权利迁移：`Asset.provenance` 与 `Asset.downloadPolicy`，历史素材默认 `UNKNOWN` / `DENY`。
- 增加独立下载 API `/api/assets/:assetId/download`。上传默认禁止下载；只有显式声明原创权利后，作者本人可下载。LICENSED 公共素材必须同时具备 `licenseId`、PUBLIC 可见性和 `LICENSED_PUBLIC` 策略。
- 官方素材标记为 `OFFICIAL` 时，存储文件预览接口与下载接口均拒绝返回原始纹理；官方披风预览如需支持，应使用独立授权的展示来源。
- 衣橱增加原创权利声明控件，并根据服务端返回的 `canDownload` 显示下载入口；不再通过预览文件接口直接触发下载。
- 已补充 E2E：匿名下载拒绝、未知来源默认拒绝、原创披风作者可下载、私有披风跨用户拒绝、OFFICIAL 原始文件与下载拒绝。新 migration / API / browser test 均待 CI 验证。
- JSON 备份不嵌入纹理字节；仍需完成备份引用过滤与其他批量接口绕过专项审计，不能提前标记整个版权闭环完成。
- PR #64 继续 Draft；不合并、不发布、不部署生产。
