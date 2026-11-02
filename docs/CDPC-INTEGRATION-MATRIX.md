# CDPC 全项目交互、业务关系与 API 同步验收矩阵

- 日期：2026-11-02
- 对应实施分支：`architecture/cdpc-unified-platform`
- 当前整合主线：PR #39
- 状态：**审计基线 / 待逐项实现与验证**。本文件记录已核实的现状和目标，不将路由存在等同于业务闭环完成。

## 1. 统一业务对象与数据关系

平台以同一份用户资产为中心，不允许 AI、编辑器、衣橱和社区各自保存互不相认的副本。

```text
User
 ├─ CreatorProfile
 ├─ Project ── Asset (source/version lineage to be completed)
 ├─ Asset ── AssetFavorite ── User
 ├─ Outfit ── OutfitItem ── Asset
 ├─ Publication ── Asset / Outfit
 └─ WorkspaceState ── Project / active Asset / active Outfit

Target extension:
User ── Character ── SkinVersion / Outfit
Project ── InputAsset / OutputAsset / GenerationTask / EditorDocument
Publication ── immutable content snapshot + moderation / comments / reactions
```

### 1.1 当前已存在的 Prisma 关系

| Model | 当前职责 | 已核实的限制 |
|---|---|---|
| User | 账户、角色、状态、认证关系 | 已有 |
| CreatorProfile | 创作者资料与审核状态 | 不是角色/玩家模型 |
| Project | 用户项目容器 | 只有可选 `assetKey` 字符串；尚无完整输入/输出资产版本关系 |
| Asset | 文件元数据、owner、category、source、visibility、storageKey | 有 owner/project；没有版本链、父资产或角色归属 |
| Outfit | 用户保存的一套搭配、基础皮肤、模型、背景、动作 | 没有 Character 外键 |
| OutfitItem | Outfit 到 Asset 的有序穿戴关系 | 有 category、sortOrder、equipped |
| AssetFavorite | 用户收藏 Asset | 有唯一约束 |
| Publication | 发布 Asset 或 Outfit 的基础记录 | 尚无完整社区互动和审核状态机 |
| WorkspaceState | 当前 project/tool/asset/outfit 指针 | 不是完整编辑文档；没有图层 JSON、未保存状态或多个角色上下文 |

披肩 `SHAWL`、外套 `COAT`、披风 `CAPE` 必须始终是三个独立分类。

### 1.2 必须补齐的业务实体/关系

1. **Character**：用户可拥有多个角色；记录名称、模型、默认皮肤、头像/预览和当前角色。
2. **SkinVersion**：一个角色拥有多个皮肤版本，记录 Asset、模型、版本号、当前/历史状态。
3. **Outfit.characterId**：一套穿搭属于一个角色；不能仅靠 User 所有权推断角色。
4. **Asset lineage**：AI 生成、导入、编辑派生之间要能追溯 sourceAssetId、projectId、版本和作者/授权信息。
5. **EditorDocument**：持久化像素画布的图层、顺序、可见性、不透明度、画布尺寸、当前选区及关联 Asset/Project；LocalStorage 仅作离线缓存。
6. **GenerationTask**：AI 任务状态、输入、输出候选、模型/参数、错误、成本与用户确认状态。
7. **Community interaction**：Publication 审核状态机、Comment、Reaction、收藏对象范围、举报和审计。

新增 schema 必须同步 PostgreSQL / MySQL / SQLite 三套 schema 与 migration；仅改 PostgreSQL 不算完成。迁移必须 additive，并保留现有用户、项目、素材和穿搭数据。

## 2. 页面职责与路由关系

| 页面/路由 | 唯一职责 | 必须读取/写入 | 下一步交接 |
|---|---|---|---|
| `/` | 平台首页、最近项目和快速入口 | session、用户最近项目/角色、可公开内容 | 角色/换装/创作/社区 |
| `/wardrobe` | 我的角色、素材库、收藏和已保存穿搭的管理入口 | Character、Asset、Favorite、Outfit | 选择角色/素材/穿搭后进入 3D |
| `/dress-up` | 3D 试穿、穿脱、旋转、动作、背景、保存/恢复 | Character、SkinVersion、Asset、Outfit、WorkspaceState | 保存 Outfit、进入编辑器 |
| `/editor` | 单品/皮肤像素编辑、图层、导入导出 | EditorDocument、Asset、Project、WorkspaceState | 保存派生 Asset 并返回换装 |
| `/ai` | 文本/图片生成皮肤或服装候选 | GenerationTask、Project、输入 Asset | 用户确认后创建 Asset，进入编辑器/换装 |
| `/workbench` | 项目与创作工具入口，不复制工具本身 | Project、WorkspaceState | 跳转 AI/编辑器/换装 |
| `/workbench/ai` | 兼容入口，复用 `/ai` | 同一 AI 任务状态 | 同上 |
| `/workbench/edit` | 兼容入口，复用 `/editor` | 同一 EditorDocument | 同上 |
| `/workbench/dress` | 兼容入口；当前仍挂载旧 WardrobeWorkspace | 必须与 3D 换装共享状态 | 统一前不能删除旧实现 |
| `/creator` | 创作者资料、作品和发布管理 | CreatorProfile、Publication | 社区公开详情 |
| `/admin` | 管理用户、审核、统计和配置 | 服务端 RBAC、AuditLog、真实业务数据 | 管理操作审计 |

