# CDPC / Pixcape 项目总技术与文档总纲

- **文档版本：** V1.0
- **整理日期：** 2026-10-25
- **主仓库：** https://github.com/maoyiren/Pixcape
- **产品域名目标：** https://cdpc.cc
- **用途：** 将产品目标、技术架构、功能规格、认证与数据库、部署运维、UI 重构、测试、安全、合规和待办事项汇总为单一主参考文档。
- **重要边界：** 本文是项目主索引与技术总纲，不替代代码、环境变量、迁移文件和具体运行日志。所有功能状态区分“代码/文档已记录”“需要部署配置”“尚待最新 CI 或生产验证”。不得把规划写成已上线事实。

---

## 1. 项目定位与产品原则

CDPC（仓库历史名称 Pixcape）是面向 Minecraft 角色皮肤、像素服装与配饰设计、搭配预览、创作管理和原创内容分享的平台。它首先是一个创作工具与素材平台，不是单纯的 AI 图片展示站。

核心产品能力：
1. 皮肤/服装贴图导入、像素编辑、预制合成和 PNG 导出。
2. Steve / Alex 角色及服装的 3D 预览。
3. 独立的衣橱选装流程：单件试穿、整套搭配、保存、继续编辑和适用格式导出。
4. AI 文本生成与参考图转换，具体模型以服务端真实配置为准。
5. 个人作品、创作者资料、素材发现与社区发布能力。
6. 统一的登录、角色权限、管理员配置、审计与健康检查能力。

产品术语必须准确：
- **披肩、外套、披风**是三个不同类别，不能在 UI、数据模型、预览、兼容性或授权信息中混为一类。
- 皮肤 PNG、站内 3D 预览配饰、需要独立模型/模组/服务器支持的物品是不同的交付形态。
- 标准 Minecraft 皮肤 PNG 并不原生承载所有披风、披肩、外套模型。不可兼容的素材必须明确提示，不能声称所有物品都可合并导出为标准皮肤。
- “保存、下载、导出、发布、分享、使用素材、继续编辑”含义不同，每个按钮必须有真实行为和状态反馈。
- 只有真实接入的功能、模型、动画、登录提供商与数据持久化能力才能显示为可用。

## 2. 仓库与文档治理

正式代码仓库：`maoyiren/Pixcape`。正式文档目录为 `docs/`，不再创建第二套旧 `doc/` 文档目录。

关键文档（具体内容仍以各文件与代码为准）：
- [项目概览](PROJECT_OVERVIEW.md)
- [技术架构](ARCHITECTURE.md)
- [编辑器使用指南](USER_GUIDE.md)
- [开发与贡献](DEVELOPMENT.md)
- [部署入口说明](DEPLOYMENT.md)
- [单镜像生产部署与环境变量](SINGLE-IMAGE-PRODUCTION.md)
- [登录/OAuth/邮箱魔法链接/管理员初始化](AUTHENTICATION-SETUP.md)
- [用户角色与数据库迁移](NEXTJS-USER-ROLES-MIGRATION.md)
- [独立 Next.js 容器部署](NEXTJS-CONTAINER-DEPLOYMENT.md)
- [AI 模型架构](AI-MODEL-ARCHITECTURE.md)
- [生产安全上线清单](PRODUCTION-SECURITY-ROLLOUT.md)
- [发布与回滚清单](RELEASE.md)
- [PWA、SEO 与分享元数据](PWA-SEO-DEPLOYMENT.md)
- [全站 UI 与功能重构实施计划](UI-FUNCTION-REFACTOR-PLAN.md)
- [第三方许可证](../THIRD_PARTY_NOTICES.md)

维护规则：
1. 代码、路由、环境变量、Docker 入口或 UI 行为变化时，在同一 PR 更新本总纲和相关专项文档。
2. 以代码、`.env.example`、Prisma schema/migrations、Dockerfile、entrypoint、GitHub Actions 最新 run 为准。
3. 文档写了配置方法不等于生产已经配置；CI 通过不等于部署完成；镜像构建成功不等于线上功能通过。
4. 不在文档、日志、截图或提交中放置真实密码、API Key、OAuth Secret、数据库连接串或魔法登录链接。
5. 本文记录的状态如与最新 main/CI/生产证据冲突，先更新状态和证据，不以旧记录覆盖新事实。

