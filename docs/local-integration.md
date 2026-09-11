# Cairn 本地集成指南

Cairn 是一个 local-first 的学习上下文与记忆层。它直接连接你选择的本地学习资料目录，提供文件树、网页阅读、学习状态、计划、学习记录和复习入口。

本指南适合已经了解 Cairn、准备把它接入自己电脑学习环境的用户。产品概览请先阅读 [README](../README.md)。

## 使用边界

Cairn 项目目录和学习资料目录彼此独立：

- **Cairn 项目目录**：存放网页应用代码和可选的 VS Code 本地桥接服务。
- **学习资料目录**：存放你自己的 Markdown、代码、PDF、Notebook、DOCX、图片等文件。

资料不需要复制进 Cairn 项目。Cairn 只读取你明确选择的目录，并在该目录根部保存 `.cairn-workspace.json`。

Cairn 不替代 Gemini、Copilot、Codex、Claude Code 或 VS Code，也不会自动读取或保存这些工具的对话。是否向外部 AI 提供文件内容，由你在对应工具中主动决定。

## 前置条件

- Node.js `20.19+`（或 `22.12+`）
- 最新版 Chrome 或 Edge；本地文件夹能力依赖 File System Access API
- 如果需要“在 VS Code 中打开”，准备 macOS 上的 VS Code

Safari 和 Firefox 可以查看示例学习库，但本地文件夹能力可能受限。

## 安装与启动

仓库地址：<https://github.com/kiwiwu02/Cairn>

```bash
git clone https://github.com/kiwiwu02/Cairn.git
cd Cairn
npm ci
npm run build
npm run dev
```

打开终端显示的本地地址即可使用。需要预览生产构建时执行：

```bash
npm run preview
```

## 部署为静态站点

`npm run build` 产出的 `dist/` 是纯静态目录：没有服务端依赖、没有环境变量、也没有需要保护的密钥。`vite.config.js` 使用 `base: './'`，因此产物可以放在任意子路径（例如 `https://你的用户名.github.io/Cairn/`）而无需重新配置。

`dist/` 可以托管到任意静态平台；当前仓库只通过 GitHub Pages workflow 发布，构建命令是 `npm run build`，输出目录是 `dist`。

当前发布版本暂不启用线上页面与 VS Code 的关联，但文件页会保留“在 VS Code 中打开”按钮并置灰，悬浮时显示“当前版暂不支持 VS Code 关联，请从 Github 克隆到本地使用此功能”。本地开发版在启动桥接服务后仍可正常使用；如果未来重新启用线上联动，需要在启动桥接服务时放行你的域名：

```bash
npm run bridge -- --root "/absolute/path/to/your-learning-library" --allow-origin https://你的站点域名
```

GitHub Pages 的最简做法是在仓库设置里启用 Pages（Source 选 GitHub Actions），并提交一个 workflow：`actions/checkout` → `actions/configure-pages` → `npm ci && npm run build` → `actions/upload-pages-artifact`（`path: dist`）→ `actions/deploy-pages`。之后推送到默认分支就会自动重新上线。

## 连接本地学习资料

1. 打开 Cairn，点击“打开本地文件夹”。
2. 选择你的学习资料目录，例如 `/absolute/path/to/your-learning-library`。
3. 在左侧文件树中选择文件，直接在 Cairn 内阅读和学习。
4. 学习完成一个阶段后，点击“学习管理”，选择学习状态，按需填写备注，再点击“记录本次学习”。

打开文件只代表查看，不代表学习完成。只有主动记录，Cairn 才会新增一次学习记录；同一个文件可以记录多次学习。

如果资料目录中仍有旧版本的 `.learning-workspace.json`，Cairn 可以兼容读取；第一次成功保存时会迁移为 `.cairn-workspace.json`。

## 与 VS Code 协同

### 启动本地桥接服务

在 Cairn 项目目录打开终端，绑定与 Cairn 中选择的同一个资料目录：

