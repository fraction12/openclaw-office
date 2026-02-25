## ADDED Requirements

### Requirement: Agent 状态管理

系统 SHALL 使用 Zustand + Immer 管理所有 VisualAgent 的状态，支持高频增量更新。

#### Scenario: 初始化 Agent 列表

- **WHEN** 从 RPC `agents.list` 获取到 Agent 配置列表
- **THEN** 系统 SHALL 为每个 Agent 创建 VisualAgent 对象，初始状态为 `"idle"`，使用 `agent.identity.name` 或 `agent.name` 或 `agent.id` 作为显示名称，使用 agentId 生成确定性 avatar 颜色

#### Scenario: 处理 Agent 状态变更事件

- **WHEN** 事件处理模块推送状态变更
- **THEN** store SHALL 更新对应 VisualAgent 的 `status`、`currentTool`、`speechBubble`、`lastActiveAt` 等字段，且 MUST 使用 immer 确保不可变更新

#### Scenario: Agent 选中/取消选中

- **WHEN** 用户点击 Agent 圆点或列表项
- **THEN** `selectedAgentId` SHALL 更新为对应 id（再次点击同一 Agent 取消选中设为 null）

### Requirement: 全局指标聚合

系统 SHALL 实时聚合并维护全局指标数据。

#### Scenario: 活跃 Agent 计数

- **WHEN** 任何 Agent 状态变更
- **THEN** `globalMetrics.activeAgents` SHALL 等于当前 status 不为 `"idle"` 且不为 `"offline"` 的 Agent 数量

#### Scenario: Token 使用量统计

- **WHEN** 从 `usage.status` RPC 或 lifecycle end 事件获取到 token 数据
- **THEN** `globalMetrics.totalTokens` SHALL 累加更新

#### Scenario: Token 速率计算

- **WHEN** 每 5 秒定时计算
- **THEN** `globalMetrics.tokenRate` SHALL 等于最近 60 秒内的平均 tokens/秒

### Requirement: 协作关系维护

系统 SHALL 追踪 Agent 之间的协作关系。

#### Scenario: 建立协作连接

- **WHEN** 两个不同 Agent 的事件具有相同的 `sessionKey`，且在最近 30 秒内均有活动
- **THEN** 系统 SHALL 在 `links` 中创建或更新 CollaborationLink，`strength` 基于消息频率（0-1）

#### Scenario: 协作连接衰减

- **WHEN** 某个 CollaborationLink 的双方 Agent 超过 60 秒无新事件
- **THEN** 系统 SHALL 移除该 link

### Requirement: 连接状态同步

系统 SHALL 将 WebSocket 连接状态同步到 store。

#### Scenario: 连接断开时 Agent 状态处理

- **WHEN** WebSocket 连接断开
- **THEN** `connectionStatus` SHALL 更新为 `"disconnected"` 或 `"reconnecting"`，所有正在活动的 Agent（status 不为 idle）的状态 SHALL 保持不变（等待重连后恢复，而非立即标记 offline）

#### Scenario: 长时间断线后 Agent 状态

- **WHEN** 断线超过 30 秒仍未重连成功
- **THEN** 所有 Agent 的状态 SHALL 更新为 `"offline"`

### Requirement: 事件历史记录

系统 SHALL 维护最近的事件记录用于时间轴展示。

#### Scenario: 记录新事件

- **WHEN** 收到任何 Agent 事件
- **THEN** 系统 SHALL 将事件摘要追加到事件历史队列，包含 `{ timestamp, agentId, agentName, stream, summary }`

#### Scenario: 事件历史队列上限

- **WHEN** 事件历史队列长度超过 200 条
- **THEN** 系统 SHALL 移除最旧的事件，保持队列长度不超过 200 条
