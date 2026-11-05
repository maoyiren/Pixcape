# CDPC 路由与用户空间架构决策

> 状态：已由产品负责人确认，作为后续实现基线  
> 日期：2026-11-05  
> 仓库：`maoyiren/Pixcape`

## 1. 决策摘要

CDPC 采用简洁的两级用户空间路由：

- 平台功能使用稳定的产品主路径，例如 `/ai`、`/editor`、`/studio`。
- 用户空间统一使用 `/u/[username]`，其下承载该用户的主页、衣橱、创作、素材、收藏与设置。
- 创作工作台与用户空间分离：`/studio` 负责正在进行的创作；保存后的内容归属用户空间。
- 不采用 `/me`、`/@username` 或 `/profile/[username]` 作为规范路径。
- 不再把 `/dress-up` 与 `/wardrobe` 维护成两套独立产品。

此文档是路由和产品边界决策，不代表相应页面、数据模型或权限逻辑已经在代码中实现。

## 2. 规范路由表

### 平台主路径

| 路径 | 职责 |
| --- | --- |
| `/` | 平台首页 |
| `/ai` | AI 皮肤生成 |
| `/editor` | 单张皮肤编辑 |
| `/studio` | 统一换装与搭配工作台 |
| `/creator` | 创作者中心入口 |
| `/admin` | 管理后台逻辑入口；实际后台路径可由既有安全配置决定 |

### 用户空间

| 路径 | 职责 | 默认可见性 |
| --- | --- | --- |
| `/u/[username]` | 用户主页 | 公开 |
| `/u/[username]/wardrobe` | 用户已发布的穿搭 | 公开内容 |
| `/u/[username]/creations` | 用户作品集 | 公开内容 |
| `/u/[username]/assets` | 用户发布的素材 | 公开内容 |
| `/u/[username]/favorites` | 用户收藏 | 默认私有，可显式公开 |
| `/u/[username]/settings` | 账号与个人空间设置 | 仅本人 |

所有权和权限以内部不可变的 `userId` 为准，不能以 URL 中的用户名作为授权依据。

### 独立内容详情

| 路径 | 职责 |
| --- | --- |
| `/outfit/[id]` | 单套穿搭详情与分享 |
| `/asset/[id]` | 单件素材详情 |
| `/skin/[id]` | 皮肤详情 |

详情页是否可访问由内容发布状态、可见性和服务端权限共同决定。

## 3. Studio 与用户空间的边界

`/studio` 是创作工具，不是个人主页：

- 创建、编辑当前穿搭项目。
- 选择基础皮肤和 Steve / Alex 模型。
- 选择披肩、外套、披风、帽子、上衣、裤子、鞋子及配饰。
- 进行实时 3D 预览、动作与视角控制。
- 导入皮肤/素材、导出兼容 PNG、导入导出 JSON。
- 将项目保存到当前登录用户名下。

`/u/[username]/wardrobe` 是用户内容空间：

- 展示已保存且允许公开的穿搭。
- 本人访问时显示编辑、复制、删除、发布等操作。
- 其他用户只能查看公开内容，并按规则复制或收藏。
- 点击编辑时进入 `/studio` 并加载对应项目。

素材选择器是 Studio 内的工作流能力；`/u/[username]/assets` 是用户公开素材展示，不应另建第二套素材编辑状态。

## 4. 认证与权限规则

1. 页面隐藏按钮不是安全措施。读取、创建、更新、删除、发布和导出私有资源的服务端 API 都必须校验会话与资源所有权。
2. `/u/[username]/settings` 必须同时验证当前会话用户 ID 与路由用户名解析出的用户 ID 一致。
3. 用户主页和公开内容可匿名访问；私有内容只能由所有者或明确授权角色访问。
4. 管理员权限继续使用现有 RBAC/服务端权限体系，不因用户空间路由改变。
5. 用户名只用于查找公开身份；数据库外键、所有权、审计日志和授权判断始终使用内部 user ID。
6. 对不存在、已注销、被封禁或用户名已变更的用户，按明确状态处理，不得将其误解析为其他用户。

## 5. 用户名规范

