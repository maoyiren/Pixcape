import Link from 'next/link'
import { Anchor, Container, Divider, List, Stack, Text, Title } from '@mantine/core'

export const metadata = {
  title: '隐私政策',
  description: '了解 CDPC 如何处理账户、创作内容、设备与服务使用信息。',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <Container size="md" py={{ base: 'xl', sm: 56 }} className="cdpc-legal-page">
      <Stack gap="lg">
        <Stack gap="xs">
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={1.5}>CDPC / LEGAL</Text>
          <Title order={1}>隐私政策</Title>
          <Text c="dimmed">生效日期：2026 年 11 月 21 日 · 版本：1.0</Text>
          <Text c="dimmed" size="sm">本政策适用于 CDPC（像素角色创作工具及相关网站服务）。请在使用服务前阅读。</Text>
        </Stack>
        <Divider />
        <Stack gap="sm">
          <Title order={2} size="h3">1. 我们处理哪些信息</Title>
          <Text>为提供账户、创作和社区功能，CDPC 可能处理以下类别的信息，具体取决于你使用的功能：</Text>
          <List spacing="xs">
            <List.Item><b>账户信息：</b>邮箱地址、用户名、昵称、账户头像、账户状态，以及用于身份验证的密码哈希值。我们不会以明文形式保存你提交的账户密码。</List.Item>
            <List.Item><b>第三方登录信息：</b>当你选择 Google、Microsoft、GitHub 或 Apple 登录时，身份验证服务会向我们提供完成登录所需的账户标识及经授权的基本资料；具体字段由服务商授权范围决定。</List.Item>
            <List.Item><b>创作与用户内容：</b>你上传或创建的皮肤、服装贴图、素材、项目、搭配、收藏、作品说明、署名及可见性设置。</List.Item>
            <List.Item><b>服务运行信息：</b>请求时间、必要的安全与错误诊断信息，以及用于登录和注册频率限制的技术信息。服务器、托管或安全服务商也可能按其配置记录访问日志。</List.Item>
            <List.Item><b>通信信息：</b>当服务启用邮箱验证或邮件登录时，为发送验证或登录邮件而处理的邮箱地址及相关验证记录。</List.Item>
          </List>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">2. 信息如何使用</Title>
          <List spacing="xs">
            <List.Item>创建和维护账户、验证身份、提供登录及账户安全功能。</List.Item>
            <List.Item>保存、展示、管理和交付你主动创建或上传的创作内容。</List.Item>
            <List.Item>按你选择的可见性设置提供私人、未列出或公开内容访问。</List.Item>
            <List.Item>在你主动使用相关功能时，处理 AI 创作请求、发送验证邮件并提供对应结果。</List.Item>
            <List.Item>防止滥用、限制异常请求、排查故障、维护服务安全及履行法律义务。</List.Item>
          </List>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">3. Cookies 与登录会话</Title>
          <Text>CDPC 使用维持登录状态和保护账户所必需的会话 Cookie。关闭或清除 Cookie 可能导致你需要重新登录。我们不会在本政策中声称使用尚未核实或尚未部署的广告追踪 Cookie。</Text>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">4. 信息共享与第三方服务</Title>
          <Text>我们不会出售你的个人信息。为运行你请求的功能，必要信息可能由以下类别的服务商处理：</Text>
          <List spacing="xs">
            <List.Item>身份验证服务商（例如你主动选择的 Google、Microsoft、GitHub 或 Apple）；</List.Item>
            <List.Item>网站托管、数据库、文件存储、网络安全及基础设施服务商；</List.Item>
            <List.Item>在相关功能已启用且你主动提交请求时，提供 AI 模型或邮件发送能力的服务商。</List.Item>
          </List>
          <Text>这些服务商仅应在提供相应服务所需的范围内处理信息，并可能依据其自身隐私政策处理相关数据。你使用第三方登录或外部服务时，也应阅读对应服务商的政策。</Text>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">5. 公开内容与用户控制</Title>
          <Text>上传素材或发布作品时，请留意可见性选项。公开内容可能被其他用户查看、链接、引用或保存；将内容改为私人或删除后，已被他人复制、缓存或独立保存的副本不一定能够同步清除。请勿上传你无权使用或公开的内容。</Text>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">6. 保存期限与安全</Title>
          <Text>我们会在提供服务所需期间保存信息，并在实现本政策所述目的、处理争议、保障安全或遵守法律所需的范围内继续保存。具体保存期限会因数据类型、功能配置和法律要求而异。我们采用与服务规模相适应的访问控制和安全措施，但互联网传输及电子存储无法保证绝对安全。</Text>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">7. 你的选择与隐私权利</Title>
          <Text>你可以通过账户功能查看或更新部分资料、管理内容可见性，并停止使用第三方登录。你也可以提出访问、更正、删除个人信息或注销账户的请求；我们会在适用法律要求的范围内核实并处理。部分信息可能因安全、争议处理或法定义务而需要保留。若账户页面暂不提供相应操作，请通过 CDPC 网站公布的运营联系渠道提出请求。</Text>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">8. 未成年人</Title>
          <Text>如果你未达到所在地法律规定的独立同意年龄，请在父母或监护人同意并指导下使用服务。若我们发现未经适当同意收集了依法需要监护人同意的信息，将采取合理措施处理。</Text>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">9. 跨境处理与政策更新</Title>
          <Text>你使用的托管、身份验证或其他基础设施可能位于你所在国家或地区以外。我们会在适用法律要求的范围内采取相应措施。本政策可能因功能、服务商或法律变化而更新；更新版本会发布在本页面，并标注生效日期。</Text>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">10. 联系与相关文件</Title>
          <Text>如对本政策或个人信息处理有疑问，请通过 CDPC 网站公布的运营联系渠道与我们联系。</Text>
          <Text size="sm" c="dimmed">继续使用服务还应遵守 <Anchor component={Link} href="/terms">服务条款</Anchor>。本页面为服务隐私说明，不构成法律意见。</Text>
        </Stack>
        <Divider />
        <Text size="sm" c="dimmed">English summary: CDPC processes account and authentication data, user-created content, and limited technical information to operate the service, protect accounts, and provide features you request. We do not sell personal information. You can request access, correction, or deletion through the service's published contact channel, subject to applicable law and necessary retention.</Text>
      </Stack>
    </Container>
  )
}
