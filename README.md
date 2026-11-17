<p align="center"><img src="docs/baiyu/icon.png" width="112" alt="Baiyu Bot"></p>

<h1 align="center">Baiyu Bot · 摆鱼</h1>

<p align="center">
  <a href="#中文">中文</a> · <a href="#english">English</a> ·
  <a href="https://github.com/chazai233/baiyu-bot/releases/latest">下载 / Download</a>
</p>

<p align="center"><img src="docs/baiyu/agents.jpg" width="820" alt="The agents in 3D"></p>

---

## 中文

**Baiyu Bot 是一个安卓手机 App，用来在手机上和你的 AI 智能体团队一起工作。** 它是开源项目
[agentes.chat](https://github.com/agentes-chat/agentes-chat) 手机端的一个 fork：功能来自 agentes.chat，名字、图标和
智能体的 3D 形象是本项目自己的。

它连接的是 agentes.chat 的服务器：可以是 agentes.chat Cloud，也可以是你自己部署的服务器。Baiyu Bot 本身不提供服务器。

### 下载和安装

1. 到 [Releases](https://github.com/chazai233/baiyu-bot/releases/latest) 下载最新的
   `baiyu-bot-vX.Y.Z-android-arm64.apk`。
2. 在手机上打开安装。系统会提示“未知来源”，允许即可。
3. 打开 App，填你的服务器地址并登录。在网页端点 “Open on your phone” 扫码最快。

要求：Android 7.0 及以上，arm64 处理器（近几年的安卓手机基本都是）。同一个签名的新版本可以直接覆盖安装。

### 和官方手机端的区别

| | 说明 |
|---|---|
| 3D 智能体 | 智能体头像是立体的软胶质感小方块，颜色、眼睛样式和配饰与官方设置一一对应；会呼吸、眨眼，工作时小跳 |
| 更流畅 | 头像动画不占用响应点击的线程，智能体列表滑动不再卡顿 |
| Tailscale 服务器 | 手机系统解析不到 `*.ts.net` 地址时，App 会直接询问 Tailscale 的 DNS |
| 连接失败的原因 | 填服务器地址失败时，在提示下方显示系统给出的具体原因 |
| 置顶 | 在“查看全部”列表里长按一行即可置顶（官方只能在主页的前五行里置顶） |
| 技能 | 在技能详情页直接为每个智能体打开或关闭这个技能 |
| 存储设置 | 修复了填写 S3 表单时表单自己关闭的问题 |
| 打开对话 | 已有的对话点了立即打开，不再等服务器返回 |
| 发送文件失败 | 提示下方显示服务器或网络给出的原因 |

### 目前的限制

- **没有推送通知。** 推送需要 Firebase 配置，本项目的构建没有带。打开 App 时消息和审批会实时更新。
- **只有安卓。** 没有构建 iPhone 版本。
- 聊天里的贴纸和少数装饰图案仍是 agentes.chat 原来的像素风格。
- 自定义颜色的智能体显示为最接近的预设颜色。
- 每个版本只在构建和自动化测试层面验证过，没有逐台真机测试。遇到问题请到
  [Issues](https://github.com/chazai233/baiyu-bot/issues) 反馈，附上机型、安卓版本和截图。

### 版本

| 版本 | 内容 |
|---|---|
| v1.2.3 | 应用内预览 PDF：逐页加载、双指缩放、支持中文 |
| v1.2.2 | 修复首页、动态等列表上下滑动不跟手、误触成左右滑动的问题 |
| v1.2.1 | 更流畅：不在前台的标签页和被覆盖的页面暂停刷新；背景天空不再逐帧重绘；列表里的智能体静止 |
| v1.2.0 | 3D 智能体形象；新的图标和启动画面 |
| v1.1.0 | 存储表单修复、列表更流畅、对话即点即开、全部列表可置顶、技能按智能体开关、发送文件失败原因 |
| v1.0.0 | 第一个版本：Baiyu Bot 自己的名字、包名和图标；Tailscale 地址解析；连接失败原因 |

### 自己构建

App 的代码在 `apps/mobile`（Expo / React Native）。本仓库的 Android 构建在 GitHub Actions 上完成：

- 工作流是 `.github/workflows/android-fork.yml`，推送到 `apk` 分支时运行，产出 arm64 的 APK。
- `apps/mobile/RELEASE` 写着版本号（例如 `v1.2.0`）。这个版本号还没有对应的发行版时，构建结果会自动发布为发行版；
  否则只作为草稿保存。
- 签名密钥在第一次构建时生成，保存在 Actions 缓存里，不进入代码仓库。也可以改用仓库的
  `ANDROID_KEYSTORE_*` 密钥。
- 3D 形象的模型和渲染脚本在 `apps/mobile/scripts/agent3d`。

`main` 和 `apk` 两个分支内容相同；构建只在 `apk` 上触发。

### 来源和许可

- Baiyu Bot 基于 **agentes.chat**（Codari Global, LLC 及贡献者），代码以
  [AGPL-3.0-only](LICENSE) 许可发布，本仓库的全部改动同样以 AGPL-3.0-only 发布。
- agentes.chat 的名字、标志和图标是其所有者的商标（见 [TRADEMARKS.md](TRADEMARKS.md)）。Baiyu Bot 是独立的
  fork，与 agentes.chat 及 Codari Global, LLC 没有隶属或背书关系。
- 服务器、网页端和桌面端的说明，见上游项目的说明文件：[README.agentes-chat.md](README.agentes-chat.md)。

---

## English

**Baiyu Bot (摆鱼) is an Android app for working with your team of AI agents from your phone.** It is a
fork of the phone app of the open-source project [agentes.chat](https://github.com/agentes-chat/agentes-chat): the
features are agentes.chat's; the name, the icon and the agents' 3D look are this project's own.

It connects to an agentes.chat server: agentes.chat Cloud, or one you host yourself. Baiyu Bot does not run a server.

### Download and install

1. Get the latest `baiyu-bot-vX.Y.Z-android-arm64.apk` from
   [Releases](https://github.com/chazai233/baiyu-bot/releases/latest).
2. Open it on the phone. Android asks about installing from an unknown source: allow it.
3. Open the app, enter your server's address and sign in. Scanning the QR code from "Open on your phone" on the web
   app is the fastest way.

Requires Android 7.0 or later on an arm64 phone (nearly every Android phone of recent years). A newer version with the
same signature installs over the one you have.

### What differs from the official phone app

| | |
|---|---|
| Agents in 3D | Agents are soft, rounded figures in three dimensions, with the same colours, eye styles and accessories as their settings; they breathe, blink and hop while they work |
| Smoother | The agents' motion no longer runs on the thread that answers taps, so lists of agents scroll without stutter |
| Tailscale servers | When the phone's resolver can't find a `*.ts.net` name, the app asks Tailscale's DNS directly |
| Why a connection failed | A failed server check shows the phone's own reason under the message |
| Pinning | Hold a row in a "See all" list to pin it (the official app pins only among the home's first five rows) |
| Skills | A skill's page turns it on or off for each agent |
| Storage settings | The S3 form no longer closes by itself while you type |
| Opening a conversation | A conversation you already have opens at the tap, without waiting for the server |
| A file that didn't send | The message shows the server's or the network's reason |

### Current limits

- **No push notifications.** They need a Firebase configuration, which this project's builds don't carry. With the app
  open, messages and approvals arrive in real time.
- **Android only.** No iPhone build.
- Stickers in chat and a few decorative marks are still in agentes.chat's original pixel style.
- An agent with a custom colour wears the nearest preset colour.
- Each version is checked by its build and automated tests, not on a range of phones. If something is wrong, open an
  [issue](https://github.com/chazai233/baiyu-bot/issues) with the phone model, Android version and a screenshot.

### Versions

| Version | What's in it |
|---|---|
| v1.2.3 | PDFs open inside the app: pages load as you scroll, pinch to zoom, Chinese text included |
| v1.2.2 | Lists with swipeable rows (home, Activity) scroll with the finger again instead of sticking or opening a row |
| v1.2.1 | Smoother: tabs you aren't on and covered screens stop updating; skies no longer redraw every frame; agents in lists hold still |
| v1.2.0 | Agents in 3D; new icon and launch screen |
| v1.1.0 | Storage form fix, smoother lists, conversations open at the tap, pinning from full lists, skills per agent, the reason a file didn't send |
| v1.0.0 | First release: Baiyu Bot's own name, package and icon; Tailscale name lookup; the reason a connection failed |

### Build it yourself

The app is in `apps/mobile` (Expo / React Native). This repository builds the Android app on GitHub Actions:

- The workflow is `.github/workflows/android-fork.yml`. It runs on a push to the `apk` branch and produces an arm64
  APK.
- `apps/mobile/RELEASE` holds the version (for example `v1.2.0`). A version with no release yet is published as one;
  any other build is kept as a draft.
- The signing key is made on the first build and kept in the Actions cache, never in the repository. The repository's
  `ANDROID_KEYSTORE_*` secrets can be used instead.
- The 3D model and the scripts that render it are in `apps/mobile/scripts/agent3d`.

`main` and `apk` hold the same code; only `apk` triggers a build.

### Origin and license

- Baiyu Bot is based on **agentes.chat** by Codari Global, LLC and its contributors, licensed under
  [AGPL-3.0-only](LICENSE). Every change in this repository is released under AGPL-3.0-only as well.
- The agentes.chat name, logo and icons are trademarks of their owner (see [TRADEMARKS.md](TRADEMARKS.md)). Baiyu Bot
  is an independent fork and is not affiliated with or endorsed by agentes.chat or Codari Global, LLC.
- For the server, the web app and the desktop app, see the upstream project's README:
  [README.agentes-chat.md](README.agentes-chat.md).
