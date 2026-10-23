# CDPC 新增技术库选型与接入规划

- 版本：V1.0
- 规划日期：2026-10-23
- 项目：CDPC（原 Pixcape）
- 依据：docs/UI-FUNCTION-RESTRUCTURE-PLAN.md
- 状态：选型提案；不代表依赖已安装或功能已实现

## 1. 选型原则

1. 先盘点现有依赖、组件导入和路由，再决定是否安装。
2. 保留 React + TypeScript + Vite 编辑器、Next.js 账户服务、Prisma 数据层。
3. UI 组件体系只设一个主体系，不叠加多个完整设计系统。
4. 保护 Three.js、skinview3d、Blockbench Web、皮肤 PNG 导入/导出及现有账号数据。
5. 每个新增库必须对应具体功能、测试和维护责任。
6. 安装时核对当前版本兼容性、许可证、Node/Docker 环境及锁文件，不凭文档声称已使用最新版。

## 2. 当前已有能力：优先复用

| 领域 | 已有依赖/能力 | 规划 |
|---|---|---|
| UI 原语 | Radix UI（Tabs、Tooltip、Select 等） | 盘点实际使用后保留必要原语 |
| 图标 | lucide-react | 全站统一，不再加第二套图标库 |
| 前端 | React、TypeScript、Vite | 保留编辑器架构 |
| Web/账户 | Next.js、NextAuth | 明确 Vite 与 Next.js 页面及部署边界，不新增 Web 框架 |
| 数据层 | Prisma、PostgreSQL/MySQL/MariaDB/SQLite 适配 | 延续现有方案，迁移需可回滚 |
| 3D | Three.js、skinview3d | 保留，不替换渲染引擎 |
| 邮件 | Nodemailer | 复用，优先修复现有配置与流程 |
| PWA | vite-plugin-pwa | 审计当前 Service Worker 和缓存策略 |
| 测试 | Node test runner、现有单元/集成/E2E 脚本 | 先完善已有测试，再补缺口 |

## 3. 建议新增或评估的库

| 优先级 | 库/方案 | 对应功能 | 接入边界 |
|---|---|---|---|
| P0 | Mantine（主 UI 体系候选） | 导航、页脚、表单、弹窗、Tabs、后台界面、响应式布局 | 先与 Radix 做组件盘点。若选 Mantine 为主体系，只保留必要 Radix 原语；先迁移一个试点页面再决定推广 |
| P0 | React Hook Form | 登录/注册、资料、投稿、管理设置等复杂表单 | 复杂和重复表单优先；简单表单不必强制改写 |
| P0 | Zod | 表单、API 输入、AI 请求和配置校验 | 服务端必须再次校验；客户端校验不代替授权 |
| P0（按需） | Vitest | UI/编辑器工具函数单元测试 | 先评估 Node 内建测试；只有需要与 Vite 集成及 React 组件测试时再引入，避免两套重复入口 |
| P0（按需） | Testing Library（React） | 登录、导航、表单、权限提示交互测试 | 与组件测试框架配套，按用户可见行为测试 |
| P0（按需） | Playwright | 登录流程、权限、关键编辑流程、桌面/移动端冒烟测试 | 先核对现有 E2E 是否已有浏览器自动化；缺失时再引入。外部 OAuth 需区分模拟与真实线上验证 |
| P1（按需） | TanStack Query | 素材、社区、收藏、个人中心和后台数据刷新/缓存 | 仅管理客户端服务器状态；避免与 Next.js 服务端取数/缓存重复 |
| P1（按需） | TanStack Table | 用户、审核、AI 任务、审计日志等复杂表格 | 只用于确有排序、筛选、列控制需求的后台表格 |
| P1（按需） | Recharts 或现有图表方案 | 后台趋势和统计 | 只选一个；真实数据接口准备好后再接入 |
| P1（二选一） | Mantine Notifications 或 Sonner | 保存、导出、登录、投稿等操作反馈 | 若 Mantine 提供能力足够就复用，不再另装通知库 |
| P1（可选） | Sentry SDK | 前后端异常和发布版本追踪 | 先评估隐私、采样、保留和成本；过滤密钥、令牌、邮箱及上传内容 |
| P1（可选） | i18next + react-i18next | 中英文界面与错误提示 | 先盘点现有翻译方案；已有则扩展，不维护两套 |
| P2（按需） | Sharp | 素材缩略图、上传图片预处理 | 不得破坏原始 64×64 皮肤纹理；保留无损原件并检查 Docker 原生依赖兼容性 |
| P2（按需） | Redis 服务及客户端（如 Upstash Redis） | 多实例限流、AI 配额和滥用控制 | 先审计现有数据库限流；只有多实例或性能瓶颈明确时再加 |
| P2（按需） | S3 兼容对象存储 SDK | 上传、作品图、AI 生成文件 | 先定义权限、生命周期、删除与备份；现有存储足够时不急于迁移 |
| P2（按需） | AI SDK 或供应商官方 SDK | 文字生成皮肤、图片转皮肤、模型路由 | 先定义统一内部接口，再按实际供应商选择；API 密钥只能在服务端 |
| P2（可选） | Pino | 结构化服务日志 | 先审计现有日志；运行日志与管理审计分离，严禁记录秘密值 |
| P2（按需） | axe-core / @axe-core/playwright | 键盘、焦点、标签和无障碍回归 | 与关键页面测试配套，自动化不能替代人工键盘检查 |

