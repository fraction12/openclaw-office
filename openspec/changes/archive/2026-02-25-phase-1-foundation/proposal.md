## Why

OpenClaw Office 作为 Multi-Agent 系统的可视化监控前端，需要首先建立"Gateway → 前端"的完整实时数据链路，并用 2D SVG 平面图展示 Agent 工作状态。这是整个项目的最小可用产品（MVP）——Phase 1 交付后，管理员即可通过浏览器实时观察所有 Agent 的生命周期、工具调用、文本输出和错误状态。当前项目仅有骨架代码（App.tsx / main.tsx），所有核心功能均未实现，需要从零打通 WebSocket 连接、状态管理和可视化渲染三大链路。

## What Changes

- **新增 Gateway 通信层**：实现 WebSocket 客户端，完成 challenge → connect 认证握手（协议版本 3）、自动重连（指数退避）、RPC 请求封装、事件解析分发
- **新增 Zustand 状态管理**：定义 VisualAgent / OfficeStore 类型，实现事件到可视化状态的映射（lifecycle/tool/assistant/error 四种 stream）、事件批处理（100ms flush）、全局指标聚合
- **新增 2D SVG 办公室平面图**：绘制四区域（工位区/会议区/热工位区/休息区）平面图，Agent 以状态色彩编码圆点展示，支持位移动画、协作连线、对话气泡
- **新增面板系统**：Agent 列表侧栏（搜索+过滤）、Agent 详情面板、全局指标卡片、事件时间轴
- **新增 AppShell 布局**：顶栏（连接状态+全局指标）+ 可折叠侧栏 + 主渲染区的响应式布局
- **新增完整测试覆盖**：office-store 和 event-parser 的单元测试、关键组件的交互测试、WebSocket 客户端的集成测试

## Capabilities

### New Capabilities

- `gateway-connection`: WebSocket 连接管理——challenge/connect 认证、自动重连、连接状态追踪、心跳保活
- `rpc-client`: RPC 请求/响应封装——支持 agents.list / sessions.list / usage.status / tools.catalog 等方法调用
- `event-processing`: 事件解析与分发——解析 Agent 事件帧、将 stream+data 映射为 AgentVisualStatus、事件批处理与优先级队列
- `office-store`: Zustand 状态管理——VisualAgent CRUD、CollaborationLink 维护、全局指标聚合、UI 状态管理
- `floor-plan-2d`: 2D SVG 办公室平面图——四区域布局、Agent 圆点渲染、状态色彩编码、位移动画、协作连线
- `panel-system`: 面板系统——AppShell 布局、Agent 列表侧栏、Agent 详情面板、全局指标卡片、事件时间轴
- `testing`: 测试基础设施——Vitest 配置、store 单元测试、event-parser 单元测试、组件交互测试、WebSocket 集成测试

### Modified Capabilities

（无——本项目从零开始，无现有 spec 需要修改）

## Impact

- **代码范围**：新增约 30+ 个文件，覆盖 `src/gateway/`、`src/store/`、`src/components/`、`src/hooks/`、`src/lib/` 全部目录
- **依赖项**：需安装已声明的 npm 依赖（react / zustand / immer / react-markdown / recharts / tailwindcss 等），无需新增额外依赖
- **外部系统**：依赖 OpenClaw Gateway（ws://localhost:18789）的 WebSocket 接口，使用真实连接开发（非 Mock 模式）
- **Gateway 协议**：基于实际源码确认的协议版本 3（protocol=3），响应格式为 `{type:"res", ok:true, payload: HelloOk}`（而非文档中记录的 `connect.accepted` 事件），需要在实现中与真实行为对齐
- **认证**：需要 pairing token 完成 Gateway 认证，client.id 使用 `"webchat-ui"` 或注册新的客户端 ID，mode 使用 `"ui"`