## 3. 当前技术栈

以当前根目录 `package.json` 与部署文件为准，记录的主要组件包括：

| 层级 | 技术/职责 |
|---|---|
| 像素编辑器 | React、TypeScript、Vite |
| 3D 角色预览 | Three.js、skinview3d |
| 内置模型编辑器 | Blockbench Web，服务路径为 `/blockbench/` |
| 主站、账户与 API | Next.js、React、NextAuth v4 |
| 数据访问 | Prisma，多数据库 provider 适配 |
| 数据库候选 | PostgreSQL、MySQL/MariaDB、SQLite |
| UI 体系 | Mantine 为主要交互组件；Tailwind CSS v4 负责布局与响应式；shadcn/ui 只作为精选补充；Radix/Lucide 等现有依赖按需保留 |
| 表单与验证 | React Hook Form、Zod |
| 邮件 | Nodemailer/SMTP |
| 容器与路由 | Docker、多阶段构建、Nginx |
| PWA | vite-plugin-pwa、Workbox |
| 测试 | Node test runner、Playwright 浏览器测试、集成/安全测试 |
| CI 与依赖维护 | GitHub Actions、Dependabot（具体工作流以仓库为准） |

### 3.1 前端与服务架构原则

目标架构是 Next.js 承担主站、账户、创作者/管理员页面与 API；Vite 编辑器继续承担像素编辑和已有创作引擎；Blockbench 保持独立静态入口；在单镜像方案中由 Nginx 统一对外路由。不要把 Vite 编辑器当作另一套主站导航，也不要让用户通过没有实际价值的旧页面来回跳转。用户可见的核心页面应由 Next.js 统一承载，并通过受控入口进入 Vite 编辑器。

部署文档描述的预期路由包括：
- Next.js 主站与页面：`/`、`/login`、`/account`、`/creator`、`/admin`
- API：`/api/`，AI API：`/api/ai/`
- Vite 工作台/编辑器：`/studio/`
- Blockbench：`/blockbench/`

以上是目标/文档路由，必须通过当前镜像与生产环境实测确认可达。不要混用根目录 Dockerfile、`Dockerfile.nextjs` 和不同部署文档的端口/启动假设。

### 3.2 现有像素画布模型（架构文档记录）

- 画布是 64×64，共 4096 个像素槽位，以字符串数组表示。
- 空字符串表示透明；颜色字符串表示像素颜色；索引使用 `y * SIZE + x`。
- 已记录工具类型包括 Pencil、Eraser、Fill、Eyedropper、Line。
- 撤销/重做基于像素数组快照，历史在浏览器内存中，刷新不会自动保留。
- 图片导入通过临时 Canvas 缩放/居中到 64×64；低于透明度阈值的像素保持透明，其他像素转为 RGB 十六进制色。因此半透明像素会失去原始 alpha 精度。
- PNG 导出使用透明 Canvas。
- 当前编辑器运行时画布状态本身不等于云端项目持久化格式。跨设备同步、自动云保存等能力必须有真实后端实现后才能宣传。

## 4. 产品信息架构与路由约定

规范路由基线来自 UI 重构计划；具体实现需逐项验收：

| 路径 | 页面职责 |
|---|---|
| `/` | 首页、产品能力介绍、主要创作入口 |
| `/ai` | AI 文本生成/图片转换入口 |
| `/editor` | 单品编辑器/像素编辑入口 |
| `/wardrobe` | 独立衣橱选装 |
| `/dress-up` | 独立 3D 选装页面；不要未经验证将其降级为简单重定向 |
| `/workbench` | 创作工作台、最近作品与创作入口 |
| `/workbench/ai` | 工作台内 AI 创作入口 |
| `/workbench/edit` | 工作台内单品编辑入口 |
| `/workbench/dress` | 工作台内衣橱选装入口 |
| `/account` | 账户摘要与账户操作 |
| `/creator` | 当前用户创作者中心 |
| `/creator/:id` | 创作者公开资料（公开/审核状态须校验） |
| `/admin` | 管理后台；子页面按真实实现开放 |
| `/studio/` | Vite 编辑器承载入口 |
| `/blockbench/` | Blockbench Web |