## 4. 按功能模块规划

### 4.1 全站 UI 和布局
- 主组件体系只选择一套；Mantine 是候选方案，须先做现有 Radix 使用盘点。
- 图标继续用 Lucide React。
- 使用 CSS variables 统一颜色、间距、圆角、层级和焦点样式，不额外引入设计系统框架。
- 在项目内建立共享的 AppShell、MarketingLayout、BrowseLayout、EditorLayout、AuthLayout、AccountLayout、AdminLayout。
- 通知、加载、空、错误、无权限状态集中维护，避免各页面重复实现。

### 4.2 登录、注册与权限
- React Hook Form + Zod 改善复杂表单体验。
- 认证继续以当前 NextAuth 和身份模型为准，不新增另一套认证框架。
- 每个受保护 API/Server Action 都要检查会话、账号状态、角色及资源所有权。
- 对登录、注册、邮件发送、密码恢复、OAuth 回调和高风险操作实施限流与审计。
- UI 库不能修复 OAuth 控制台回调 URL 配置错误。

### 4.3 创作工坊和 3D
- 保留 Three.js、skinview3d 与现有 Blockbench Web 入口。
- 撤销/重做先审计现有编辑器状态模型；只有复杂度确实难以维护时再单独评估 Zustand。
- 不在没有明确需求前同时引入 Redux、Zustand、Jotai 等多套状态库。
- 对 PNG 校验与导出建立测试，保护 64×64 纹理、透明度、Classic/Slim 与配件分类。
- 3D 回归覆盖连续旋转、动作切换、披风/鞘翅预览及窗口尺寸变化。

### 4.4 AI 创作
- 先定义供应商无关的生成服务接口，再选择 AI SDK。
- 统一任务状态、超时、重试、配额、成本记录和错误处理。
- 用 Zod 校验输入和结果；校验生成文件的 PNG 格式、尺寸和可编辑性。
- 所有模型密钥只在服务端，不能进入浏览器 bundle。

### 4.5 素材库、社区和个人中心
- TanStack Query 只用于需要客户端缓存、刷新或乐观更新的服务器状态。
- TanStack Table 只用于后台复杂表格。
- Sharp 与对象存储根据真实上传和容量需求再决定。
- 收藏、投稿、发布、评论和举报必须有实际 API、数据模型、权限检查及集成测试；组件库不代替业务逻辑。

### 4.6 管理后台
- 复用统一 UI、表单校验、复杂表格；图表和异常追踪按需启用。
- 统计与健康卡片必须来自真实数据和真实检查。
- 高风险操作需服务端授权、确认、审计及明确的失败反馈。
- 密钥只展示“已配置/未配置”或脱敏状态，不能回传原始值。