```bash
npm run bridge -- --root "/absolute/path/to/your-learning-library"
```

如果不传 `--root`，macOS 会弹出目录选择器。桥接服务默认监听 `127.0.0.1:4317`，只处理绑定根目录内的文件。

### 允许哪个网页调用

桥接服务同时约束调用来源：默认只放行本机回环页面（`127.0.0.1` / `localhost` / `::1`），避免把“读本机文件、拉起 VS Code”的能力暴露给任意网站。

| 参数 | 作用 |
| --- | --- |
| `--allow-origin https://你的域名` | 追加放行的远程站点，可重复，也支持逗号分隔 |
| `--no-remote` | 强制关闭全部远程来源，连 `--allow-origin` 也忽略 |

**默认白名单是空的**：除本机回环页面外，任何在线部署（包括 `kiwiwu02.github.io`）都不能调用桥接服务，因此线上版的“在 VS Code 中打开”按钮保持置灰，并在悬浮时显示“当前版暂不支持 VS Code 关联，请从 Github 克隆到本地使用此功能”。想要线上联动，必须由你自己显式加一个精确来源：

```bash
npm run bridge -- --root "/absolute/path/to/your-learning-library" --allow-origin https://your-site.example.com
```

启动日志会打印当前放行的远程站点，方便确认自己的暴露面。

两点已知边界：

- 来源必须与白名单完整相等（scheme + host + port），带路径、端口不符或 `https://白名单域名.evil.com` 这类伪装都会被拒绝。
- HTTPS 页面访问本机 `http://127.0.0.1:4317` 依赖浏览器把回环地址视为可信来源。Chrome 和 Edge 通常放行，部分 Safari / Firefox 版本会按混合内容拦截；这种情况请改用本地 `npm run dev` 地址使用 VS Code 协同。

来源未放行时，网页不会卡在报错上：Cairn 会自动回退到浏览器目录选择器，并提示放行的命令；线上发布版本还会保留“在 VS Code 中打开”按钮，但在本地 Bridge 模式之外均不可用。

### 打开文件

1. 让桥接服务保持运行。
2. 回到 Cairn，在文件页点击“在 VS Code 中打开”。
3. Cairn 会优先调用 `code` 命令，并在 macOS 上回退到 Visual Studio Code 应用。
4. 如果想在 VS Code 内部使用 Cairn，打开 VS Code 的 **Simple Browser / 简易浏览器**，输入 Cairn 的本地开发地址。

桥接服务不会把文件上传到远程服务，也不会读取或保存 AI 对话。它只在本机回环地址提供打开文件所需的接口。

## 日常学习闭环

```text
选择本地资料 → Cairn / VS Code 阅读 → Gemini、Copilot、Codex 或 Claude Code 协作
→ 回到 Cairn 主动记录 → 按状态和复习日期继续
```

推荐把一次学习拆成可完成的小阶段：先明确目标，学习一段内容，记录当前状态和备注，再决定下一次复习时间。这样“看过”和“学会”不会混在一起。

## 项目结构

```text
Cairn/
├── bridge/                 # 可选的 macOS / VS Code 本地桥接服务
├── docs/                   # 本地集成指南与产品展示素材
├── public/demo/            # 无需本地文件夹即可体验的示例内容
├── src/main.js             # 文件访问、阅读器和学习记录逻辑
├── src/style.css           # 界面、响应式布局与主题样式
├── index.html              # 应用入口
├── package.json            # 本地开发命令与依赖声明
└── vite.config.js          # Vite 构建配置
```

## 第三方依赖

Cairn 使用以下开源依赖，发布和再分发时请同时遵守各自许可证：

