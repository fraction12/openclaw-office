# event-processing Specification

## Purpose
TBD - created by archiving change phase-1-foundation. Update Purpose after archive.
## Requirements
### Requirement: Agent 事件解析

系统 SHALL 将 Gateway 广播的 Agent 事件帧解析为结构化的 AgentEventPayload，并推断对应的可视化状态。

#### Scenario: 解析 lifecycle start 事件

- **WHEN** 收到 `{ stream: "lifecycle", data: { phase: "start" } }`
- **THEN** 系统 SHALL 将 Agent 状态映射为 `"thinking"`

#### Scenario: 解析 lifecycle thinking 事件

- **WHEN** 收到 `{ stream: "lifecycle", data: { phase: "thinking" } }`
- **THEN** 系统 SHALL 将 Agent 状态映射为 `"thinking"`

#### Scenario: 解析 lifecycle end 事件

- **WHEN** 收到 `{ stream: "lifecycle", data: { phase: "end" } }`
- **THEN** 系统 SHALL 将 Agent 状态映射为 `"idle"`，清除 `currentTool` 和 `speechBubble`

#### Scenario: 解析 lifecycle fallback 事件

- **WHEN** 收到 `{ stream: "lifecycle", data: { phase: "fallback" } }`
- **THEN** 系统 SHALL 将 Agent 状态映射为 `"error"`

#### Scenario: 解析 tool start 事件

- **WHEN** 收到 `{ stream: "tool", data: { phase: "start", name: "browser_search", args: {...} } }`
- **THEN** 系统 SHALL 将 Agent 状态映射为 `"tool_calling"`，设置 `currentTool = { name: "browser_search", args }`，`toolCallCount` 递增

#### Scenario: 解析 tool end 事件

- **WHEN** 收到 `{ stream: "tool", data: { phase: "end", name: "browser_search" } }`
- **THEN** 系统 SHALL 清除 `currentTool`，将 Agent 状态映射回 `"thinking"`

#### Scenario: 解析 assistant 事件

- **WHEN** 收到 `{ stream: "assistant", data: { text: "根据搜索结果..." } }`
- **THEN** 系统 SHALL 将 Agent 状态映射为 `"speaking"`，设置 `speechBubble = { text, timestamp: ts }`

#### Scenario: 解析 error 事件

- **WHEN** 收到 `{ stream: "error", data: { message: "Rate limit exceeded" } }`
- **THEN** 系统 SHALL 将 Agent 状态映射为 `"error"`

#### Scenario: 收到未知 Agent 的事件

- **WHEN** 收到 runId 对应的 Agent 不在 store 中
- **THEN** 系统 SHALL 为该 runId 创建一个新的 VisualAgent（使用 runId 作为临时 id，标记为可能的 Sub-Agent），并正常处理事件

### Requirement: 事件批处理

系统 SHALL 对高频 WebSocket 事件进行批处理，避免 UI 渲染抖动。

#### Scenario: 正常频率事件批处理

- **WHEN** 在一个 requestAnimationFrame 周期内收到多条事件
- **THEN** 系统 SHALL 收集所有事件，在下一个 RAF 回调中批量更新 Zustand store

#### Scenario: 高优先级事件立即处理

- **WHEN** 收到 `stream: "lifecycle"` 且 `phase: "start"` 或 `phase: "end"` 的事件，或 `stream: "error"` 事件
- **THEN** 系统 SHALL 立即处理该事件，不等待批处理周期

#### Scenario: 事件队列溢出保护

- **WHEN** 事件队列积压超过 500 条
- **THEN** 系统 SHALL 丢弃队列中最旧的非高优先级事件，保留最新 200 条，并在控制台输出警告

### Requirement: runId 到 Agent 的映射

系统 SHALL 维护 runId 到 agentId 的映射关系，确保事件路由到正确的 VisualAgent。

#### Scenario: 通过 sessionKey 建立映射

- **WHEN** 收到带有 `sessionKey` 的事件，且 sessionKey 可关联到已知 Agent
- **THEN** 系统 SHALL 将该 runId 映射到对应的 Agent

#### Scenario: 新 runId 的事件

- **WHEN** 收到未知 runId 的 lifecycle start 事件
- **THEN** 系统 SHALL 创建新的 runId 映射，如果 sessionKey 匹配已知 Agent 则关联，否则创建临时 VisualAgent