旧路径仅在有明确兼容需求时做重定向，例如计划中记录的 `/AI`、`/bench`；不要在没有核对现有链接和真实业务行为前批量删除。素材库、社区若尚无完整正式路由，不应显示成已上线一级导航。

全站导航应统一 Logo、主要入口、搜索、语言切换、用户菜单和登录/注册入口。PNG 导出、管理员操作和具体服装分类应放在对应页面内部，而不是堆进顶栏。登录用户的账户入口指向真实的 `/account`；创作入口指向 `/workbench` 或相应工具，不要把二者混为同一路径。

## 5. UI 与交互规范

### 5.1 组件职责

- **Tailwind CSS v4：** 布局、Grid/Flex、断点、间距、尺寸、排版和设计 token 使用。
- **Mantine：** 默认按钮、输入框、选择器、弹窗、抽屉、Tabs、通知、Tooltip、Popover、表格、分页、表单状态和管理面板。
- **shadcn/ui：** 仅作为精选补充（例如命令面板或确有必要的 Radix 交互），不能与 Mantine 同时成为全站默认组件体系。
- **业务引擎：** 像素画布、skinview3d/Three.js 和 Blockbench 保留为专门引擎；组件库负责外围 UI，不替换绘图/3D 引擎。

同类业务组件只维护一个默认实现。共享主题、按钮尺寸、圆角、焦点、状态提示、暗色 token 和响应式规则必须统一。

### 5.2 按钮、表单与状态

所有可见按钮必须具备真实行为。适用的异步操作应提供默认、加载、成功、失败、禁用和权限不足状态；避免重复提交。删除、覆盖、下架、封禁等危险操作需要说明对象/影响、必要时二次确认，并由后端执行权限检查。成功提示必须由真实操作结果触发。

统一术语：
- 保存：写入当前草稿或账号数据。
- 下载：将文件保存到本地。
- 导出：按指定格式生成文件。
- 发布：向社区提交内容并应用可见性/授权规则。
- 分享：真实打开分享能力或生成链接。
- 使用素材：将素材载入当前选装/创作流程。
- 继续编辑：将正确的作品、贴图、分类、格式与素材引用传入编辑器。
- 恢复默认不等于全部脱下；重置视角不修改作品数据。

### 5.3 响应式与可访问性

桌面、平板、手机共用设计规范；验证 320–420px 窄屏、键盘焦点、触摸操作、表单错误提示、横向溢出、减少动态效果和可读性。管理后台桌面端采用固定分区导航，小屏折叠/换行，表格在窄屏容器内横向滚动。

## 6. 核心功能规范

### 6.1 创作工坊

建议工具栏顺序：返回、作品名、撤销、重做、保存、导入 PNG、导出、更多操作。左侧为绘图工具，中间为 2D 贴图与 3D 预览，右侧为颜色、图层、工具参数、素材属性、兼容性和导出设置。当前编辑对象必须清晰可见。导入时校验格式/尺寸并提示是否替换；导出失败应保留编辑状态。

### 6.2 衣橱选装（独立一级功能）

桌面布局为左侧素材分类/搜索/筛选，中间 3D 角色预览，右侧当前穿搭清单和操作。手机使用抽屉或底部面板。至少支持：
- 单件试穿、同类替换、脱下、随机搭配、全部脱下、恢复默认。
- 360° 旋转、缩放、重置视角、真实存在的动作切换、背景切换、单件显示/隐藏。
- 保存穿搭、继续编辑、预览和适用格式导出。
- 未登录时允许与产品设计一致的临时体验；保存到账户时要求登录，并尽可能保留可恢复状态。
- 保存穿搭应包含名称、封面、基础皮肤/角色引用、素材清单、分类、格式/兼容性、所属用户、可见性与时间戳。
- 继续编辑要传递完整穿搭数据，不得静默覆盖原件；提供更新原件或另存为新版本的明确选择。

