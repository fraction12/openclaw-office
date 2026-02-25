## ADDED Requirements

### Requirement: RPC 请求/响应封装

系统 SHALL 提供类型安全的 RPC 请求方法，通过 WebSocket 向 Gateway 发送请求并等待响应。

#### Scenario: 成功的 RPC 调用

- **WHEN** 调用 `rpc.request("agents.list", {})`
- **THEN** 系统 SHALL 发送 `{ type: "req", id: <uuid>, method: "agents.list", params: {} }`，收到匹配 id 的 `{ type: "res", ok: true, payload }` 后返回 `payload`

#### Scenario: RPC 调用失败

- **WHEN** Gateway 返回 `{ type: "res", id, ok: false, error: { code, message } }`
- **THEN** 系统 SHALL reject Promise，错误对象包含 `code` 和 `message`

#### Scenario: RPC 调用超时

- **WHEN** 请求发出后 10 秒内未收到响应
- **THEN** 系统 SHALL reject Promise，错误码为 `"TIMEOUT"`，message 为 "RPC request timed out: {method}"

#### Scenario: 连接断开时调用 RPC

- **WHEN** WebSocket 未连接时调用 RPC
- **THEN** 系统 SHALL 立即 reject Promise，错误码为 `"NOT_CONNECTED"`

### Requirement: 初始化数据拉取

系统 SHALL 在连接成功后通过 RPC 拉取初始化所需的数据。

#### Scenario: 连接成功后拉取 Agent 列表

- **WHEN** WebSocket 认证成功
- **THEN** 系统 SHALL 调用 `agents.list` 获取 Agent 配置列表，结果格式为 `{ defaultId, mainKey, scope, agents: AgentSummary[] }`，每个 Agent 初始化为 `status: "idle"` 的 VisualAgent

#### Scenario: 连接成功后拉取工具目录

- **WHEN** WebSocket 认证成功
- **THEN** 系统 SHALL 调用 `tools.catalog` 获取可用工具列表，用于后续 tool_calling 状态的工具名称显示

#### Scenario: 连接成功后拉取用量统计

- **WHEN** WebSocket 认证成功
- **THEN** 系统 SHALL 调用 `usage.status` 获取全局用量数据，更新 globalMetrics