- 新用户名统一规范化为小写 slug，URL 中不区分大小写。
- 建议允许 ASCII 字母、数字和单个连字符；长度限制建议 3–24 个字符。
- 禁止空格、斜杠、点号、控制字符及保留路由名称。
- 保留名称至少包括：`ai`、`editor`、`studio`、`creator`、`admin`、`api`、`u`、`outfit`、`asset`、`skin`、`login`、`logout`、`settings`。
- 用户名必须唯一，并在数据库层建立唯一约束；应用层预检查不能替代数据库约束。
- 修改用户名时保留旧 slug 历史。旧 URL 返回永久重定向到新 URL；不能把旧用户名分配给新用户后让历史链接指向错误对象。
- 用户删除或封禁时，旧 slug 按产品政策保留 tombstone/保留期，避免身份冒用。

## 6. 旧路由兼容

兼容跳转应在服务端完成，并保留查询参数：

| 旧路径 | 新路径 |
| --- | --- |
| `/dress-up` | `/studio` |
| `/wardrobe` | 登录用户的 `/u/[username]/wardrobe`；未登录时进入 `/studio` 或登录引导 |
| 旧用户个人主页路径 | `/u/[username]` |
| 旧用户作品/衣橱路径 | 对应的 `/u/[username]/...` |

迁移前必须盘点仓库真实存在的路由和生产入口；不能在未确认旧路径语义时用宽泛 catch-all 重写。重定向应避免循环，并保留资源 ID、查询参数和分享链接有效性。

## 7. Next.js App Router 结构建议

以下是目标结构，不应在未检查当前目录和现有页面后直接覆盖同名文件：

```text
app/
├── page.tsx
├── ai/
├── editor/
├── studio/
│   ├── page.tsx
│   ├── edit/[id]/
│   ├── import/
│   └── export/
├── creator/
├── u/
│   └── [username]/
│       ├── page.tsx
│       ├── wardrobe/
│       ├── creations/
│       ├── assets/
│       ├── favorites/
│       └── settings/
├── outfit/[id]/
├── asset/[id]/
└── skin/[id]/
```

如果项目实际使用 `src/app`，则按当前 Next.js 配置放置，不得同时维护两套 App Router 根目录。

## 8. 导航与交互

- 主导航只展示：首页、AI 创作、皮肤编辑器、Studio、创作者中心。
- 头像菜单提供：个人主页、我的衣橱、我的创作、我的素材、我的收藏、账号设置、退出登录。
- 头像菜单目标统一从当前会话用户的 username 生成 `/u/[username]/...`。
- 游客仍可进入 Studio 进行本地体验；登录后保存到云端。
- 游客本地项目登录后应提供迁移/导入，不得静默覆盖云端项目。
- Studio 保存成功后，提供“查看我的衣橱”入口；发布公开穿搭后提供公开详情链接。

## 9. 数据与迁移原则

- 先审查现有 Prisma schema、用户模型、作品/素材模型和迁移历史。
- 优先复用已有用户 ID、内容 ID 和存储服务，不因路由调整复制一套数据。
- 若缺少 username 字段，新增字段前先确定唯一性、规范化、保留名和历史 slug 迁移策略。
- 若缺少用户穿搭归属，新增关联时必须支持游客本地项目与登录用户项目迁移。
- 对历史数据先做只读盘点和备份；迁移脚本必须可重复执行，并对唯一冲突给出可审计报告。
- 不在此路由决策提交中直接变更生产数据库。

## 10. 实施顺序与验收

### P0：代码盘点
- [ ] 确认 Next.js App Router 实际根目录。
- [ ] 列出当前首页、AI、Editor、Studio、Wardrobe、Creator 和用户相关路由。
- [ ] 检查 NextAuth session 中是否已有稳定 user ID 与 username。
- [ ] 检查 Prisma 用户、素材、穿搭和收藏模型。
- [ ] 盘点旧 Vite 工作台入口及其真实功能，不在迁移中丢失功能。

### P1：路由与用户身份
- [ ] 建立 `/u/[username]` 及其子路由。
- [ ] 实现 username 规范化、唯一约束和保留名校验。
- [ ] 实现用户名历史与旧 URL 重定向。
- [ ] 实现用户空间服务端权限守卫。
- [ ] 头像菜单使用统一的用户空间地址。