主导航目前同时展示创作工坊、AI、衣橱、3D 换装、单品编辑器、创作者中心；导航仍需根据最终 IA 统一命名和移动端行为。不要用重定向掩盖尚未迁移的功能。

## 3. 已核实 API 契约

| API | 方法 | 请求/响应要点 | 调用方 |
|---|---|---|---|
| `/api/assets` | GET | query: category/cursor/limit/ids；response: `{items,nextCursor}`；每项含 `fileUrl,isFavorite` | 衣橱、3D 换装、素材选择器 |
| `/api/assets` | POST | multipart: `file,category,visibility,attribution`；response: `{item}` | 上传入口、编辑器保存 |
| `/api/assets/:assetId/file` | GET | 会话鉴权后返回文件 bytes | 预览、编辑器、换装 |
| `/api/assets/:assetId` | DELETE | 仅 owner 删除；文件与 DB 删除补偿 | 素材管理 |
| `/api/assets/:assetId/favorite` | PUT/DELETE | 幂等收藏/取消；response `{ok,favorited}` | 衣橱、换装 |
| `/api/outfits` | GET/POST | 列表 `{items}`；创建请求为 name/skinAssetId/skinModel/background/pose/items；创建响应 `{item}` | 3D 换装、衣橱 |
| `/api/outfits/:outfitId` | GET/PUT/DELETE | 单条读取、完整替换、删除；owner scoped | 3D 换装 |
| `/api/workspace` | GET/PUT | `projectId,activeTool,activeAssetId,activeOutfitId` | AI、编辑器、换装 |

### 3.1 API 对齐时必须遵守

- 客户端不得提交 ownerId；用户身份必须从服务端 session 获取。
- 私有 Asset/Outfit/Workspace 必须 owner scoped；公开 Asset 可按规则复用。
- OutfitItem 的 category 必须与 Asset.category 一致；SKIN 只能作为基础皮肤。
- 上传必须验证 PNG 签名、大小、尺寸和角色权限；存储键由服务端生成。
- 私有响应使用 `Cache-Control: private, no-store`。
- 列表必须使用 cursor 分页，不能将 limit 提到 100 期待 API 返回 100；当前 API 最大 limit 为 60。
- 所有调用方必须处理 401/403/404/413/5xx、空数据、加载中、重试和取消请求。

## 4. 当前代码审计发现的同步缺口

以下均由 PR #39 当前代码核实：

1. **衣橱列表分页**：已在提交 `adae0a1` 修正为 limit=60 并跟随 `nextCursor` 加载更多；仍需最新 CI 与浏览器回归确认。
2. **角色实体缺失**：当前 schema 没有 Character；Outfit 也没有 characterId。多角色管理和角色级穿搭隔离尚不能实现。
3. **工作区只保存指针**：`WorkspaceState` 只有 project/activeTool/activeAsset/activeOutfit；编辑器图层 JSON 仍保存在浏览器 LocalStorage。
4. **换装状态保存粒度不足**：旧 `WardrobeWorkspace` 选择单个素材时仅更新 activeAssetId；完整 selected map 需通过 Outfit 保存。未保存的多部位组合不能跨设备恢复。
5. **衣橱和 3D 换装职责分裂**：`/wardrobe` 新页面是素材集合视图；`/dress-up` 和 `/workbench/dress` 仍有不同工作台实现。旧工作台必须在功能等价与数据恢复验证后再下线。
6. **服装渲染语义未闭环**：旧工作台把除披风外的服装图像直接按 64×64 全图叠加到皮肤；这不能替代披肩/外套各自正确的 UV 区域、层级、透明度和 3D 几何规则。不可将“素材显示在列表”视为“服装正确穿戴”。
7. **AI 与统一资产关系尚未证明**：AI 页面复用旧 AI studio；必须验证生成结果确认后是否通过服务端创建 Asset、记录 source=AI_GENERATION、关联 Project，并能被衣橱/编辑器/换装按同一 assetId 读取。
8. **编辑器云端文档缺失**：当前像素编辑器自动保存 LocalStorage；必须新增服务端 EditorDocument 保存/恢复，导入现有 Asset、保存派生 Asset、返回 3D 预览并保留版本关系。
9. **社区链路不完整**：Publication 模型存在不等于有作品广场、发布/撤回、审核、评论、反应、举报和授权展示的完整 API/页面。
10. **CI 当前阻塞**：已在提交 `c9078cc` 修正 Bresenham 半像素 tie-break，使正向/反向笔画路径一致；此前最新 head 的常规单元测试与安全工作流均因此失败，修复提交后的 CI 尚待 GitHub 重新运行。

