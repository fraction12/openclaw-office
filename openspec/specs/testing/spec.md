# testing Specification

## Purpose
TBD - created by archiving change phase-1-foundation. Update Purpose after archive.
## Requirements
### Requirement: 测试基础设施配置

系统 SHALL 配置完整的测试环境，支持单元测试和组件测试。

#### Scenario: Vitest 环境就绪

- **WHEN** 执行 `pnpm test`
- **THEN** Vitest SHALL 正常运行，使用 jsdom 环境，支持 TypeScript，路径别名 `@/` 正确解析

#### Scenario: testing-library 可用

- **WHEN** 编写 React 组件测试
- **THEN** `@testing-library/react` 和 `@testing-library/jest-dom` SHALL 正常工作，提供 render / screen / fireEvent / waitFor 等测试工具

### Requirement: event-parser 单元测试

系统 SHALL 为 event-parser 模块提供完整的单元测试覆盖。

#### Scenario: 覆盖所有 stream 类型

- **WHEN** 运行 event-parser 测试套件
- **THEN** SHALL 覆盖：lifecycle（start/end/thinking/fallback）、tool（start/end）、assistant、error 四种 stream 的解析逻辑，每种至少一个测试用例

#### Scenario: 边界情况测试

- **WHEN** 运行 event-parser 测试套件
- **THEN** SHALL 覆盖：未知 stream 类型的处理、data 字段缺失的处理、未知 runId 的处理

### Requirement: office-store 单元测试

系统 SHALL 为 Zustand store 提供状态转换的单元测试。

#### Scenario: Agent 状态转换测试

- **WHEN** 运行 office-store 测试套件
- **THEN** SHALL 验证：从 idle → thinking → tool_calling → speaking → idle 的完整生命周期状态转换、error 事件的状态更新、Agent 选中/取消选中逻辑

#### Scenario: 全局指标聚合测试

- **WHEN** 运行 office-store 测试套件
- **THEN** SHALL 验证：activeAgents 计数正确、Agent 列表初始化正确

#### Scenario: 事件批处理测试

- **WHEN** 运行 event-throttle 测试套件
- **THEN** SHALL 验证：批量事件被正确缓存和刷新、高优先级事件立即处理、队列溢出保护机制

### Requirement: WebSocket 客户端集成测试

系统 SHALL 为 WebSocket 客户端提供使用 mock WebSocket 的集成测试。

#### Scenario: 认证流程测试

- **WHEN** 运行 ws-client 测试套件
- **THEN** SHALL 验证：收到 challenge 后自动发送 connect 请求、connect 请求参数格式正确、成功响应后状态更新为 connected

#### Scenario: 重连逻辑测试

- **WHEN** 运行 ws-client 测试套件
- **THEN** SHALL 验证：断线后触发重连、重连延迟符合指数退避策略、重连成功后状态恢复

#### Scenario: RPC 请求/响应测试

- **WHEN** 运行 rpc-client 测试套件
- **THEN** SHALL 验证：请求正确发送、响应正确匹配、超时处理正确、未连接时立即拒绝

### Requirement: 关键组件交互测试

系统 SHALL 为关键 UI 组件提供交互测试。

#### Scenario: AgentDot 交互测试

- **WHEN** 运行 AgentDot 组件测试
- **THEN** SHALL 验证：圆点渲染正确颜色、点击触发选中、悬停显示 tooltip

#### Scenario: Sidebar 搜索过滤测试

- **WHEN** 运行 Sidebar 组件测试
- **THEN** SHALL 验证：搜索框输入过滤 Agent 列表、状态标签过滤正确

#### Scenario: position-allocator 测试

- **WHEN** 运行 position-allocator 测试套件
- **THEN** SHALL 验证：同一 agentId 分配相同位置（确定性）、不同 agentId 不会分配到相同位置（无碰撞）、溢出时分配到 Hot Desk Zone

