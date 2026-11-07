# CDPC P0 基线代码审计

> 审计分支基线：`main`，PR #64 建立时基于 commit `c33d39ebad30e9496ac6cd65530418d01339baba`
> 审计方式：读取仓库文件；未执行本地构建、浏览器测试或生产环境操作
> 结论：以下为静态代码证据，不代表运行时验收

## 已确认存在的基础

| 领域 | 代码证据 | 当前判断 |
|---|---|---|
| Next.js 首页 | `app/page.tsx` | 首页由 App Router 提供 |
| Studio 路由 | `app/studio/page.tsx` | 页面入口已存在，加载 `DressUpStudio` |
| 单品编辑器路由 | `app/editor/page.tsx` | 页面入口已存在，具体编辑能力仍需 E2E |
| AI 路由 | `app/ai/page.tsx` | 页面入口已存在，真实 Provider 能力需环境验证 |
| Next.js 配置 | `next.config.ts` | 声明 App Router 为唯一应用运行时，并设置基础安全响应头 |
| PWA Service Worker | `public/sw.js` | 存在 Next.js 版本 Service Worker；离线恢复和更新体验仍需验收 |
| 皮肤预览 | `app/studio/dress-up-studio.tsx` | 使用 skinview3d 初始化角色预览、动作和视角 |
| 穿搭保存 | `app/studio/dress-up-studio.tsx` | 同时存在 localStorage 本地保存与账号云端 API 保存路径 |
| 素材 API | `app/api/assets/route.ts` | GET/POST 具备会话校验、素材归属过滤、请求大小限制和输入校验 |
| 认证入口 | `auth.ts` | 已配置 Credentials、GitHub、Google、Microsoft、Apple、Email Provider 的条件接入 |

## 已确认的 P0 差距

### 1. PostgreSQL Only 尚未进入 main

- `lib/prisma.ts` 仍导入 PostgreSQL、MariaDB、SQLite 三套 Adapter / Client。
- 运行时仍按 `DATABASE_PROVIDER` 选择数据库，并提供 MySQL / SQLite 默认连接。
- Dockerfile runtime 注释仍提及 SQLite native addon，复制多数据库构建产物。
- 这项工作由 PR #61 承担；PR #61 仍为 Draft，最新 head 为 `aa6c4253a04c9a6ef35507e9f904a63d988326e9`。lock-refresh #30、CI #939、Next.js Preview/Security #736、Docker smoke #946 均成功，已覆盖 PostgreSQL migrations、unit/integration/browser tests、Next.js build、容器构建启动与 health/route smoke。Docker publish 和 1Panel deploy job 为 skipped；未发布、未部署。PR #61 相对当前 main 落后 2 个提交，需同步并重跑 CI 后再合并。不要在本 PR 平行改写同一套数据库切换代码。

### 2. Studio 素材分类覆盖不完整

- `app/studio/dress-up-studio.tsx` 当前 UI 分类包含上衣、外套、裤子、鞋子、帽子、披肩、披风。
- 但当前静态预设目录只有披肩、外套、披风；其余分类明确显示“尚未接入”。
- 云端素材映射函数 `toAssetCategory` / `fromAssetCategory` 也只支持 SHAWL、COAT、CAPE。
- 数据库枚举已有 HAT、PANTS、SHOES，但页面映射未覆盖。不能仅增加分类按钮就宣称素材可用；需先明确素材纹理契约、槽位/UV 规则、单件预览方式和导出合成规则，再实现和测试。

### 3. Studio 的单件素材展示与试穿体验未完全符合产品约定

- 当前素材卡片直接显示 `img` 纹理缩略图。
- 点击素材会写入 `selected[category]`，由统一 SkinViewer 角色预览更新穿戴效果。
- 产品约定要求区分“素材库单件渲染预览”和“Studio 人物即时试穿预览”。当前代码可见角色试穿逻辑，但未看到独立的单件 3D/渲染预览组件。
- 需先确定不同类别素材的独立展示方式；披肩、外套、披风、帽子、裤子、鞋子并非都能用同一张皮肤纹理或相同 UV 合成逻辑。

### 4. 角色模型和皮肤导入需要运行时验证

- 当前 Studio 默认皮肤引用外部 GitHub Raw URL。
- 本地导入只接受 PNG，并检查 64×64 尺寸；浏览器解码和 WebGL 初始化有错误反馈。
- skinview3d Viewer、皮肤/服装纹理合成、跨域素材加载、截图导出是否在生产域名可用，仍需 Playwright / Docker / 真实浏览器验证。

### 5. 云端穿搭保存链路需要故障测试

- 当前云端保存会先把预设远程 PNG 上传为用户私有 Asset，再创建/更新 Outfit 并更新 Workspace。
- 本地草稿使用 localStorage，云端穿搭通过 API 加载。
- 必须覆盖：未登录保存、上传中断、部分素材上传成功但 Outfit 创建失败、云端资源删除、跨设备恢复、资源归属越权、删除当前活动穿搭后的 Workspace 状态。
- 不能只测试正常路径。

### 6. Docker 启动与数据库安全

- 审计基线 main 的 `docker-entrypoint-single.sh` 在 `DATABASE_URL` 为空时只输出 warning，然后仍启动应用。
- PR #61 已将容器启动契约改为必须提供 `postgres://` 或 `postgresql://` URL，否则快速退出；该行为已通过 PostgreSQL Docker smoke test，但尚未进入 main。
- 容器入口执行 migration 的并发行为、数据库不可用时的重试/失败策略和部署回滚需验证。

## 本次未验证事项

以下项目尚无本次会话中的运行证据，均不能标记为完成：