### P2：Studio 闭环
- [ ] Studio 创建/编辑项目。
- [ ] 保存到 userId 归属的衣橱。
- [ ] 用户空间查看、编辑和删除穿搭。
- [ ] 公开发布与独立详情页。
- [ ] 旧 `/dress-up`、`/wardrobe` 兼容重定向。

### P3：回归
- [ ] 游客本地创作与登录迁移。
- [ ] 用户 A 无法读取或修改用户 B 的私有数据。
- [ ] 公开/私有穿搭访问矩阵测试。
- [ ] 用户名修改后旧链接重定向。
- [ ] PC 与移动端导航测试。
- [ ] Next.js build、单元/集成/E2E、Docker 构建与健康检查。

## 11. 完成定义

只有在路由真实可访问、数据关联稳定、服务端权限测试通过、旧链接兼容、Studio 保存到用户衣橱的完整链路通过测试后，才能标记为“已完成”。仅增加页面文件、导航链接或本规划文档，不等于功能交付。


## 12. 2026-11-05 仓库只读盘点结果

以下结论来自当前 `main` 分支文件读取；它们是代码盘点结果，不代表生产环境已经部署：

### 已确认的 Next.js 路由现状

- Next.js App Router 根目录是仓库根部的 `app/`，不是 `src/app/`。
- 当前首页 `app/page.tsx` 仍将创作工坊指向 `/workbench`，衣服选装指向 `/wardrobe`。
- `app/workbench/page.tsx` 是 AI、单品编辑和衣橱选装的入口聚合页。
- `app/dress-up/page.tsx` 实际渲染 `DressUpStudio`，是当前 Next.js 3D 换装页面。
- `app/workbench/dress/page.tsx` 已经重定向到 `/dress-up`。
- `app/wardrobe/page.tsx` 渲染 `WardrobeLibrary`，负责云端素材、收藏与穿搭列表；其中选择素材或穿搭时会把工作区状态写入 API，再跳转到 `/dress-up`。
- `app/components/site-nav.tsx` 当前仍同时显示 `/dress-up`、`/workbench`、`/wardrobe` 三个入口；`app/components/account-menu.tsx` 目前提供 `/account`、`/wardrobe` 和 `/creator`，尚未接入用户主页路径。

### 已确认的数据模型

- PostgreSQL、MySQL、SQLite 三套 Prisma schema 都有稳定的 `User.id`。
- PostgreSQL / MySQL 的 `User` 模型当前没有 `username` 字段，也没有用户名历史/保留名模型；`CreatorProfile.displayName` 不能直接替代唯一用户名。
- 已存在 `Outfit`、`OutfitItem`、`Asset`、`AssetFavorite`、`Publication`、`WorkspaceState`，且 Outfit/Asset 已通过 ownerId 关联用户。
- 素材分类已区分 `SHAWL`、`COAT`、`CAPE`，这三类不能合并。
- NextAuth 当前会话与用户身份基于数据库 user ID；后续应在 session 中安全提供 username，授权仍使用 user ID。

### 对实施顺序的影响

1. 不能直接创建新的独立换装引擎。应先将现有 `app/dress-up/dress-up-studio.tsx` 作为唯一 3D 换装实现迁移到规范的 `/studio` 入口。
2. `/wardrobe` 现有页面是素材/衣橱库，不应粗暴重定向丢弃其功能；应拆分“我的私有衣橱”和“公共素材浏览”的产品职责，再把用户个人数据入口迁到 `/u/[username]/...`。
3. `/workbench` 是旧的入口聚合页，需逐步退场或重定向；AI 与 Editor 保留各自正式主路径。
4. 用户路由上线前必须先完成三套 Prisma schema 的 username/slug 历史设计与迁移，并补充 session 字段、服务端授权和测试。
5. 在实际迁移 PR 中需同步更新首页、主导航、头像菜单、面包屑、站内链接、SEO canonical 和旧路径兼容规则。

### 盘点状态

- [x] 确认 App Router 根目录。
- [x] 确认当前首页、工作台、换装页、衣橱页和账号菜单的主要入口。
- [x] 确认三套 Prisma schema 中 User、Outfit、Asset、Publication 的关键关系。
- [ ] 进一步检查完整换装组件、服务端 API 权限、数据库 migration 历史和 E2E 覆盖。
- [ ] 在代码变更 PR 中完成路由迁移与验证。