## 5. 推荐接入顺序

### 第 0 步：依赖审计，不安装新库
1. 检查 package.json、锁文件、UI 导入、重复组件和现有测试。
2. 明确 Vite 页面与 Next.js 页面各自职责及部署入口。
3. 记录每个库是否已安装、是否真实使用、是否与其他方案重复。
4. 检查第三方许可证清单及新增依赖许可证。
5. 运行现有构建、单元、集成、E2E 测试，保存基线结果。

### 第 1 步：公共 UI 和表单
1. 确定唯一主 UI 体系，先迁移导航或登录页试点。
2. 建立设计令牌、公共布局与状态组件。
3. 确认缺失后再为复杂表单引入 React Hook Form + Zod。
4. 只保留一套通知方案。

### 第 2 步：测试体系
1. 优先完善现有 Node 测试。
2. 有组件测试需求再引入 Vitest + Testing Library。
3. 现有 E2E 不具备浏览器自动化时再引入 Playwright。
4. 覆盖登录/权限、PNG 导入导出、编辑器关键路径和响应式布局。

### 第 3 步：数据密集页面
1. 明确 Vite 与 Next.js 数据获取边界。
2. 有明确缓存需求时引入 TanStack Query。
3. 复杂后台表格使用 TanStack Table。
4. 统计 API 可用后再加入唯一图表库。

### 第 4 步：AI、上传和可观测性
1. 定义 AI provider adapter 与任务模型，再选 SDK。
2. 根据存储需求评估 Sharp 和对象存储。
3. 根据部署实例数与现有限流性能决定是否引入 Redis。
4. 根据隐私与成本要求决定是否启用 Sentry/Pino。

## 6. 依赖治理与安全要求

- 新依赖必须提交锁文件，并由 CI 执行安装、构建、测试及许可证检查。
- 核对 Node、React、Next.js 兼容性、ESM/CJS 形式和 Docker 原生依赖。
- 使用现有依赖更新流程检查安全更新，不盲目升级生产依赖。
- 不将密钥写入前端 bundle、浏览器存储、日志或错误追踪事件。
- 上传文件须检查大小、MIME、真实格式和像素尺寸。
- 管理后台 API 必须服务端鉴权；隐藏前端菜单不是安全措施。
- 记录每个依赖的用途、许可证、维护责任、风险和移除方式。
- 检查新增依赖对 bundle 体积、首屏、移动端与 3D 性能的影响。
- 不在同一模块混用多套表单、通知、图标、缓存或全局状态方案。

## 7. 暂不引入

除非审计证明存在明确缺口，暂不加入第二套完整 UI、第二套图标库、多套状态管理库、第二套认证框架或 ORM、多个并行的表单校验/通知/图表库，以及没有实际规模需求的复杂工作流系统。

## 8. 验收清单

- [ ] 已盘点依赖和实际 import。
- [ ] UI 主体系唯一，导航/页脚/表单/状态组件可复用。
- [ ] 认证、权限与数据所有权在服务端验证。
- [ ] 皮肤 PNG、64×64、Classic/Slim、Blockbench 与 3D 预览回归通过。
- [ ] AI 密钥仅在服务端，任务失败、配额和成本有记录。
- [ ] 后台统计和健康状态来自真实数据。
- [ ] 手机端、键盘导航、焦点和错误反馈通过测试。
- [ ] 新依赖已锁版本、核许可证、CI 通过。
- [ ] Docker 构建和数据库迁移未被破坏。
- [ ] 文档、环境变量说明、回滚方法与测试结果已更新。

## 9. 结论

建议按“审计现状 → 确定唯一 UI 体系 → 统一表单与校验 → 补齐测试 → 按需引入数据表格/图表/缓存 → 最后扩展 AI、上传和监控”推进。

本文是选型规划，不表示相关依赖已经安装，也不表示功能已经实现。每个阶段只引入当前真正需要的依赖，并以可构建、可测试、可回滚为完成标准。