素材分类至少保持独立：皮肤、上衣、外套、裤子、鞋子、帽子、披肩、披风、其他配饰、整套穿搭和模板。素材元数据应包含格式、模型/贴图、兼容性、许可与署名要求。

### 6.3 3D 预览

保留 skinview3d/Three.js。预览需验证角色模型、服装覆盖关系、视角、动作、背景、截图和不同设备性能。用户已指出的专项问题包括：披风/鞘翅模糊或错位、披风摆动方向错误、与胸背位置关系不正确、鞘翅展开角度过大、飞行动作不自然，以及旋转在约 180° 附近受阻。验收目标是无不必要阻尼的连续 360° 旋转、相机与模型变换分离、披肩/披风使用独立配置，且按钮对应真实动画。尚未逐项通过实际浏览器验收前，均视为待办而非已解决。

### 6.4 AI 创作

支持两个明确流程：
1. 文本描述 → 选择服务端可用模型 → 提交任务 → 状态/进度 → 查看结果 → 继续编辑/保存/下载。
2. 上传参考图 → 文件预览与替换 → 格式/大小检查 → 选择模型 → 提交 → 查看结果 → 继续编辑。

模型候选与环境变量中记录的供应商包括 Gemini、OpenAI、OpenRouter，以及火山引擎 Ark / Seedream 相关配置。具体可用性由服务端配置和模型 API 决定；不得因环境变量模板存在就宣称模型已经接通。API Key 只存服务端 Secret；必须限制上传大小、请求频率、超时、来源、重复任务和错误输出；失败时保留用户输入，不能向浏览器泄露密钥或内部堆栈。AI 结果要经过 Minecraft 皮肤贴图映射/尺寸/格式校验，支持 Classic/Slim（若实现），并接入 3D 预览、继续编辑和 PNG 下载。

### 6.5 个人中心与创作者

个人中心负责资料、作品、穿搭、AI 生成记录、收藏、最近编辑、账户安全和登录方式。作品支持打开、继续编辑、重命名、复制、导出/下载、删除、公开状态管理；穿搭应作为独立数据类型，不与单张皮肤贴图混称。

项目产品方向采用“注册即创作者”的低门槛思路，但创作者公开资料、发布权限、内容审核和账户状态仍须由服务端规则控制。普通注册用户不自动获得管理员权限。

### 6.6 社区与素材库

社区/素材库是产品目标，但必须按实际路由、数据模型、API 和审核链路确认是否完整上线。规划能力包括搜索、分类、标签、排序、详情、作者、格式兼容性、授权/署名、收藏/点赞/评论/分享/举报、草稿与发布。保存草稿不等于发布；发布失败保留草稿；用户只能管理自己有权操作的资源；审核和重要管理操作要有审计记录。

### 6.7 管理后台

管理后台目标是 WordPress 风格的信息架构：左侧固定分区导航、顶部工具栏、主体内容、面包屑、通知与统一表单。规划模块：
- 系统总览与健康检查
- 用户管理、账户状态、角色权限
- 素材管理、授权信息与下架
- 社区作品/评论/举报审核
- AI 服务与模型配置
- 认证提供商配置状态
- 系统设置
- 操作审计

安全规则：管理员权限在服务端校验；前端隐藏菜单不构成安全控制；普通用户不能调用管理 API；密钥写入时通过安全服务端机制，读取时脱敏；健康检查不得暴露数据库密码、完整环境变量或凭据。必须区分公开业务设置、管理员可编辑的非敏感设置、部署 Secret 和只读运行状态。管理后台中若 OAuth/SMTP 配置仍是占位 UI，不可声称能保存这些 Secret。

## 7. 认证、账户与权限

当前文档记录使用 NextAuth v4。计划/配置支持的方式包括 GitHub、Google、Microsoft Entra ID、Apple 与邮箱魔法链接，但只有环境变量成对配置且真实验证通过的方式才可展示为可用。邮箱魔法链接记录的有效期为 15 分钟，邮件通过 SMTP/Nodemailer 发送。