- `npm ci`、TypeScript、lint、unit、integration、Playwright。
- Next.js production build。
- Docker build、容器启动、health/readiness 和关键路由 smoke test。
- 真实 GitHub / Google / Microsoft / Apple OAuth 回调与邮件发送。
- 生产 PostgreSQL 实际版本、现存数据、备份可恢复性。
- 生产域名下 3D WebGL、跨域纹理加载和 PNG 下载。
- 手机端 320 / 375 / 768 宽度下的实际交互。

## 下一步实现顺序

1. 等 PR #61 修复 lockfile 并通过 PostgreSQL CI / Docker smoke；将通过后的代码更新进本 PR。
2. 运行 Next.js / Docker 现状回归，核实生产入口和旧路径重定向，不以静态配置替代运行验证。
3. 修复 Studio 保存 / 恢复、失败恢复和权限边界测试。
4. 定义素材分类与 UV / 单件预览契约，再扩展帽子、裤子、鞋子等真实素材支持。
5. 完成皮肤导入、即时试穿、搭配保存 / 恢复、PNG 导出的端到端旅程。
6. 所有 P0 自动化与 Docker 门禁通过后，才申请将 PR 转为 Ready for review。



## 最新验证更新（2026-11-06 16:45 UTC）

- PR #61 当前 head：`aa6c4253a04c9a6ef35507e9f904a63d988326e9`。
- Lock refresh workflow #30 成功，根 `package-lock.json` 已与 PostgreSQL-only `package.json` 同步；`npm ci` 通过。
- CI #939：PostgreSQL migrate、unit、integration、Playwright、AI API tests、AI API Docker build、完整 Docker image build 全部通过。
- Next.js Preview/Security #736：PostgreSQL schema/migration、unit/integration、Next.js build、isolated Docker image、security E2E 全部通过。
- Docker #946：PostgreSQL-only 镜像构建、容器启动、health、首页/login/studio/Blockbench/API 路由 smoke test 全部通过。
- 首轮 Docker 构建失败原因是 Next.js build 阶段没有 `DATABASE_URL`；已在 build stage 注入仅用于构建的 PostgreSQL placeholder，运行时仍由容器入口强制要求真实 PostgreSQL URL。
- PR #61 仍为 Draft，等待生产数据库类型、备份和迁移状态确认；没有对生产环境执行迁移或数据删除。


## 最新 CI 与 PR 状态复核（2026-11-06 16:55 UTC）

- PR #61：CI #939、Preview/Security #736、Docker smoke #946 全部成功；发布与 1Panel 部署步骤跳过。PR 分支落后 main 2 个提交，尚未合并。
- PR #64：CI #955、Preview/Security #745、Docker smoke #955 全部成功。需要注意 PR #64 运行时采用的仍是 main 上旧版多数据库 workflow：日志明确执行 PostgreSQL / MySQL / SQLite runtime smoke 和多 schema Prisma generate。因此该组绿灯只证明 PR #64 的路由改动没有破坏旧基线构建，不能作为 PostgreSQL-only 结果。PR #61 合并后必须在新 main 基线上重跑。
- PR #64 新增 `lib/legacy-route.ts` 与 `tests/browser/legacy-routes.spec.ts`，将旧入口的 query string 保留后重定向；该项可标记完成，Studio 的实际业务闭环仍未验收。
- 构建仍有 Turbopack dynamic filesystem tracing warnings，涉及 `app/api/workspace/route.ts`；虽未阻断 CI，后续应检查 standalone output tracing 范围与镜像体积。


## 最新验证更新（2026-11-07 10:35 UTC）

- PR #64 当前提交 `3a267a0201841a563ca507f8df71f79b95ab1a42` 的 CI #1029、Next.js Preview/Security #818、Docker smoke #1028 均成功。
- CI #1029 的 unit tests、PostgreSQL integration、MySQL integration、SQLite integration、Next.js production build、Playwright browser regression、AI API tests、AI API container build 和完整 CDPC Docker image build 均通过。
- Preview/Security #818 的 Prisma schema validation、PostgreSQL/MySQL/SQLite migrations、RBAC/ownership unit tests、PostgreSQL integration、Next.js production build、三种数据库 runtime image build 与 security E2E 均通过。
- Docker smoke #1028 的单一 runtime-switchable image build，以及 PostgreSQL/MySQL/SQLite 容器启动 smoke 均通过；publish 与 1Panel V2 deploy job 为 skipped，未发布镜像、未部署生产。
- 本轮修正 `tests/browser/studio-core.spec.ts`：在披肩仍处于选中状态时先验证独立预览，再切换外套并验证同槽位互斥；避免测试先切换外套、再错误要求已被移除的披肩仍可预览。提交为 `3a267a0`。
- `tests/browser/auth-navigation.spec.ts` 中已登录头像菜单到 `/u/[username]` 的端到端测试本轮通过，验证了个人主页链接 href、点击后 URL，以及菜单悬停、Escape 和外部点击关闭行为。此项有本轮 Playwright 通过证据；真实生产账号与生产域名仍未人工验收。
- 注意：以上 #1029/#818/#1028 仍使用当前 main 的多数据库测试矩阵，不是 PostgreSQL-only 最终基线。PR #61 仍为 Draft 且未合并；其 PostgreSQL-only 变更需在同步 main 后重跑并完成生产数据库/备份确认。
- 本轮未合并 PR、未发布镜像、未触发 1Panel 部署、未执行生产迁移。Studio 的单件真实渲染、完整分类 UV、皮肤导入/编辑/保存恢复/导出完整旅程仍未完成验收，不能因 CI 绿灯标记为完成。
