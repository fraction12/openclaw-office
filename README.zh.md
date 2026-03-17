# OpenClaw Office

> [English](./README.md)

> 面向 OpenClaw 的实时办公室式监控与管理前端。

OpenClaw Office 是 [OpenClaw](https://github.com/openclaw/openclaw)
Multi-Agent 系统的可视化控制台。它通过 WebSocket 连接 OpenClaw Gateway，
把 Agent 的可观测状态整理为证据，再派生为办公室视图、聊天面板和控制台中的实时 UI。

当前产品形态主要由三部分组成：

- Office 视图：Pixi 驱动的 2D 办公室，以及可切换的 React Three Fiber 3D 场景
- Chat Dock：底部停靠的会话栏，支持流式消息和中止运行
- Console：Dashboard、Agents、Channels、Skills、Cron、Settings

![office-2D](./assets/office-2d.png)

## 功能概览

### Office 视图

- 基于 Pixi.js 的 2D 办公室渲染，包含工位、临时工位、会议区、休息区和 Agent 动画
- 与同一份派生状态联动的 React Three Fiber 3D 场景
- Agent 头像、工具调用、发言气泡、协作连线、时间轴和指标面板
- 移动端自动切换到更轻量的 2D 模式

### 控制与运维

- 向 Agent Session 发送消息，并中止当前运行
- 查看 Agent 详情、文件、工具、技能、渠道和 Cron 绑定
- 跟踪用量、事件历史、协作关系和子 Agent 活动
- 管理本地已安装技能，并浏览来自 ClawHub 的外部技能元数据

### 连接模式

- 本地 Gateway 模式：浏览器通过同源 `/gateway-ws` 连接
- 远程 Gateway 模式：浏览器仍然连到 Office 服务，由 Office 代理到远端 Gateway
- Token 可来自 `VITE_GATEWAY_TOKEN`、`OPENCLAW_GATEWAY_TOKEN`，或 OpenClaw 本地配置文件

![console-dashboard](./assets/console-dashboard.png)

## 架构

当前应用采用“证据优先”的状态流水线：

```text
Gateway events / RPC
  -> ws-client / rpc-client
  -> adapter-provider / ws-adapter
  -> event-parser
  -> evidence-store
  -> state-deriver
  -> Zustand slices
  -> Pixi office / React panels / R3F scene
```

核心原则：

1. WebSocket 帧是主要的实时数据源。
2. 事件先写入每个 Agent 的 evidence，而不是直接把 UI 状态当真相。
3. `state-deriver` 决定可见状态、置信度、工具文本和发言内容。
4. 渲染层只消费派生状态，不负责定义真相。

仓库中仍保留了 `src/components/office-2d/` 下较早的 SVG 办公室组件，
但当前 `/` 路由默认使用的是 Pixi 2D 渲染器。

## 快速开始

### 运行打包版本

```bash
npx @ww-ai-lab/openclaw-office

# 或全局安装
npm install -g @ww-ai-lab/openclaw-office
openclaw-office
```

CLI 参数：

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `-t, --token <token>` | Gateway 认证 token | 能自动发现时自动加载 |
| `-g, --gateway <url>` | Gateway WebSocket 地址 | `ws://localhost:18789` |
| `-p, --port <port>` | Office 服务端口 | `5180` |
| `--host <host>` | 绑定地址 | `0.0.0.0` |
| `-h, --help` | 显示帮助 | — |

Gateway URL 的解析优先级：

1. `--gateway`
2. `OPENCLAW_GATEWAY_URL`
3. `~/.openclaw/openclaw-office.json`
4. `ws://localhost:18789`

Token 的解析优先级：

1. `--token`
2. `OPENCLAW_GATEWAY_TOKEN`
3. `~/.openclaw/openclaw.json`
4. `~/.clawdbot/clawdbot.json`

如果 Gateway URL 自带 `?token=...`，Office 会提取这个 token，并在建立上游连接前把它从 URL 中移除。

## 开发

### 前置条件

- Node.js 22+
- 标准工作流使用 `pnpm`
- 真实联调需要正在运行的 OpenClaw Gateway；纯 UI 开发可使用 `VITE_MOCK=true`

### 安装依赖

```bash
pnpm install
```

### 配置真实 Gateway

先获取 token：

```bash
openclaw config get gateway.auth.token
```

再创建 `.env.local`：

```bash
cat > .env.local << 'EOF'
VITE_GATEWAY_TOKEN=<你的-token>
EOF
```

如果 dev 模式要代理到非默认地址，可以额外配置：

```bash
VITE_GATEWAY_URL=ws://your-gateway-host:18789
```

OpenClaw Gateway 2026.2.15+ 对很多客户端要求 device identity。Web UI 需要启用官方文档中的 bypass：

```bash
openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true
```

修改后请重启 Gateway。

### 启动应用

```bash
pnpm dev
```

浏览器始终连接同源 `/gateway-ws`。开发模式下由 Vite 代理到上游 Gateway；
打包后的 Node 服务也会执行同样的代理职责。

### Mock 模式

```bash
VITE_MOCK=true pnpm dev
```

此模式会启用 mock adapter 和模拟 Agent 活动，无需真实 Gateway。

### 常用命令

```bash
pnpm dev
pnpm build
pnpm test
pnpm test:watch
pnpm typecheck
pnpm lint
pnpm format
pnpm check
```

说明：

- 本仓库标准包管理器是 `pnpm`，但在依赖已安装的前提下，`npm run <script>` 也可执行脚本。
- `lint` 和 `format` 直接调用 `oxlint`、`oxfmt` 二进制。如果这些命令不在 `PATH` 中，即使依赖已安装，这两个脚本也会失败。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 构建 | Vite 6 |
| UI | React 19 |
| 2D | Pixi.js + 保留中的旧 SVG 组件 |
| 3D | React Three Fiber、drei、postprocessing |
| 状态管理 | Zustand 5 + Immer |
| 样式 | Tailwind CSS 4 |
| 路由 | React Router 7 |
| 图表 | Recharts |
| 国际化 | i18next + react-i18next |
| 实时通信 | 原生 WebSocket API |

## 项目结构

```text
src/
├── App.tsx, main.tsx            # 启动、路由、连接初始化
├── gateway/                     # ws/rpc 客户端、adapter、事件解析、ClawHub client
├── store/                       # Zustand slices、evidence store、事件编排
├── pixi/                        # 当前主 2D 办公室渲染器
├── components/
│   ├── office-2d/               # 旧 SVG 办公室组件
│   ├── office-3d/               # R3F 场景
│   ├── panels/                  # 办公室侧栏面板
│   ├── chat/                    # 聊天 Dock
│   ├── console/                 # 控制台功能组件
│   ├── layout/                  # Shell、Sidebar、TopBar
│   └── shared/                  # 通用 UI
├── hooks/                       # gateway、轮询、响应式、ambient hooks
├── lib/                         # 派生逻辑、URL、持久化、视图辅助
└── i18n/                        # 中英文资源
```

## 安全说明

OpenClaw Office 主要面向本地或私有网络使用。浏览器侧 token 接口和
`dangerouslyDisableDeviceAuth` 这类 Gateway 设置都默认你控制运行环境。
如果要暴露到公网，请额外放在更强的认证和访问控制之后。

## 许可证

[MIT](./LICENSE)
