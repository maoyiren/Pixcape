import Link from 'next/link'
import { Anchor, Container, Divider, List, Stack, Text, Title } from '@mantine/core'

export const metadata = {
  title: '服务条款',
  description: 'CDPC 网站与像素角色创作工具的使用规则。',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <Container size="md" py={{ base: 'xl', sm: 56 }} className="cdpc-legal-page">
      <Stack gap="lg">
        <Stack gap="xs">
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={1.5}>CDPC / LEGAL</Text>
          <Title order={1}>服务条款</Title>
          <Text c="dimmed">生效日期：2026 年 11 月 21 日 · 版本：1.0</Text>
          <Text c="dimmed" size="sm">访问或使用 CDPC，即表示你已阅读并同意本条款。若你不同意，请停止使用服务。</Text>
        </Stack>
        <Divider />
        <Stack gap="sm">
          <Title order={2} size="h3">1. 服务说明</Title>
          <Text>CDPC 是独立的 Minecraft 皮肤、服装搭配与像素创作工具项目，提供账户、皮肤及素材管理、角色预览、创作编辑和相关社区功能。不同功能可能分阶段开放、调整或暂停；部分能力需要配置第三方服务。</Text>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">2. 账户与安全</Title>
          <List spacing="xs">
            <List.Item>你应提供准确的注册信息，并及时更新重要资料。</List.Item>
            <List.Item>你有责任妥善保管登录凭据，并对通过你的账户进行的活动负责；发现未经授权的访问时应尽快通过网站公布的渠道通知我们。</List.Item>
            <List.Item>不得冒用他人身份、规避访问控制、滥用登录接口或干扰服务运行。</List.Item>
            <List.Item>我们可在法律允许范围内对违反条款、危及安全或损害其他用户权益的账户采取限制、暂停或终止措施。</List.Item>
          </List>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">3. 用户内容与知识产权</Title>
          <Text>你保留对自己原创内容依法享有的权利。上传、提交或发布内容时，你声明自己拥有必要权利，或已取得合法授权；内容不得侵犯他人的著作权、商标权、肖像权、隐私权或其他合法权益。</Text>
          <Text>为运行服务，你授予 CDPC 一项非独占、全球范围、免版税、可撤销（在删除内容或停止相关服务后按技术及法律要求处理）的有限许可，仅用于托管、存储、复制、转换、展示和传输你选择提交的内容，以及提供你请求的功能。公开发布的内容可按你选择的公开范围向其他用户展示。</Text>
          <Text>你不得将他人上传的素材用于超出其许可范围的用途。素材页面展示的署名、许可及下载限制应予以遵守。</Text>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">4. 禁止行为</Title>
          <List spacing="xs">
            <List.Item>上传恶意代码、违法内容、侵权内容或未经授权的个人信息。</List.Item>
            <List.Item>未经授权抓取、批量下载、复制或重新分发平台内容，或绕过素材许可和下载限制。</List.Item>
            <List.Item>攻击、扫描、干扰服务或尝试访问其他用户账户、私有项目及非公开数据。</List.Item>
            <List.Item>利用服务进行欺诈、骚扰、垃圾信息传播或其他违法活动。</List.Item>
            <List.Item>虚假声明素材来源、权利归属、授权状态或 AI 生成内容的真实性。</List.Item>
          </List>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">5. AI 与第三方服务</Title>
          <Text>如你使用 AI 创作功能，应确保提交的文字、图片和其他输入符合适用法律并且你有权使用。AI 输出可能不准确、重复或与第三方作品相似；你应自行检查输出并确认其可合法使用。除非另有明确说明，CDPC 不保证 AI 输出的唯一性、准确性或适用性。第三方登录、邮件、托管或 AI 服务还受相应第三方条款约束。</Text>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">6. 服务变更与可用性</Title>
          <Text>我们会尽合理努力维护服务，但不保证服务持续、不间断、无错误或所有功能始终可用。我们可能为维护、安全、升级或业务调整而修改、限制、暂停或停止部分功能，并在合理可行时提供提示。你应自行备份重要的创作文件和导出内容。</Text>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">7. 免责声明与责任限制</Title>
          <Text>在适用法律允许的最大范围内，服务按“现状”和“可用”基础提供。对于因第三方服务、网络故障、用户设备、用户内容或不可抗力导致的中断或损失，我们不作超出法律要求的保证。任何条款均不排除适用法律禁止排除的责任，也不限制消费者依法享有的强制性权利。</Text>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">8. 账户终止与内容处理</Title>
          <Text>你可以停止使用服务，并可按隐私政策说明提出账户或个人信息删除请求。账户终止后，相关内容和数据将依产品功能、技术条件及适用法律处理；公开内容的既有副本、备份或依法需保留的信息可能不会立即全部消失。</Text>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">9. 条款更新</Title>
          <Text>我们可能因服务或法律变化更新本条款。更新版本将在本页面公布并标注生效日期。重大变更会在适用法律要求的情况下通过合理方式提示。更新生效后继续使用服务，即表示你接受更新后的条款。</Text>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h3">10. 适用法律与联系</Title>
          <Text>本条款的解释及争议处理应遵循适用法律；如任何条款被认定为不可执行，其余条款仍在法律允许范围内有效。有关本条款的问题，请通过 CDPC 网站公布的运营联系渠道与我们联系。</Text>
          <Text size="sm" c="dimmed">关于个人信息处理，请阅读 <Anchor component={Link} href="/privacy">隐私政策</Anchor>。本条款不构成法律意见。</Text>
        </Stack>
        <Divider />
        <Text size="sm" c="dimmed">English summary: By using CDPC, you agree to use the service lawfully, respect intellectual-property rights and other users, and keep your account secure. You retain rights in your original content while granting CDPC a limited license needed to operate the features you use. AI outputs may require independent review.</Text>
      </Stack>
    </Container>
  )
}