## 10. 细化功能库清单：尽量复用成熟实现

本节补充全站实际功能可能用到的工具。它们全部是候选项；安装前必须搜索仓库现有实现与依赖，确认缺口后再采用。**不要求把清单里的每个库全部安装。**

### 10.1 编辑器与画布交互

| 功能 | 候选库 | 价值 | 限制/注意 |
|---|---|---|---|
| 快捷键与组合键 | `tinykeys` 或 `hotkeys-js`（二选一） | 撤销/重做、保存、切换工具、预览快捷键 | 忽略输入框、文本编辑和浏览器保留快捷键；显示可发现的快捷键帮助 |
| 拖放上传 | `react-dropzone` | 拖入皮肤 PNG、图片和素材文件 | 前后端都检查真实格式、尺寸和文件大小；不能信任扩展名/MIME |
| 颜色选择 | Mantine ColorInput 或现有颜色选择组件 | 像素绘制、调色、颜色替换 | 若像素编辑器需要精确色值/透明度，必须验证 alpha 通道和 HEX/RGBA 往返无损 |
| 虚拟列表 | `@tanstack/react-virtual` | 大量素材、社区作品、管理日志列表 | 只有列表量或滚动性能确有问题时引入；虚拟列表须兼顾键盘和屏幕阅读器 |
| 复杂画布状态 | 先用现有 reducer/命令模型；必要时 Zustand | 工具状态、选择区、图层、历史记录 | 不让状态库承载每个像素的高频逐帧状态；画布渲染性能单独测量 |
| 动画/过渡 | CSS transitions；必要时 `motion` | 页面过渡、弹层、轻量反馈 | 3D 预览和编辑器不加无意义动画；遵守 prefers-reduced-motion |
| 图像差异回归 | Playwright 截图或项目现有视觉测试工具 | 防止布局/预览意外变化 | 截图测试要固定字体、视口和渲染环境；像素纹理导出仍需二进制/像素级断言 |

### 10.2 文件上传、图片与导出

| 功能 | 候选库 | 价值 | 限制/注意 |
|---|---|---|---|
| 文件上传体验 | `react-dropzone` | 拖放区、文件选择、拒绝原因提示 | 不把客户端验证当安全边界 |
| 浏览器端图片处理 | 原生 Canvas / `pngjs`（仅 Node 场景按需） | 读取像素、检测 PNG 尺寸、生成预览 | 不要用有损压缩；必须验证透明度、调色板、64×64、Classic/Slim |
| 服务端图片变体 | `sharp` | 社区缩略图和非原始素材预览 | 不处理/覆盖原始 Minecraft 皮肤纹理；注意容器平台二进制兼容 |
| 对象存储 | S3 兼容 SDK（选定供应商后确定） | 大文件与生成结果的持久化 | 私有对象使用短期签名 URL；检查访问控制、生命周期和删除 |
| 下载/压缩包 | 浏览器原生 Blob；多文件打包时评估 `JSZip` | 导出单文件或多个素材 | ZIP 导出验证文件名、内容、路径，避免路径穿越及内存峰值 |

### 10.3 社区、内容和富文本

| 功能 | 候选库 | 价值 | 限制/注意 |
|---|---|---|---|
| Markdown 预览 | `react-markdown` | 投稿说明、帮助文档、教程内容 | 默认禁用危险 HTML；需要 HTML 时配合严格清洗 |
| HTML 清洗 | `isomorphic-dompurify` 或服务端等效方案 | 防止富文本 XSS | 依据实际渲染链路选用；不能仅在客户端清洗后就信任数据库内容 |
| 日期/相对时间 | `date-fns` | “刚刚”、日期筛选、时间格式 | 全站统一时区和本地化策略，避免混用多套日期库 |
| 国际化 | `i18next` / `react-i18next`（先审计已有方案） | 中文/英文、错误信息、日期格式 | 文案使用稳定 key；不要把业务错误和翻译文案耦合在 API 中 |
| 无限滚动 | TanStack Query 的 infinite query 或现有分页 | 素材库、社区列表 | 优先服务端分页与可恢复的 URL 查询参数；避免无上限加载 |
| 搜索与筛选 | 现有数据库查询；复杂全文搜索以后再评估专用引擎 | 素材、用户和社区检索 | 先用数据库索引、分页和受控过滤；不要提前引入 Elasticsearch 类基础设施 |