## 5. 端到端数据流（目标）

### AI → 编辑器 → 衣橱 → 3D 换装 → 保存 → 导出/发布

1. 用户选择 Character/Project，服务端校验访问权限。
2. AI 创建 GenerationTask；候选输出不自动公开。
3. 用户确认候选，服务端验证图片和类别后创建 Asset（source=AI_GENERATION），记录输入/派生关系。
4. 编辑器按 assetId 加载纹理与 EditorDocument；保存时更新文档并创建新的 Asset 版本，不覆盖无关历史版本。
5. 衣橱按角色/分类显示同一 Asset；收藏只创建 AssetFavorite 关系。
6. 3D 换装按 Character 当前 SkinVersion 加载基础皮肤，按各类素材独立 UV/几何规则渲染；披风单独处理。
7. 保存 Outfit 时写入 characterId、skinAssetId、skinModel、ordered OutfitItem、equipped、pose、background；事务成功后更新 WorkspaceState.activeOutfitId。
8. 刷新/跨设备登录后，先恢复 Character 与 Outfit，再恢复每个 Asset；缺失或无权素材应明确报错，不可静默换成默认皮肤。
9. 导出时生成经过格式校验的目标文件；明确原版 64×64 PNG 不包含独立 3D 服装层和官方披风。
10. 发布时创建 Publication 快照/引用，执行授权、署名、可见性与审核检查。

## 6. 验收矩阵

| 范围 | 必须验证的操作 | 通过标准 |
|---|---|---|
| 账户/权限 | A/B 两个真实用户互相访问私有 Asset、Outfit、Workspace | 读写均拒绝；公开素材按规则可用 |
| 角色 | 创建两个角色、切换、设置不同皮肤与穿搭 | 角色间状态完全隔离 |
| 素材库 | 上传、分页、搜索、分类、收藏、取消收藏、删除 | 列表状态与 DB 一致；分页无重复/漏项 |
| AI | 文本/参考图生成、取消/失败、确认保存 | 任务状态完整；产物成为可复用 Asset |
| 编辑器 | 导入 Asset、图层操作、撤销重做、云端保存、刷新恢复 | 文档与 PNG 内容一致，跨设备可恢复 |
| 3D 换装 | 披肩/外套/披风分别试穿、替换、穿脱、旋转 | UV/位置正确；类别不会串位 |
| Outfit | 保存、修改、加载、删除、刷新和跨设备恢复 | Outfit + OutfitItem + WorkspaceState 一致 |
| 导出 | vanilla PNG、3D 预览图/项目格式分别导出 | 格式、尺寸、透明度和限制说明正确 |
| 社区 | 发布、审核、撤回、公开详情、收藏/互动 | 权限、署名、授权与审计完整 |
| 管理后台 | 用户状态、内容审核、统计、配置 | 服务端 RBAC；统计来自真实数据 |
| 部署 | PostgreSQL/MySQL/SQLite migration、runtime image、Docker volume | 三种 DB schema 一致；重启后文件和记录保留 |

## 7. 推荐实施顺序

1. 修复最新 head 的失败测试，确保 CI 不再因单元测试提前终止。
2. 补齐 Asset 列表分页与衣橱调用；统一 API 响应类型，建立共享客户端类型/服务。
3. 设计并实现 Character、SkinVersion、EditorDocument、GenerationTask 和 Asset lineage，多数据库同步迁移。
4. 将编辑器图层文档改为云端保存/恢复；LocalStorage 降级为离线草稿。
5. 将 AI 输出纳入 Asset/Project 关系；建立 AI→编辑器→衣橱的同一 assetId 闭环。
6. 统一 3D 换装工作台与 Outfit 恢复逻辑；完成各类别真实 UV/几何渲染；保留兼容路由。
7. 完成素材管理、角色管理、社区发布和管理后台的真实业务流程。
8. 补双用户 HTTP E2E、浏览器主流程、数据库迁移和 Docker 多数据库 smoke tests。
9. 所有验收通过后才移除旧 workspace/Vite 用户页面入口、合并 PR 和发布。

## 8. 当前发布门槛

PR #39 保持 Draft，不合并、不对生产执行迁移。必须满足：
- 最新 head 的 CI、Next.js preview/security、Docker smoke 全部通过；
- 双用户真实 HTTP E2E 通过；
- AI/编辑器/衣橱/3D/Outfit 数据流通过浏览器端到端测试；
- PostgreSQL、MySQL、SQLite migration 和 runtime 镜像验证通过；
- 生产数据库备份、数据回滚与 `/data` 文件卷恢复方案确认。
