# 登录方式、OAuth 与管理员初始化配置指南

本文对应当前仓库的 NextAuth v4 实现。配置项以根目录 `.env.example` 和 `auth.ts` 为准。

> **重要：** 当前版本的登录方式通过部署环境变量启用。管理后台里的 OAuth / SMTP / AI 配置区域如果仍显示占位内容，就不代表它已经能保存或更新这些密钥。请在 Zeabur、Docker 部署平台的环境变量 / Secrets 页面配置，并在修改后重启或重新部署服务。

## 1. 配置前准备

1. **CDPC 生产主域名固定使用 `https://cdpc.cc`。** 本部署目标是 Zeabur 上的 Pixcape 单镜像服务，不再使用 Vercel `home` 项目作为应用入口。
2. 在部署平台配置数据库，先阅读[单镜像生产部署](./SINGLE-IMAGE-PRODUCTION.md)。数据库必须使用持久化存储；不要在生产环境使用临时 SQLite 文件。
3. 配置稳定的 `NEXTAUTH_SECRET`。可使用密码管理器生成至少 32 字节随机值；也可在可信终端运行：
   ```bash
   openssl rand -base64 48
   ```
   把输出保存到部署平台 Secret 中。**不要每次启动时重新生成**，否则会影响会话和加密相关配置。
4. 在 Zeabur 的 Pixcape 服务环境变量中设置 `NEXTAUTH_URL=https://cdpc.cc`（不要带末尾路径），并设置持久的 `NEXTAUTH_SECRET`。修改环境变量后重新部署服务。
5. 只启用你已完成配置的登录方式。对应 ID 和 Secret 必须成对填写；未配置完整的提供商不会显示在登录页。

本地开发时可以把 `.env.example` 复制为未提交的 `.env.local`。不要把真实密钥提交到 Git。

## 2. OAuth 提供商设置

CDPC 生产环境使用以下**精确回调地址**。在启用的每个 OAuth 提供商控制台登记对应地址，协议、域名和路径必须完全一致：

| 提供商 | OAuth 回调 URL |
| --- | --- |
| GitHub | `https://cdpc.cc/api/auth/callback/github` |
| Google | `https://cdpc.cc/api/auth/callback/google` |
| Microsoft Entra ID | `https://cdpc.cc/api/auth/callback/azure-ad` |
| Apple | `https://cdpc.cc/api/auth/callback/apple` |

不要把登录发起地址、主页 URL 或 Zeabur 的临时域名误填成回调地址。若还要用临时域名测试，可额外登记对应的临时回调 URL，但生产登录必须回到 `cdpc.cc`。

### GitHub

