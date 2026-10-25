# CDPC × Blessing Skin Server 融合实施方案

> 状态：架构与实施计划；本文件不代表已完成部署或账号打通。
> 日期：2026-10-24
> 目标仓库：`maoyiren/Pixcape`
> 上游项目：`bs-community/blessing-skin-server`

## 1. 决策摘要

采用“CDPC 主平台 + 独立 Blessing Skin 服务 + 受控适配层”的松耦合架构。不把 Blessing Skin Server 的 PHP/Laravel 代码合并进 Next.js，也不让它替换 CDPC 现有认证、Prisma 数据层或创作工坊。

第一阶段先交付兼容性验证、皮肤 PNG 导入/导出约定、作品与皮肤资产的关联模型，以及可关闭的外部皮肤服务配置。只有在独立环境通过安全、备份、兼容性和运维验证后，才开放真实服务接入。

## 2. 已核验的仓库基线

### CDPC

- 主仓库：`maoyiren/Pixcape`，默认分支 `main`。
- 当前主应用包含 Next.js、NextAuth、Prisma，并保留 Vite 创作工坊构建流程。
- 数据库目标覆盖 PostgreSQL、MySQL 和 SQLite。
- 当前依赖中已有 `skinview3d`，可继续承担 CDPC 内部的 3D 皮肤预览。
- PR #20 正在推进创作者生态基础，但仍是 draft；不可将其描述为已发布。
- 创作者作品、衣柜、皮肤站玩家档案是不同领域对象，不应仅凭相似名称复用同一张表。

### Blessing Skin Server

- 上游仓库：`bs-community/blessing-skin-server`，当前仓库默认分支为 `dev`；实施时必须另行选择并固定经验证的 release/tag，不能直接追随开发分支部署。
- `composer.json` 声明 PHP `^8.1`、Laravel `^10`，并依赖多个 PHP 扩展及 PDO。
- 上游 `composer.json` 声明 MIT 许可；分发或修改时仍须保留许可与版权声明，并单独核对插件及依赖的许可。
- 上游 README 描述的核心用途是皮肤/披风托管、分享与离线模式服务器的皮肤显示，并支持插件及可选的 Yggdrasil 相关接入。
- 该项目与 CDPC 的 Node/Next.js 技术栈不同，独立部署和升级风险更低。

## 3. 产品边界与术语

必须区分以下资产类型：

1. **标准 Minecraft 玩家皮肤**：符合约定尺寸、格式和模型规则的皮肤 PNG。
2. **Blessing 皮肤站纹理资产**：由皮肤服务托管和分发的皮肤、披风等资源。
3. **CDPC 创作作品**：有作者、描述、分类、版本、授权和发布状态的社区内容。
4. **CDPC 装扮/部件资产**：披肩、外套、帽子、上衣、裤子、鞋子、披风等编辑素材；它们不自动等于标准玩家皮肤。
5. **官方账号披风**：不属于 CDPC 导出 PNG 可以创建或替代的内容；页面必须避免暗示与 Mojang/Microsoft 官方账号或服务存在背书关系。

初期仅提供明确的导入、导出、预览和关联，不承诺把任意 CDPC 装扮自动转换成可在游戏中穿戴的资产。转换功能必须经过 UV 映射、尺寸、透明通道、Steve/Alex 模型及实际客户端验证。

## 4. 目标架构

```text
Browser
  └─ cdpc.cc (Next.js / existing auth / Prisma)
       ├─ Creator & Creation APIs
       ├─ Asset metadata and permission checks
       ├─ Blessing adapter (server-side, feature-flagged)
       └─ Skin preview / import-export
                │ HTTPS + scoped server-side credentials
                ▼
       Separate Blessing Skin deployment
       (PHP/Laravel + its own database + own storage)
```

约束：

- 不共享数据库、不直连对方的业务表、不复制密码哈希、不把服务端凭据下发浏览器。
- 不因皮肤服务故障而阻断 CDPC 登录、编辑器、作品浏览或导出。
- 默认关闭远程写入；初版可先使用用户主动上传/下载和管理员验证过的只读信息。
- 外部服务 URL 必须由服务器配置，校验 HTTPS、允许的主机和请求目标，阻止 SSRF、重定向绕过及任意 URL 代理。
- 设置连接超时、响应大小上限、速率限制、审计日志和健康状态；日志不得包含令牌、密码、完整私密 URL 或用户敏感数据。
- 文件上传需要校验真实文件类型、PNG 解码、像素尺寸、大小和透明通道；不能只信任扩展名或客户端 MIME。

## 5. 身份与单点登录策略

阶段一不做自动单点登录，不改变现有 NextAuth 提供商或回调配置。

后续如需要单点登录，先确认固定版本的 Blessing 是否有可维护且受支持的认证扩展点；优先使用标准协议或受审查的插件，不应直接改写上游密码验证流程。建立独立映射记录，例如：

- `cdpcUserId`：CDPC 稳定用户 ID。
- `provider`：皮肤服务标识。
- `externalUserId`：皮肤服务用户 ID。
- `linkedAt`、`status`、`lastVerifiedAt`：绑定状态和审计时间。

绑定必须由已登录用户明确发起并验证控制权；禁止仅按相同邮箱自动合并账号。解绑、封禁、删除及账号恢复流程需要定义一致的行为。管理员权限绝不能从皮肤站普通用户角色自动映射到 CDPC ADMIN。

## 6. 资产与数据映射

