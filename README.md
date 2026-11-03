# 拾趣

**还有剩余的 Codex token？不妨用来读读故事。**

用拾趣，把中国古典故事变成你自己的连环画。

[![拾趣作品《黛玉葬花与宝黛释疑》第 15–18 幅：宝玉兜着落花走近花冢，黛玉葬花吟诗、掩面落泪](.docs/assets/hero-story.webp)](https://yysun.github.io/awesome-shiqu/)

[在线阅读拾趣好故事 →](https://yysun.github.io/awesome-shiqu/)


## 快速开始制作

三种方式，任选一种：

### 1. npx：一条命令启动

安装 **Node 24** 后，在终端运行：

```bash
npx @apprun/shiqu
```

按提示选择书库和生成服务，打开终端打印的网址即可使用。同一 Wi-Fi 下，手机可扫描终端二维码接着读；保持终端运行，按 Ctrl+C 停止。

> 生成服务可选 Codex 订阅、OpenAI API 或 Gemini。Codex 订阅需 macOS 并安装和登录 Codex CLI；OpenAI API 与 Gemini 使用各自 API 密钥并单独计费。[如何选择后端](.docs/user-guide.md#如何选择后端)

[CLI 使用说明](.docs/user-guide.md#cli-启动)

### 2. Desktop：下载安装

内置 Node，无需另装运行环境。支持 Apple Silicon Mac（macOS 13.5+）和 Windows 10/11 x64。

[下载 macOS DMG](https://github.com/yysun/shiqu/releases/latest/download/shiqu-standard-macos-arm64.dmg) · [下载 Windows 安装程序](https://github.com/yysun/shiqu/releases/latest/download/shiqu-standard-windows-x64-setup.exe) · [所有版本与校验文件](https://github.com/yysun/shiqu/releases/latest)

安装后打开拾趣，在「设置」中选择生成服务，保存并启动，再点击「在浏览器打开」。安装包未签名，首次打开的系统提示见[桌面版入门](.docs/user-guide.md#桌面版入门)。

### 3. Skill：让 Codex 帮你制作

需要 **Node 24**。运行一次，安装供当前用户各项目使用的技能：

```bash
npx @apprun/shiqu skill install --scope global
```

然后在 Codex 中说：

```text
$shiqu 从《庄子》中找一个关于善意与误解的故事，用水墨写意。
先给我候选和制作方案，确认后再生成插图，完成后导出离线预览和公开 ZIP。
```

无需启动桌面或浏览器服务。[提示词示例](.docs/use-as-skill.md)



## 界面预览

以《黛玉葬花与宝黛释疑》为例：发现 → 制作流程 → 书架 → 阅读。

[![拾趣手机界面：《黛玉葬花与宝黛释疑》的发现、制作流程、书架与阅读](.docs/assets/daiyu-phone-screens.webp)](.docs/user-guide.md#制作与阅读故事)

[制作与阅读指南 →](.docs/user-guide.md#制作与阅读故事)

## 更多说明

[使用指南](.docs/user-guide.md) · [使用前了解](.docs/user-guide.md#使用前了解) · [升级到 0.7.0](.docs/user-guide.md#升级到-070) · [书库说明](data/README.md) · [画风](.docs/user-guide.md#画风) · [手机阅读](.docs/user-guide.md#在手机上阅读) · [发布作品](.docs/user-guide.md#发布你的拾趣作品) · [常见问题](.docs/user-guide.md#常见问题)

## 开发者

React + Vite 前端、Node REST API 与生产核心、SQLite 与本地媒体目录，无需独立数据库。源码开发使用 **Node 24.22.1** 与 **pnpm 11.25.0**：

```bash
nvm install
nvm use
corepack enable pnpm
pnpm run setup
pnpm dev
```

桌面 UI 预览用 `pnpm desktop:preview`，CLI 命令用 `pnpm cli help --json`。配置与检查见[开发指南](.docs/development.md)，桌面开发与打包见[桌面文档](desktop/README.md)。[更新记录](CHANGELOG.md)

## 许可

项目原创代码与文档采用 [Apache License 2.0](LICENSE)，允许商业使用、修改与再分发，具体条件见许可全文及 [NOTICE](NOTICE)。

古典原文与第三方资料遵循各自适用的权利要求，见[来源说明](data/library/source-notices.md)和[书目清单](data/library/catalog.json)。

拾趣不主张用户生成的故事或插图的著作权；其权利归属取决于适用法律，用户仍须遵守素材权利要求和 AI 生成服务条款。生成内容不会自动适用项目代码的 Apache-2.0 许可。分享前请检查[署名与转载说明](.docs/user-guide.md#署名与转载)及 [ZIP 内容](.docs/user-guide.md#zip-内容与提示词分享)。
