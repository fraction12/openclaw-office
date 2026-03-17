# OpenClaw Office — Agent 开发指南

> [English](./AGENTS.md)

本文档为在当前 OpenClaw Office 仓库中工作的 AI 编码助手提供上下文。

## 项目概述

OpenClaw Office 是 [OpenClaw](https://github.com/openclaw/openclaw)
的可视化监控与管理前端。它通过 WebSocket 连接 OpenClaw Gateway，
将 Agent 的可观测信号整理为证据，再派生为：

- `/` 的办公室视图
- 底部的聊天 Dock
- `/dashboard`、`/agents`、`/channels`、`/skills`、`/cron`、`/settings` 控制台

## 当前技术栈

| 领域 | 技术 |
| --- | --- |
| 语言 | TypeScript、ESM、strict mode |
| UI | React 19 |
| 构建 | Vite 6 |
| 路由 | React Router 7，使用 `HashRouter` |
| 状态管理 | Zustand 5 + Immer |
| 样式 | Tailwind CSS 4 |
| 2D 渲染 | 当前主办公室使用 Pixi.js，仓库中仍保留旧 SVG 办公室组件 |
| 3D 渲染 | React Three Fiber + drei + postprocessing |
| 图表 | Recharts |
| i18n | i18next + react-i18next |
| 测试 | Vitest + Testing Library |
| 实时通信 | 原生 WebSocket API |

## 仓库中实际存在的内容

### Office 视图

- `src/pixi/` 是当前启用的 2D 办公室引擎与渲染器
- `src/components/office-3d/` 是可切换的 3D 场景
- `src/components/office-2d/` 仍保留较早的 SVG 办公室组件与头像实现
- `src/components/panels/` 包含指标、时间轴、子 Agent、Agent 详情等面板

### 控制台

- Dashboard、agents、channels、skills、cron、settings 都有独立的页面、store 和组件分组
- Skills 页面既管理本地已安装技能，也能浏览和搜索只读的 ClawHub 数据
- Settings 包含 provider 管理、模型编辑、gateway、appearance、developer、advanced、about、update 等区域

### Gateway 集成

- `src/gateway/ws-client.ts` 负责 socket 生命周期、challenge/connect 认证、重连和 shutdown 处理
- `src/gateway/rpc-client.ts` 封装同一条 socket 上的 RPC
- `src/gateway/ws-adapter.ts` 把 Gateway 能力暴露为统一 adapter 接口
- `src/gateway/adapter-provider.ts` 在真实 adapter 和 mock adapter 之间切换
- `src/gateway/clawhub-client.ts` 是独立的 ClawHub REST 客户端

### 状态流水线

需要优先理解的核心架构：

```text
Gateway frames / RPC
  -> event-parser
  -> evidence-store
  -> state-deriver
  -> event-orchestrator
  -> Zustand slices
  -> Pixi / React / R3F
```

关键文件：

- `src/gateway/event-parser.ts`
- `src/store/evidence-store.ts`
- `src/lib/state-deriver.ts`
- `src/store/event-orchestrator.ts`
- `src/store/index.ts`

如果你在排查 Agent 可见状态为什么不对，先看这些文件，再决定是否修改渲染层。

## 目录说明

```text
src/
├── App.tsx, main.tsx            # 启动、路由、连接初始化
├── gateway/                     # ws/rpc client、adapter、协议类型、ClawHub client
├── store/                       # store slices、evidence、telemetry、事件编排
├── pixi/                        # 当前主 2D 办公室引擎
├── components/
│   ├── office-2d/               # 旧 SVG 办公室 UI
│   ├── office-3d/               # R3F 场景
│   ├── panels/                  # 办公室侧栏面板
│   ├── chat/                    # 聊天 Dock
│   ├── console/                 # 控制台功能组件
│   ├── pages/                   # 路由页面
│   ├── layout/                  # Shell 和导航
│   └── shared/                  # 通用 UI
├── hooks/                       # gateway、轮询、ambient、响应式 hooks
├── lib/                         # 派生逻辑、持久化、视图辅助
└── i18n/                        # 中英文翻译
```

## 开发命令

```bash
pnpm install
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

- 标准工作流使用 `pnpm`
- 如果环境里没有 `pnpm`，但依赖已经安装，`npm run <script>` 也可以执行脚本
- `lint` 和 `format` 依赖 `oxlint`、`oxfmt` 二进制在 `PATH` 中可用

## Gateway 行为

### 连接模型

- 浏览器始终连接同源 `/gateway-ws`
- 开发模式下由 Vite 代理到上游 Gateway
- 打包后的 Node 服务也会代理这个路径
- UI 可在本地 Gateway 和远程 Gateway 模式间切换，而无需修改浏览器侧代码

### 认证流程

1. WebSocket 建立连接
2. Gateway 发送 `connect.challenge`
3. UI 发送 `connect`，包含 `client.id = openclaw-control-ui`、scopes 和 token
4. Gateway 返回 `hello-ok`

### 常见事件与 RPC

主要实时事件：

- `agent`
- `chat`
- `presence`
- `health`
- `heartbeat`
- `cron`
- `shutdown`

应用中常见的 RPC：

- `agents.list`
- `sessions.list`
- `sessions.preview`
- `sessions.delete`
- `usage.status`
- `tools.catalog`
- `chat.send`
- `chat.abort`
- `chat.history`
- `cron.list`
- `config.get`

## Store 与状态规则

- 把 evidence 和 derivation 视为真相来源。不要只在展示组件里偷偷编码新的状态规则。
- `useGatewayConnection` 会从多个 fallback 数据源引导 agent 列表。除非能证明某个来源已经过时，否则不要随便删。
- `event-orchestrator` 负责 run/session 映射、子 Agent 出现与消失、事件历史更新。
- `office-ui-store`、`agent-entity-store`、`spatial-store`、`collaboration-store`、`telemetry-store` 会被组合为一个 Zustand store。

## i18n 规则

所有用户可见文本都应该经过 i18n。

- React 组件：`useTranslation(namespace)`
- 非 React 文件：`import i18n from "@/i18n"; i18n.t("ns:key")`
- 中英文 locale JSON 必须保持 key 结构一致
- 技术标识符、import 路径、CSS class 名不要翻译

当前命名空间：

- `common`
- `layout`
- `office`
- `panels`
- `chat`
- `console`

## 质量要求

在这个仓库里，实际应遵守的是这些规则：

- 保持 TypeScript strict。避免新增 `any`；如果你碰到了现有 `any`，优先做顺手的缩减。
- 新文件尽量控制在约 500 行以内，但优先保证边界清晰，不要为了凑数字制造无意义拆分。
- 注释只写非显而易见的逻辑。
- 保护 evidence-first 的状态模型。
- 优先扩展已有 slice 和 helper，不要在组件里复制一套状态逻辑。
- 所有用户可见字符串保持在 i18n 中。

当前仓库的现实情况：

- 已经存在一些超长文件和少量 `any` 逃逸写法
- 不要无故继续扩大这类漂移
- 如果你正好修改到这些区域，优先做增量清理，而不是在未授权时做大范围重构

## 测试期望

- 修改派生逻辑、事件解析、store 编排时，应补充或更新 `tests/` 下的单元测试
- 修改关键 UI 流程时，应在可行范围内补充 Testing Library 覆盖
- 有明显行为改动后，执行 `npm test` 或 `pnpm test`
- 如果当前环境没有 lint/format 所需工具，要明确说明

## OpenClaw 上游参考文件

协议与类型仍以 OpenClaw 主仓库为准。常用参考文件：

- `src/infra/agent-events.ts`
- `src/gateway/protocol/schema/frames.ts`
- `src/gateway/server/ws-connection.ts`
- `src/gateway/server-methods-list.ts`
- `src/config/types.agents.ts`