**配置入口：** [GitHub Developer Settings → OAuth Apps](https://github.com/settings/developers)

1. 打开上方链接，进入 OAuth Apps，创建或选择应用。
2. Homepage URL 填主站网址。
3. Authorization callback URL 填 `https://你的域名/api/auth/callback/github`。
4. 将 Client ID、Client Secret 配到部署环境：

```dotenv
AUTH_GITHUB_ID="你的 GitHub OAuth Client ID"
AUTH_GITHUB_SECRET="你的 GitHub OAuth Client Secret"
```

### Google

**配置入口：** [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) · [OAuth consent screen / Google Auth Platform](https://console.cloud.google.com/auth/overview)

1. 打开上方链接，在 Google Cloud Console 中配置 OAuth consent screen，并创建 OAuth Client ID（Web application）。
2. Authorized JavaScript origins 填主站网址。
3. Authorized redirect URIs 填 `https://你的域名/api/auth/callback/google`。
4. 设置：

```dotenv
AUTH_GOOGLE_ID="你的 Google Client ID"
AUTH_GOOGLE_SECRET="你的 Google Client Secret"
```

若应用处于测试发布状态，只允许 OAuth 同意屏幕中添加的测试用户登录；上线前检查应用受众、验证状态和 Google 的最新要求。

### Microsoft

**配置入口：** [Microsoft Entra admin center → App registrations](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)

1. 打开上方链接注册应用。
2. 添加 Web 平台的 Redirect URI：`https://你的域名/api/auth/callback/azure-ad`。
3. 创建客户端密码，并按租户策略配置支持的账户类型。
4. 设置：

```dotenv
AUTH_MICROSOFT_ENTRA_ID_ID="你的 Application (client) ID"
AUTH_MICROSOFT_ENTRA_ID_SECRET="你的客户端密码值"
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID="common"
```

`AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` 可用 `common`、`organizations`、`consumers` 或特定租户 UUID。若只允许组织内部账户，选择对应组织租户配置。客户端密码应填写创建时显示的 **Value**，不是 Secret ID。

### Apple

**配置入口：** [Apple Developer → Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) · [Sign in with Apple 官方说明](https://developer.apple.com/sign-in-with-apple/)

1. 打开上方链接配置 Sign in with Apple，按 Apple 要求准备已启用的 App ID / Services ID、域名与回调地址。
2. Return URL 填 `https://你的域名/api/auth/callback/apple`。
3. Apple 的客户端密钥涉及 Team ID、Key ID 和私钥生成的 client-secret JWT。按 Apple 当前开发者文档生成有效密钥，再将其配置为：

```dotenv
AUTH_APPLE_ID="你的 Apple Services ID"
AUTH_APPLE_SECRET="按 Apple 要求生成的 client-secret JWT"
```

Apple 密钥可能会过期，需要设置到期提醒并在失效前更新。Apple 控制台中的域名验证、HTTPS 和回调地址要求必须按其当前文档完成。

## 3. 邮箱魔法链接（SMTP）

邮箱登录不是密码登录。用户提交邮箱后，系统发送一次性登录链接；当前代码把链接有效期设为 **15 分钟**。只有能够接收该邮箱邮件的人才能使用链接。

需要一个允许应用发送邮件的 SMTP 服务商，并获取服务器地址、端口、用户名和密码。可参考：[Resend SMTP 文档](https://resend.com/docs/send-with-smtp)、[Brevo SMTP 文档](https://help.brevo.com/hc/en-us/articles/7924908992402)。请先选择并注册你实际使用的服务商。将 SMTP 连接 URL 放进 `EMAIL_SERVER`，发件人放进 `EMAIL_FROM`：

```dotenv
EMAIL_SERVER="smtp://SMTP用户名:URL编码后的密码@smtp.example.com:587"
EMAIL_FROM="Pixcape <no-reply@example.com>"
```

以上为格式示例，不能直接照抄。请使用邮件服务商提供的主机、端口和 TLS 要求。若密码含有 `@`、`:`、`/`、`#` 等保留字符，应进行 URL 编码。不同 SMTP 服务商的连接 URL / TLS 要求可能不同；严格按服务商文档填写，不要把 SMTP 密码贴到聊天或提交到仓库。

如果服务商要求隐式 TLS（常见端口 465），通常使用 `smtps://`；若使用 STARTTLS（常见端口 587），按服务商支持的配置填写。配置完成后，重启应用，在登录页选择邮箱登录，并检查收件箱、垃圾邮件和应用日志。日志中不应出现 SMTP 密码或完整魔法链接。

`EMAIL_SERVER` 与 `EMAIL_FROM` 都填写后，邮箱登录选项才会显示。

## 4. 首次管理员初始化

新用户首次登录默认是普通用户，不会自动成为管理员。项目提供一次性脚本 `npm run db:bootstrap-admin`：

1. 先完成数据库连接和至少一种登录方式配置。
2. 使用该登录方式登录一次，确保数据库中已创建对应用户记录。
3. 在运行应用脚本的同一部署版本/容器中，临时设置 `BOOTSTRAP_ADMIN_EMAIL` 为该账户的**实际登录邮箱**。
4. 在部署容器的终端或受控运维环境执行：
   ```bash
   npm run db:bootstrap-admin
   ```
5. 确认脚本成功并核对管理员账户后，立即从环境变量中删除 `BOOTSTRAP_ADMIN_EMAIL`，再重新部署/重启服务。

注意事项：

- 这是受控的一次性初始化步骤，不是普通登录密码，也不应长期保留该变量。
- 必须确保邮箱与已登录用户记录完全匹配。OAuth 提供商返回的邮箱若为空或不一致，先检查账户记录，不要猜测。
- 不要把自己的管理员权限撤销，也不要在未确认还有其他有效管理员之前操作。
- 生产环境执行前先备份数据库，并确认执行目标是正确的实例。
- 如果部署平台没有交互式终端，使用其受控一次性任务/运维入口执行；不要为了运行脚本把数据库公开到互联网。

## 5. 登录限流与代理 IP

当前示例默认：

```dotenv
LOGIN_RATE_LIMIT_MAX="10"
LOGIN_RATE_LIMIT_WINDOW_SECONDS="900"
LOGIN_RATE_LIMIT_IP_HEADER="x-real-ip"
```

即默认每个识别到的 IP 在 15 分钟窗口内最多 10 次尝试。应用应只信任由自己控制的反向代理覆盖写入的 IP 头。如果服务直接暴露公网，不能信任用户可自行伪造的 `X-Real-IP` 或 `X-Forwarded-For`。先确认 Zeabur / Nginx / 负载均衡器的实际代理行为，再选择可信头；不要盲目更改默认值。

## 6. 部署验证清单

- [ ] Zeabur 服务环境变量 `NEXTAUTH_URL` 精确为 `https://cdpc.cc`，生产环境使用 HTTPS。
- [ ] `NEXTAUTH_SECRET` 是随机、持久的 Secret，且没有提交到 Git。
- [ ] OAuth 控制台已登记上表中对应的 `https://cdpc.cc/api/auth/callback/<provider>` 回调 URL。
- [ ] 登录页只显示已配置的提供商；未配置的方式不会显示。
- [ ] OAuth 登录能完成授权、回调、数据库用户创建与会话建立。
- [ ] 邮箱魔法链接可投递、15 分钟内可使用，过期后不可再用于登录。
- [ ] 新用户默认是 USER；只有通过受保护的管理员流程才能授予 ADMIN。
- [ ] 首次管理员初始化完成后已移除 `BOOTSTRAP_ADMIN_EMAIL`。
- [ ] 生产数据库有持久化与备份；代理 IP 头配置经过验证。
- [ ] 检查部署日志、Git 历史和错误追踪中没有泄露密钥、SMTP 凭据或魔法链接。

## 7. 常见问题

**登录页没有显示某个提供商？** 检查其 ID 与 Secret 是否都已设置，变量名是否完全匹配，修改后是否重启/重新部署。

**出现 `redirect_uri is not associated with this application`？** 检查触发登录的具体提供商，并将其控制台回调地址精确设为上表中对应的 `https://cdpc.cc/api/auth/callback/<provider>`。同时核对 Zeabur 的 `NEXTAUTH_URL=https://cdpc.cc`，保存 OAuth 控制台配置后重新部署/重试。

**邮箱收不到链接？** 检查 SMTP 主机、端口、TLS、凭据、发件人域名验证、服务商发送限制和垃圾邮件文件夹；不要公开粘贴包含凭据的 SMTP URL。

**能否直接在管理员后台填写 OAuth/SMTP 密钥？** 当前以部署环境变量为准。除非后续版本实现并通过安全验收的加密配置存储功能，否则不要假设后台占位配置卡片能保存密钥。

**登录成功但没有管理员入口？** 确认数据库中用户状态为 ACTIVE、角色确为 ADMIN，并重新登录刷新数据库会话。不要通过修改客户端页面或请求参数赋予自己管理员权限。

## 相关文档

- [环境变量模板](../.env.example)
- [单镜像生产部署](./SINGLE-IMAGE-PRODUCTION.md)
- [用户、创作者与管理员迁移方案](./NEXTJS-USER-ROLES-MIGRATION.md)
- [生产安全上线清单](./PRODUCTION-SECURITY-ROLLOUT.md)


## 8. 管理员用户名 / 密码登录

部署环境可设置以下三个变量，全部非空时登录页会显示单独的“管理员登录”入口：

```dotenv
ADMIN_USERNAME="你的管理员用户名"
ADMIN_PASSWORD="请使用唯一且足够长的随机密码"
ADMIN_EMAIL="用于管理员账户的邮箱"
```

这组凭据与普通用户注册分离。首次使用正确凭据登录时，如果数据库中还没有该邮箱，会创建管理员账户；若已有该邮箱则授予 ADMIN 角色。账户必须处于 ACTIVE 状态。请只在受控部署 Secrets 中保存密码，不要把真实值提交到仓库或聊天记录。部署后请验证登录成功后能进入 `/admin`，并确认退出后无法访问管理员页面。

## 9. 邮箱与密码注册

当前注册页为 `/register`。默认不要求邮箱验证码：用户填写邮箱、至少 10 位密码即可创建普通用户，密码使用 Node.js scrypt 加盐哈希保存，不会以明文写入数据库。注册接口使用持久化 IP 限流。邮箱魔法链接仍是可选登录方式，需要配置 SMTP 后才显示。

首次部署此版本前，先在维护窗口备份数据库并同步 Prisma schema：

```bash
npm run db:push
npm run db:generate:all
```

`db:push` 会依据 `DATABASE_PROVIDER` 选择 PostgreSQL、MySQL 或 SQLite schema。请先在测试数据库验证；生产环境不要在未备份时执行 schema 变更。PostgreSQL 部署也可按项目现有 migration 流程运行 `npm run db:migrate`，并确认新 migration 已包含在部署版本中。

普通邮箱注册不会自动授予管理员权限。管理员登录凭据应与普通账户登录流程分开保管。管理员可在“系统配置中心”开启邮箱验证。开启后，新注册账户必须点击有效期 30 分钟的一次性邮件链接才能使用邮箱密码登录；关闭时（默认）无需邮箱验证码。开启前必须配置并测试 EMAIL_SERVER、EMAIL_FROM 与 NEXTAUTH_URL。


## 10. CDPC 主域名切换到 Zeabur

生产应用目标域名为 `https://cdpc.cc`。切换时请按以下顺序，避免先改 DNS 导致网站暂时不可用：

1. 在 Zeabur 中打开正在运行 Pixcape 单镜像的 HTTP 服务，先确认服务端口、健康状态和 `ghcr.io/maoyiren/pixcape:latest` 镜像版本。
2. 在该服务的 **Domains / Custom Domain** 中添加 `cdpc.cc`，让 Zeabur 显示本次绑定所要求的 DNS 记录目标。
3. 在 Cloudflare DNS 中，将根域名现有的旧站记录切换为 Zeabur 控制台给出的记录。**不要猜测 CNAME 目标或使用固定 IP**；Zeabur 为服务显示的目标才是依据。Cloudflare 的根域名支持 CNAME flattening。
4. 原来的 `www.cdpc.cc` 记录当前指向 Vercel；如果希望 `www.cdpc.cc` 也进入 Pixcape，可在 Zeabur 另外绑定该域名，并按 Zeabur 给出的 DNS 目标更新记录；否则先保留原有 www 行为。
5. 在 Zeabur 设置 `NEXTAUTH_URL=https://cdpc.cc`，并检查 `NEXTAUTH_SECRET`、`DATABASE_PROVIDER`、`DATABASE_URL` 等生产环境变量。重新部署后验证 `https://cdpc.cc/login`、`/register` 和 `/api/auth/providers`。
6. 在所启用的 OAuth 提供商后台逐一登记本指南列出的回调 URL，并执行完整登录/登出测试。

注意：代码仓库可以提供镜像和正确的回调地址，但不能代替 Zeabur 服务绑定，也不能自动修改 Google、Microsoft 或 Apple 开发者控制台中的 OAuth 应用设置。DNS 记录只有在 Zeabur 控制台显示确切目标后才能安全切换。
