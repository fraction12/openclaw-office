# gateway-connection Specification

## Purpose
TBD - created by archiving change phase-1-foundation. Update Purpose after archive.
## Requirements
### Requirement: WebSocket 连接建立

系统 SHALL 通过原生 WebSocket API 连接 OpenClaw Gateway（默认地址 `ws://localhost:18789`）。连接地址 SHALL 通过 `VITE_GATEWAY_URL` 环境变量可配置。

#### Scenario: 正常连接并完成认证握手

- **WHEN** 用户打开页面，系统初始化 WebSocket 连接
- **THEN** 系统建立 WebSocket 连接，收到 `connect.challenge` 事件后自动发送 connect 请求，connect 请求参数 SHALL 包含 `{ minProtocol: 1, maxProtocol: 3, client: { id: "webchat-ui", version: "0.1.0", platform: "web", mode: "ui" }, caps: ["tool-events"] }`

#### Scenario: 认证成功

- **WHEN** Gateway 返回 `{ type: "res", ok: true, payload: { type: "hello-ok", ... } }`
- **THEN** 连接状态 SHALL 更新为 `"connected"`，store 使用 HelloOk.snapshot 中的 presence 和 sessionDefaults 初始化

#### Scenario: 认证失败

- **WHEN** Gateway 返回 `{ type: "res", ok: false, error: { code, message } }`
- **THEN** 连接状态 SHALL 更新为 `"error"`，错误信息 SHALL 在 TopBar 中展示

### Requirement: 自动重连

系统 SHALL 在 WebSocket 连接断开后自动尝试重连，使用指数退避策略。

#### Scenario: 正常断线后重连

- **WHEN** WebSocket 连接意外断开（非用户主动关闭）
- **THEN** 系统 SHALL 在延迟后自动重连，延迟时间为 `min(1000 * 2^attempt, 30000) + random(0, 1000)` 毫秒，连接状态 SHALL 更新为 `"reconnecting"`

#### Scenario: 重连成功后恢复状态

- **WHEN** 重连成功并完成认证
- **THEN** 系统 SHALL 通过 RPC 调用 `agents.list` 重新拉取 Agent 列表，重置重连计数器，连接状态更新为 `"connected"`

#### Scenario: 达到最大重连次数

- **WHEN** 连续重连失败达到 20 次
- **THEN** 系统 SHALL 停止自动重连，连接状态更新为 `"disconnected"`，TopBar 显示"连接失败，点击重试"

### Requirement: 连接状态追踪

系统 SHALL 维护并展示 WebSocket 连接的实时状态。

#### Scenario: 连接状态在 TopBar 中展示

- **WHEN** 连接状态发生变化
- **THEN** TopBar SHALL 显示对应状态指示器：`"connecting"` 显示黄色脉冲圆点 + "连接中..."、`"connected"` 显示绿色圆点 + "已连接"、`"reconnecting"` 显示橙色脉冲圆点 + "重连中(第N次)"、`"disconnected"` 显示灰色圆点 + "未连接"、`"error"` 显示红色圆点 + 错误信息

### Requirement: Token 认证配置

系统 SHALL 支持通过环境变量和运行时 UI 配置 pairing token。

#### Scenario: 通过环境变量配置 token

- **WHEN** `VITE_GATEWAY_TOKEN` 环境变量已设置
- **THEN** 系统 SHALL 使用该值作为 `auth.token` 发送认证请求

#### Scenario: 运行时输入 token

- **WHEN** 环境变量未设置且未连接成功
- **THEN** TopBar SHALL 显示 token 输入框，用户输入 token 后系统尝试使用该 token 连接

### Requirement: 事件分发

系统 SHALL 将收到的 Gateway 事件帧分发到 Zustand store。

#### Scenario: 收到 agent 事件

- **WHEN** 收到 `{ type: "event", event: "agent", payload: AgentEventPayload }`
- **THEN** 系统 SHALL 将 payload 推入事件队列，由事件处理模块异步处理

#### Scenario: 收到 presence 事件

- **WHEN** 收到 `{ type: "event", event: "presence", payload }`
- **THEN** 系统 SHALL 更新 store 中的 presence 数据

#### Scenario: 收到 shutdown 事件

- **WHEN** 收到 `{ type: "event", event: "shutdown", payload: { reason } }`
- **THEN** 系统 SHALL 停止自动重连，TopBar 显示 "Gateway 已关闭: {reason}"