初期不新建与现有 `User`、`CreatorProfile`、`Project` 重复的模型。先建立轻量外部资产引用（具体字段须在检查当前 schema 后决定），建议语义包括：

- 内部作品 ID 与版本 ID；
- 资产类型：`PLAYER_SKIN`、`CAPE_TEXTURE`、`CDPC_PART`；
- 外部服务标识及外部资产 ID（可空）；
- 资产来源、作者、授权快照、校验结果；
- MIME、尺寸、内容哈希、存储位置引用；
- 可见性、审核状态、创建与更新时间。

数据库迁移必须分别验证 PostgreSQL、MySQL、SQLite。避免将图片 base64 长期保存到业务表；优先使用受控对象存储或现有文件存储机制。删除外部资产前应先解除引用或留下 tombstone，避免作品详情出现不可解释的断链。

## 7. 分阶段交付

### Phase 0 — 只读审计与隔离部署

- 固定上游 release/tag 和镜像 digest，审查安全公告、依赖、插件、安装文档与许可证。
- 建立独立测试部署、独立数据库、独立存储、独立备份和恢复演练。
- 不接生产用户、不导入真实凭据、不改变 cdpc.cc DNS 或生产容器。
- 产出兼容性矩阵、威胁模型、成本估算和回滚步骤。

### Phase 1 — CDPC 本地皮肤资产体验

- 提供标准皮肤 PNG 导入、校验、预览、下载和编辑器导入。
- 记录来源与授权；保留原文件，生成预览图时不覆盖原件。
- 先支持用户主动导入/导出，不依赖 Blessing API。
- 在界面中清晰区分“玩家皮肤”“CDPC 装扮部件”和“披风纹理”。

### Phase 2 — 可选 Blessing 连接器

- 增加服务器端配置与 feature flag，默认关闭。
- 只实现已核验并有稳定契约的 API；没有官方稳定 API 时，不猜测私有端点，改用明确的人工导入/导出。
- 增加超时、重试上限、权限校验、速率限制、审计和降级状态。
- 在测试站完成读取、上传、删除/解绑和异常处理测试后再开放。

### Phase 3 — 账号链接与游戏端能力（单独审批）

- 评估标准 SSO、Yggdrasil 兼容范围、目标客户端和服务端类型。
- 明确离线模式安全边界、账号冒用风险、封禁同步、数据删除和支持责任。
- 任何认证插件或上游补丁都需要单独维护计划、兼容测试和安全复核。
- 不声称能替代 Mojang/Microsoft 官方认证，也不将外置登录等同官方账号登录。

### Phase 4 — 创作者生态深化

- 将作品版本、授权、审核、下载事件与外部皮肤资产关联。
- 仅在真实需求、版权流程和运维能力验证后再考虑皮肤托管服务商业化。
- 付费授权、退款、作者收益、侵权投诉和地区合规需另立方案，不在初期连接器中引入支付。

## 8. 安全、隐私与版权验收

上线前必须通过：

- SSRF、越权访问、IDOR、CSRF、XSS、文件上传与路径处理检查。
- 外部服务凭据不进入客户端 bundle、公开 API 响应、构建日志或普通应用日志。
- 用户只能访问其有权查看或管理的作品与资产；不能信任客户端传入的 owner ID。
- 文件大小、解码像素数、格式、尺寸、速率及请求超时均有上限。
- 备份恢复演练、外部服务不可用演练、超时/畸形响应/上游升级演练。
- 用户删除、作品下架、账号封禁和解除绑定的行为有文档和审计记录。
- 上游 MIT 版权声明完整保留；逐项检查插件和依赖许可。
- 提供清楚的非官方关联声明、素材授权说明、侵权举报与下架流程。

## 9. 发布门槛与回滚

生产启用前要求：

1. 独立环境构建与部署成功，并固定版本和镜像摘要。
2. 数据库、存储、备份与恢复均验证成功。
3. CDPC CI、Next.js 构建、安全测试、浏览器回归和 Docker 冒烟检查通过。
4. 连接器关闭时，CDPC 主要流程无回归；连接器开启时，授权和失败降级测试通过。
5. 所有环境变量有文档、默认安全值和启动校验；密钥只通过部署密钥管理注入。
6. 明确监控指标、告警责任人、维护窗口与回滚演练。

回滚时先关闭 feature flag，再停止连接器流量；保留必要审计记录，不自动删除用户资产。不要在回滚时直接覆盖或清空任一服务的数据库。

## 10. 当前不做的事情

- 不把 Blessing 的 PHP/Laravel 代码并入 Next.js 进程。
- 不共享 Prisma 与 Blessing 数据库或密码表。
- 不在未经审查的情况下安装第三方认证插件。
- 不直接在生产环境试验上游 `dev` 分支。
- 不宣称账号互通、游戏端兼容或自动装扮转换已实现。
- 不在本计划 PR 中修改生产配置、密钥、DNS、数据库或部署镜像。

## 11. 官方核验入口

- Blessing Skin Server：<https://github.com/bs-community/blessing-skin-server>
- 上游 Composer 依赖与许可证声明：<https://github.com/bs-community/blessing-skin-server/blob/dev/composer.json>
- 上游许可证：<https://github.com/bs-community/blessing-skin-server/blob/dev/LICENSE>
- 上游安装文档：<https://blessing.netlify.app/en/setup.html>

在真正部署时，应以选定 release/tag 的文件和安全公告为准，而不是将上述 `dev` 分支文件视为稳定发布承诺。