生产主域名目标固定为 `https://cdpc.cc`，认证 URL 应与之匹配。文档记录的 OAuth 回调：
- GitHub：`https://cdpc.cc/api/auth/callback/github`
- Google：`https://cdpc.cc/api/auth/callback/google`
- Microsoft：`https://cdpc.cc/api/auth/callback/azure-ad`
- Apple：`https://cdpc.cc/api/auth/callback/apple`

OAuth 控制台的协议、域名和路径必须完全匹配。此前已报告过 OAuth redirect_uri 未与应用关联的问题，因此生产验收必须实际测试登录发起、提供商回调、会话创建、数据库持久化、退出与受保护页面跳转。

管理员初始化是受控的一次性操作：先让目标用户正常登录并生成数据库记录，再按认证文档使用 `BOOTSTRAP_ADMIN_EMAIL` 执行 `npm run db:bootstrap-admin)，核验后立刻删除该变量。不得把新注册用户默认升级为管理员。

认证安全至少包括登录限流、可信代理 IP 头、失败关闭、角色隔离、资源所有权、封禁后旧会话失效、CSRF/回调地址检查、错误信息脱敏和审计。不要让客户端传入的 role/admin 参数授予权限。

## 8. 数据库与数据持久化

部署文档记录三种 provider：
- PostgreSQL：`DATABASE_PROVIDER=postgresql`
- MySQL/MariaDB：`DATABASE_PROVIDER=mysql`
- SQLite：`DATABASE_PROVIDER=sqlite`

三者都需要匹配的 `DATABASE_URL`、schema/client 与 migration。SQLite 仅适合单实例，并需将数据库文件放在持久化卷（文档示例 `file:/data/pixcape.db`）；不能让多个副本共享同一 SQLite 文件。PostgreSQL/MySQL 需要预先创建数据库和最小权限用户。

运行脚本以当前 package.json 为准，已记录：
- `npm run db:generate:all`：生成各 provider Prisma client
- `npm run db:migrate`：部署迁移
- `npm run db:bootstrap-admin`：受控管理员初始化
- `npm run db:push`：项目封装的 db push 脚本

数据库上线规则：
1. 生产迁移前确认目标实例并创建可恢复备份。
2. 检查迁移状态后，由操作者确认再执行迁移。
3. 不在生产执行 `migrate reset`，不手工删除迁移记录。
4. 每种 provider 都需独立集成/运行测试；生成客户端或编译成功不等于兼容性验证完成。
5. 验证写入、读取、重启后数据仍存在，以及资源所有权和并发安全。

## 9. Docker、Zeabur 与生产环境

目标部署是把 `cdpc.cc` 指向 Zeabur 上的 Pixcape 应用，而不是继续把独立 home 项目作为主入口。根目录 Dockerfile、Next.js 独立 Dockerfile、entrypoint 和历史部署文档可能对应不同阶段，发布前必须以当前 main 文件核对实际入口。

单镜像文档记录的预期流程：启动时在配置数据库时应用 Prisma migration，然后启动 AI API、Next.js 与 Nginx；但实际启动顺序、端口、健康检查必须从当前 `docker-entrypoint-single.sh` 和镜像日志确认。

关键环境变量（名称以代码和 `.env.example` 为准）：
- 数据库：`DATABASE_PROVIDER`、`DATABASE_URL`
- NextAuth：`NEXTAUTH_SECRET`、`NEXTAUTH_URL`
- OAuth：`AUTH_GITHUB_ID`、`AUTH_GITHUB_SECRET`；Google/Microsoft/Apple 对应变量见认证文档
- SMTP：`EMAIL_SERVER`、`EMAIL_FROM`
- 登录限流：`LOGIN_RATE_LIMIT_MAX`、`LOGIN_RATE_LIMIT_WINDOW_SECONDS`、`LOGIN_RATE_LIMIT_IP_HEADER`
- AI 通用：`AI_ALLOWED_ORIGINS`、`AI_DEFAULT_PROVIDER`、`AI_DEFAULT_MODEL`、`AI_MAX_UPLOAD_MB`、`AI_RATE_LIMIT_PER_MINUTE`、`AI_TIMEOUT_MS`
- AI 供应商：Gemini、OpenAI、OpenRouter、Ark/Seedream 对应的 API Key、模型名、尺寸和兼容别名
- 管理员 bootstrap：`BOOTSTRAP_ADMIN_EMAIL` 仅用于受控初始化，不应长期存在
- 通用运行环境：`NODE_ENV=production`；Compose 示例端口变量为 `PIXELCAPE_PORT`

所有 Secret 只能放在 Zeabur 或其他部署平台的 Secret/环境变量配置中。不要放进 `VITE_*`、`NEXT_PUBLIC_*`、源代码、构建参数或公开日志。改动 Secret 后按平台要求重启/重新部署，并实际验证。

发布验收最少检查：
- 镜像 tag/digest 与发布提交 SHA 一致。
- 容器健康、启动日志与迁移状态正常。
- `/`、`/studio/`、`/blockbench/`、`/login`、`/api/auth/providers`、`/api/ai/models`、`/health` 按当前实现可达。
- 登录/OAuth/邮件、普通用户/创作者/管理员权限、限流和资源隔离通过。
- PNG 导入/导出、3D 预览、Blockbench、PWA 缓存与移动端基本功能无回归。
- 重启后数据库持久化，失败时有可执行回滚方案。
- GitHub Actions 对最新提交的 CI、安全、浏览器与 Docker 工作流结果通过。旧提交的成功记录不能替代当前 head 验证。

## 10. 测试与质量门禁

当前 package scripts 记录的主要测试命令：
```bash
npm run build
npm run next:build
npm run test
npm run test:e2e
npm run test:browser
npm run test:mysql-rate-limit
npm run test:sqlite-rate-limit
```
具体命令是否适用于当前工作分支应以 package.json 为准；执行前确认所需数据库、浏览器和环境变量已准备。

质量门禁：
- TypeScript 与构建成功。
- 单元测试、集成/安全测试、浏览器 E2E 按改动范围执行。
- 三种数据库分别进行真实运行验证。
- OAuth/SMTP/AI 在真实预览环境测试，不仅看静态配置。
- RBAC、资源所有权、封禁与会话、限流失败关闭、重复提交、审计日志覆盖。
- 320–420px 窄屏、键盘焦点、触摸、无横向溢出。
- Docker 镜像构建、容器启动、健康检查与路由检查。
- 对第三方依赖和许可证进行检查。

如果 GitHub Actions 因账户计费/额度问题无法运行，应明确标记“未验证/被环境阻塞”，不得伪报通过。PR 合并、CI 通过、镜像发布、生产部署、生产验收是五件不同的事。

## 11. UI 重构进度快照（2026-10-25）

以下状态来自仓库 `docs/UI-FUNCTION-REFACTOR-PLAN.md` 当日记录，须继续以当前 main、PR 和 Actions 最新结果复核。

### 已有记录的实现/代码迁移
- 根项目引入 Mantine 与 Tailwind CSS v4，Next.js 与 Vite 入口共享主题/Provider。
- 登录、注册首批迁移 Mantine，保留 React Hook Form、Zod、认证与校验流程。
- 核心入口 `/ai`、`/editor`、`/wardrobe`、`/workbench` 与编辑器 mode 参数已建立。
- 工作台、AI/编辑器/衣橱入口页、账户摘要、创作者中心、Studio 入口有 Mantine 迁移记录。
- 主导航区分工作台、AI 创作、衣服选装、单品编辑器、创作者中心和个人中心。
- 管理后台已有共享暗色 token、导航、表格和窄屏布局改造记录。
- 浏览器导航与部分移动端测试已补充记录。
- UI 计划记录：第二阶段某一提交的 CI、安全测试和 Docker 工作流成功；该结果只对记录中的特定 SHA 有效，不能外推到后续提交。

### 仍未整体结项
- 全站旧式按钮、表单、服装卡片、素材列表和编辑器外围尚需逐页迁移。
- 管理后台所有模块需要逐页确认真实业务链路和组件迁移。
- 最新增量的 CI、Next.js 构建、安全测试、浏览器回归和 Docker 构建需重新核验。
- 生产 OAuth、SMTP、AI 真生成、数据库迁移、cdpc.cc 部署后验收仍需真实环境测试。
- 3D 披风/鞘翅、360° 旋转、动画、素材兼容性和导出必须逐项回归。
- PR #25 的原始分支曾存在冲突；计划记录采用从最新 main 切分支并只迁移安全增量的方式处理。PR 当前状态必须重新查询 GitHub，不能从历史记录推断。
- 主分支是否已包含每一项后续增量，须按最新提交/PR diff 逐项确认。

## 12. 外部集成与许可证

### 12.1 Blockbench
项目内置 Blockbench Web，服务入口记录为 `/blockbench/`。必须保留对应 GPL-3.0-or-later 许可声明与第三方通知；升级、构建或裁剪资源时不能移除许可证要求。

### 12.2 Blessing Skin Server
产品架构方向是**独立部署、可替换的皮肤托管/游戏集成服务**，而不是把 Blessing Skin Server 的 PHP/Laravel 代码直接合并进 CDPC 的 Next.js 主应用。此前项目记录提到过集成方案 PR #21，但该计划是否仍存在、是否合并或实施须重新核对。阶段目标可按本地导入/导出 → 独立皮肤服务器 → 游戏端兼容逐步推进；账号映射、资源模型、安全边界、备份和回滚需先设计并验证。

### 12.3 AI 服务
AI 供应商 API 通过服务端代理调用，密钥不可进入浏览器。必须验证服务商的当前 API、模型许可、图像输出能力、上传/生成限制、成本控制和失败处理。Seedream/Ark 是候选集成方向，不能在实际生成与贴图校验未通过前标记为正式功能。

### 12.4 品牌与素材合规
- 产品名展示方向为 CDPC（域名为 cdpc.cc）；代码仓库仍名 Pixcape，清理旧品牌需逐处核对。
- 产品是非官方 Minecraft 社区项目，不得暗示 Mojang Studios、Microsoft 或其他发行方背书。
- 素材须记录作者、许可、署名要求、兼容性与来源；项目历史署名要求为“外套&披肩素材：邹陈云飞”与“外套&披肩素材：Th千”，按素材实际来源和现行文案展示。
- 不把 Minecraft 官方账号披风能力与站内贴图导出混淆；对用户说明站内导出的 PNG 不等于官方账号披风。
- 维护第三方代码/资源声明，按许可证履行分发要求。

## 13. 已知问题与高优先级待办

以下是需要继续核实/解决的已知问题与项目风险清单；不是声称它们都仍然复现。

### P0：生产可用性与安全
- [ ] 核实 `cdpc.cc` 当前指向的服务、镜像 tag/digest、commit SHA 与健康状态。
- [ ] 验证 OAuth redirect_uri，尤其 GitHub 回调 `/api/auth/callback/github`，并回归所有启用的提供商。
- [ ] 验证邮箱魔法链接 SMTP、15 分钟有效期、链接一次性使用与错误脱敏。
- [ ] 确认数据库 provider、持久卷、备份与迁移策略；生产迁移必须先备份并人工确认。
- [ ] 确认管理员登录、普通用户/创作者/管理员角色隔离与服务端 API 权限。
- [ ] 验证 AI API Key 只在服务端，上传大小/限流/超时/成本门禁生效。
- [ ] 检查 GitHub Actions 账户计费/额度是否阻塞最新验证。

### P1：UI 与主流程
- [ ] 按 UI 重构计划完成登录、注册、账户、创作者中心、工作台、AI、衣橱、单品编辑器和管理员后台逐页验收。
- [ ] 移除无用的中间跳转；Next.js 承担用户可见主站，Vite 只作为编辑器引擎入口。
- [ ] 衣橱选装与创作工坊的数据传递、保存、继续编辑、导出完整闭环。
- [ ] 所有按钮具备真实行为、状态反馈、权限与错误处理。
- [ ] 素材库/社区只在后端功能和正式路由完整时展示为已上线。

### P1：编辑器与 3D
- [ ] 修复/回归披风、披肩、外套与鞘翅的模型位置、贴图清晰度、朝向、动画和遮挡。
- [ ] 验证 360° 连续旋转、无 180° 卡点、触控操作与动作切换。
- [ ] 核对 Classic/Slim 皮肤、64×64 PNG、透明像素、导入缩放和导出结果。
- [ ] Blockbench 导入桥接历史报错包括 `Cannot read properties of undefined (reading 'initEdit')` 与 `Cannot read properties of undefined (reading 'includes')`；须以当前代码复测，不能假设仍存在或已修复。

### P2：AI、生态与体验
- [ ] 文生皮肤、图生皮肤在真实模型 API 下端到端验证，并检查输出贴图映射、3D 预览、继续编辑与下载。
- [ ] 管理后台 AI 模型配置明确区分可编辑业务配置与部署 Secret；未实现 Secret 安全写入时只显示配置状态/操作指南。
- [ ] 完善素材授权、作者署名、举报、审核、审计与侵权处理流程。
- [ ] 完成桌面、平板、手机、键盘、焦点和减少动态效果验收。

## 14. 推荐发布流程与回滚

1. 确认当前 main SHA、目标 PR、改动范围与依赖。
2. 阅读当前变更涉及的专项文档和 `.env.example`。
3. 执行类型检查、构建、相关单元/集成/安全/E2E 测试。
4. 对数据库改动先在隔离环境验证 migration，生产变更前做备份。
5. 创建并构建镜像，记录 commit SHA、tag、digest 和工作流 URL。
6. 在预览环境验证核心路由、登录、数据库、AI、3D、导入/导出和权限。
7. 发布到 Zeabur 后确认实际镜像与域名路由，运行生产烟雾测试。
8. 观察日志、健康状态、认证错误与 AI 错误。
9. 若失败，停止进一步变更，按发布文档回滚应用镜像；数据库回滚必须使用已验证的恢复方案，不能随意重置 migration。
10. 更新本文件、专项文档和发布记录，标记通过/失败/未验证及证据链接。

## 15. 项目状态的统一标记方式

每个功能/任务统一采用以下状态之一：
- **已实现（代码证据）**：代码已存在，但不自动代表生产可用。
- **已通过自动化验证**：附对应最新 commit SHA 和 workflow/test 证据。
- **已通过预览环境验证**：附环境、时间和测试结果。
- **已在生产验证**：附域名、镜像 digest、时间与烟雾测试记录。
- **需要部署配置**：代码存在但依赖 Secret、供应商控制台或平台配置。
- **计划中**：需求/文档已定义，尚无足够代码证据。
- **被阻塞**：说明具体外部条件，如计费、权限、第三方配置。
- **未知/待核实**：历史记录不足或状态可能已变化。

禁止把“PR 已合并”“构建成功”“镜像已推送”“生产已部署”“用户流程通过”写成同一件事。

---

## 附录 A：根目录常用命令

以当前 `package.json` 为准，常见命令包括：

```bash
npm install
npm run dev
npm run build
npm run next:dev
npm run next:build
npm run next:start
npm run test
npm run test:e2e
npm run test:browser
npm run db:generate:all
npm run db:migrate
npm run db:bootstrap-admin
```

先检查当前分支与脚本是否适用；需要数据库/浏览器/Secret 的命令必须在安全环境执行。

## 附录 B：关键路径速查

- 根 `package.json`：依赖与脚本事实来源
- `Dockerfile`、`Dockerfile.nextjs`、`docker-entrypoint-single.sh`：部署入口与服务启动事实来源
- `.env.example`：环境变量名称事实来源（不是生产密钥）
- `prisma/`：schema 与迁移
- `src/`：Vite/React 编辑器
- Next.js app/router 与 API 目录：主站、账户、管理员及服务端接口（以当前树结构为准）
- `tests/`：单元、集成、安全和 E2E 测试
- `.github/workflows/`：CI、构建、安全和镜像发布
- `docs/UI-FUNCTION-REFACTOR-PLAN.md`：UI 重构详细实施记录
- `THIRD_PARTY_NOTICES.md`：第三方许可证和署名

**维护责任：** 每次跨模块改动完成后，先更新本总纲的状态/证据，再更新专项文档索引，确保新加入项目的人能从这一份文件理解产品、架构、风险和下一步工作。