### 10.4 后台管理、数据与任务

| 功能 | 候选库/方案 | 价值 | 限制/注意 |
|---|---|---|---|
| 表格 | `@tanstack/react-table` | 排序、过滤、列显示、批量操作 | 由服务端强制执行权限和分页；前端过滤不能当授权 |
| 图表 | `recharts`（或已用图表库） | 注册趋势、生成任务、审核队列等 | 图表不允许用随机/演示数据伪装生产统计 |
| 后台表单 | React Hook Form + Zod | 环境配置、内容审核、角色管理 | 敏感值只允许设置/轮换，不回显原始 secret |
| 任务队列 | 先用数据库任务表；规模明确后评估 BullMQ + Redis | AI 图片生成、耗时导出、重试与并发控制 | 需要持久任务状态、幂等键、超时、取消、重试上限和失败队列；不要在没有 Redis/worker 运维能力时直接加 BullMQ |
| 任务可观测性 | Pino + 关联 ID；可选 Sentry | 排查 AI 失败、OAuth 和后台操作 | 过滤 PII、令牌、提示词中的敏感内容与密钥；设置日志保留期限 |
| 数据校验 | Zod + 数据库约束 | API 输入和数据完整性 | 应用层 schema 与数据库约束互补，不以单层校验代替另一层 |
| 数据迁移 | 现有 Prisma Migrate | Schema 变更与部署升级 | 每个变更需考虑 SQLite 与 PostgreSQL/MySQL 差异、备份和回滚；生产启动迁移需可观测 |

### 10.5 认证、邮件和安全

| 功能 | 候选库/方案 | 价值 | 限制/注意 |
|---|---|---|---|
| 认证 | 继续用当前 NextAuth | OAuth、会话、登录回调 | 不再平行引入 Clerk/Auth.js 之外的第二套认证；先修复 provider ID、回调 URL、cookie 与生产域名 |
| 表单/API 校验 | Zod | 登录、注册、管理员操作、AI API | 身份认证、角色检查、资源所有权、CSRF 和限流仍要单独实现 |
| 限流 | 当前持久化方案；多实例时评估 Redis 方案 | 登录、注册、魔法链接、AI 生成防滥用 | 对邮箱/IP/账号维度设不同策略，防止攻击者利用请求耗尽邮件/AI 费用 |
| 安全响应头 | Next.js headers / 当前反向代理配置 | CSP、HSTS、frame、MIME 等安全头 | 先盘点 nginx/Cloudflare/Next.js 现有策略，避免重复或冲突；CSP 需实测 OAuth 和图片资源 |
| 安全审计 | npm audit / GitHub Dependabot / 现有 CI | 依赖漏洞与更新 | 审核升级变更和兼容性；不盲目使用 force 更新 |
| 邮件模板 | 先复用现有 Nodemailer；若需组件化再评估 React Email | 魔法链接、通知、密码/安全提示 | 邮件模板需移动端兼容、纯文本版本、链接域名验证和发送失败监控 |
| 权限库 | 暂不新增；必要时评估 CASL | 复杂资源权限矩阵 | 若仅 ADMIN/USER 与资源所有权，手写清晰的服务端 policy 通常更轻；权限复杂度增长时再引入 CASL |
| 机器人防护 | Turnstile（若部署环境采用 Cloudflare） | 注册、邮件发送和公开表单滥用控制 | 服务端验证 token；仅加前端挑战不具备保护作用 |

### 10.6 可观测性、错误边界和性能