- [DOMPurify](https://github.com/cure53/DOMPurify)：MPL-2.0 / Apache-2.0
- [Highlight.js](https://github.com/highlightjs/highlight.js)：BSD-3-Clause
- [Mammoth](https://github.com/mwill21/mammoth.js)：BSD-2-Clause
- [Marked](https://github.com/markedjs/marked)：MIT
- [PDF.js](https://github.com/mozilla/pdf.js)：Apache-2.0

## 给编码智能体的安装提示词

下面的提示词可以直接复制给 Codex、Claude Code 或其他编码智能体，让它协助完成本地安装和接入。请先把资料目录替换成真实路径。

```text
仓库地址：https://github.com/kiwiwu02/Cairn.git
本地学习资料目录：/absolute/path/to/your-learning-library

请帮我把 Cairn（Cairn · 记录通往精通的每一步 · Mark Your Way to Mastery.）集成到本机，用它管理上面的本地学习资料目录。

Cairn 是一个 local-first 学习上下文与记忆层：它管理本地资料的文件树、网页阅读、VS Code 协同、学习状态、学习备注、计划和复习记录。它不是 AI 模型，也不负责保存 Gemini、Copilot、Codex 或 Claude Code 的对话。

请按以下顺序完成：
1. 先确认仓库地址和本地学习资料目录都可访问；路径不存在或没有权限时，先告诉我，不要自行换目录。
2. 如果当前没有 Cairn 项目，先克隆仓库并进入项目目录；如果已经在项目目录，先检查现有改动，不要覆盖我的工作。
3. 检查 Node.js 是否满足 20.19+（或 22.12+），执行 npm ci、npm run build。
4. 执行 npm run dev，并告诉我本地访问地址。
5. 在 macOS 上另开终端执行 npm run bridge -- --root "/absolute/path/to/your-learning-library"，让 Cairn 能在 VS Code 中打开同一份文件。
6. 告诉我如何在 Cairn 中选择这个目录，以及如何在 VS Code 的 Simple Browser 中打开 Cairn 地址。
7. 用一个真实文件验证文件树、网页阅读、在 VS Code 中打开和“记录本次学习”流程；打开文件不要自动生成学习记录。
8. 保持 .cairn-workspace.json 的文件式存储，不引入数据库、账号系统、云端同步或文件上传。
9. 只读取我明确提供的本地资料目录，不扫描项目外目录，不复制资料，不读取或保存外部 AI 对话。
10. 完成后汇报：项目目录、资料目录、执行过的命令、构建结果、网页地址、桥接状态和仍存在的限制。
```

## 给 AI 学习助手的协作提示词

```text
Cairn 项目仓库：https://github.com/kiwiwu02/Cairn
我正在通过 Cairn 管理本地学习资料，当前资料目录是：/absolute/path/to/your-learning-library

请作为我的学习协作助手：
1. 只使用我从 Cairn 当前文件中主动提供的内容、片段或路径上下文，不要求我上传整个文件夹。
2. 先说明当前文件的学习目标，再按可完成的小步骤帮助我理解。
3. 解释优先联系当前文件的真实内容；不确定的地方明确说明，不编造结论。
4. 每完成一个阶段，给我一个问题、例子或练习进行自测。
5. 打开或阅读文件不等于学习完成。只有我明确说“记录本次学习”时，才总结本次收获、疑问、建议状态和下一步。
6. Cairn 中的学习状态由我确认：学习中、已理解、已掌握或待复习；不要把“看过”描述成“已掌握”。
7. 如果建议待复习，请给出复习切入点和建议日期，我会在 Cairn 中保存。
8. 不要读取或保存 AI 对话，不要把本地资料发送到未获我确认的远程服务。
```

## 故障排查

- **文件夹无法选择**：使用最新版 Chrome 或 Edge，并确认页面运行在本地开发地址。
- **VS Code 按钮无响应**：确认桥接服务正在运行、绑定目录正确，并检查 VS Code 的 `code` 命令是否可用。
- **桥接服务提示路径错误**：传入资料目录的绝对路径，并确认该目录真实存在。
- **学习记录没有保存**：确认当前资料目录可写；学习状态和备注是在点击“记录本次学习”后保存的。