| 功能 | 候选库/方案 | 价值 | 限制/注意 |
|---|---|---|---|
| 前端错误边界 | React Error Boundary 或项目现有方案 | 页面局部故障时显示恢复 UI | 编辑器崩溃不能吞掉导出失败或丢失未保存状态；提供重试/恢复入口 |
| 服务端日志 | Pino（可选） | JSON 日志、请求关联、错误上下文 | 不记录密码、Cookie、OAuth code、Authorization header 或 API key |
| 错误追踪 | Sentry（可选） | 版本关联、错误聚合 | 上传源码映射前审查构建和访问权限；配置数据脱敏 |
| 性能分析 | Web Vitals / Next.js 内建指标 | 首屏、交互延迟和移动端体验 | 只采集必要指标，建立性能预算；不默认追踪用户输入 |
| Bundle 分析 | Vite/Next.js 现有分析工具或对应插件 | 检查新增依赖是否增大首屏 | 对编辑器、3D、后台分别分析；重型模块按需加载 |
| 无障碍测试 | axe-core、Playwright 辅助 | 语义、标签、对比度和焦点检查 | 自动化结果需人工复核；所有核心功能应支持键盘操作 |

## 11. 库选择决策表

- **马上优先评估：** React Hook Form、Zod、测试覆盖工具，以及单一 UI 体系。
- **页面实现时再引入：** TanStack Table、TanStack Query、react-dropzone、react-markdown、date-fns。
- **生产需求出现后再引入：** Redis/BullMQ、对象存储、Sharp、Sentry、Pino、Turnstile。
- **先不引入：** 第二套认证、ORM、UI 体系、状态管理体系；没有业务需求的搜索集群或微服务编排。

每项依赖的 PR 应包含：
1. 为什么当前代码无法低成本完成该功能；
2. 依赖与替代方案的比较；
3. 许可证、维护状态、Node/React 兼容性和包体积；
4. 最小接入范围；
5. 测试与验收方式；
6. 回滚/移除方法。

## 12. 参考文档

实施时应优先核对官方文档及当前版本的安装要求：
- Mantine: https://mantine.dev/
- Radix UI: https://www.radix-ui.com/
- React Hook Form: https://react-hook-form.com/
- Zod: https://zod.dev/
- Vitest: https://vitest.dev/
- Testing Library: https://testing-library.com/docs/react-testing-library/intro/
- Playwright: https://playwright.dev/
- TanStack Query: https://tanstack.com/query/latest
- TanStack Table: https://tanstack.com/table/latest
- TanStack Virtual: https://tanstack.com/virtual/latest
- React Dropzone: https://react-dropzone.js.org/
- React Markdown: https://github.com/remarkjs/react-markdown
- Sharp: https://sharp.pixelplumbing.com/
- Recharts: https://recharts.org/
- Sentry: https://docs.sentry.io/
- Pino: https://getpino.io/
- React Email: https://react.email/
- Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/


## 13. 基于当前主分支 package.json 的初步依赖盘点

本盘点仅依据当前可读取的 `package.json`，不能证明某个库完全没有被源码间接使用；真正安装前仍需搜索 import、锁文件、CI 和 Dockerfile。

### 13.1 当前已声明的关键依赖

| 已声明依赖 | 当前用途/意义 | 行动 |
|---|---|---|
| React 19、React DOM、TypeScript | UI 与类型系统 | 保留 |
| Vite、@vitejs/plugin-react | 现有 SPA/编辑器构建 | 保留 |
| Next.js 16、NextAuth 4 | Next.js 页面、认证与会话 | 保留并优先检查版本兼容和认证配置 |
| Prisma 7、PostgreSQL/MariaDB/SQLite adapters | 多数据库持久化 | 保留；测试不同 provider 的迁移与启动路径 |
| Radix Tabs/Tooltip/Select | 基础交互组件 | 已有使用价值；先盘点，不立即整体替换 |
| lucide-react | 图标 | 全站统一使用 |
| Three.js、skinview3d | 3D 角色预览 | 保留并针对披风、鞘翅、旋转和动作做回归 |
| Nodemailer | 邮件发送 | 保留并检查邮件发送错误、配置和限流 |
| vite-plugin-pwa | PWA 能力 | 保留并审计缓存更新、登录态页面缓存和离线行为 |
| Node 内建测试 | 当前 unit/integration/E2E 命令基础 | 先扩展现有测试，避免无必要地替换测试入口 |

### 13.2 package.json 中尚未直接声明、可优先评估的依赖

| 依赖候选 | 当前建议 | 理由 |
|---|---|---|
| React Hook Form | 优先评估 | package.json 未见声明，适合复杂登录、注册、管理员配置和投稿表单 |
| Zod | 优先评估 | package.json 未见声明，可统一 API 输入、表单、AI 参数和环境配置 schema |
| Mantine | 先做试点，不立即全面安装 | 当前已有 Radix；先比较组件覆盖、样式冲突、包体积和迁移成本，决定主体系后再推广 |
| Vitest + Testing Library | 按测试缺口评估 | 当前 scripts 使用 Node 内建测试；先确认现有测试是否难以覆盖组件交互 |
| Playwright | 按现有 E2E 缺口评估 | scripts 存在 test:e2e，但命令使用 Node test runner；先确认是否已有浏览器级测试，不要把它误认为真实浏览器 E2E |
| TanStack Query / Table / Virtual | 随素材库和后台页面落地时评估 | 当前 package.json 未见声明；先有真实列表、缓存或复杂表格需求再加入 |
| react-dropzone | 编辑器上传体验需要时评估 | 可复用拖放上传体验，但必须保留服务端文件校验 |
| react-markdown + isomorphic-dompurify | 社区支持 Markdown/富文本时评估 | 在确定内容模型与渲染策略后使用；避免危险 HTML/XSS |
| date-fns | 时间格式需求统一时评估 | 先确认当前代码是否已使用原生 Intl 或其他日期工具 |
| Recharts | 后台真实统计 API 准备后评估 | 不在真实数据接口前先做演示图表 |
| Sentry / Pino | 有隐私策略和运维方案后评估 | 先统一日志字段、脱敏和保留期限 |
| Redis / BullMQ | 暂缓 | 需先明确是否多实例、是否有独立 worker、队列失败恢复和 Redis 运维能力 |
| Sharp / 对象存储 SDK | 按实际上传和存储规模评估 | 不应为了缩略图直接覆盖原始 64×64 皮肤纹理 |

### 13.3 特别需要先澄清的架构事项

1. **Vite 与 Next.js 双入口：** 当前 package.json 同时存在 Vite build 与 Next.js build/start。新增 UI、表单和数据请求库前，必须明确哪些路由属于哪一个应用，以及 Docker/Zeabur 实际启动哪个入口。
2. **NextAuth 版本：** 当前声明的是 NextAuth 4 系列；新代码必须使用与实际安装版本兼容的 API，不可照抄其他主版本文档。
3. **E2E 名称：** 当前 `test:e2e` 使用 Node test runner 执行 `tests/e2e/*.test.mjs`，这不自动代表已配置浏览器驱动。应先检查测试内容，再决定是否引入 Playwright。
4. **数据库兼容：** 新 schema、限流、队列和后台查询必须考虑 PostgreSQL、MariaDB/MySQL 与 SQLite 的差异，不能只验证一种数据库。
5. **皮肤像素精度：** 图片缩略图/格式处理库不得介入原始纹理导出链路，除非有像素级测试证明不会改变尺寸、颜色和透明度。

### 13.4 建议的第一批实际接入范围

先不同时安装十几个库。建议第一批最多做三类工作：

- **表单和输入校验：** React Hook Form + Zod，前提是审计确认当前表单没有统一方案。
- **组件测试：** 先补现有 Node 测试；仅在 UI 行为难以覆盖时加入 Vitest + Testing Library。
- **浏览器回归：** 检查现有 E2E 内容；只有缺少真实浏览器交互验证时才加入 Playwright。

Mantine 主体系决策应单独完成试点和视觉验收，避免与认证修复、业务页面迁移同时大范围改动，增加故障定位难度。
