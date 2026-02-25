## Context

OpenClaw Office 项目已完成初始脚手架：Vite 6 + React 19 + TypeScript + Tailwind CSS 4 配置就绪，`package.json` 已声明核心依赖（zustand / immer / react-markdown / recharts），但尚未 `pnpm install`。目前仅有骨架 `App.tsx` 和 `main.tsx`，所有功能模块（gateway/store/components/hooks/lib）均为空目录。

主机上已运行 OpenClaw Gateway（ws://localhost:18789），可直接进行真实连接开发。通过源码审查确认 Gateway 使用协议版本 3（PROTOCOL_VERSION = 3），认证成功后返回 `{ type: "res", ok: true, payload: HelloOk }` 格式，而非文档中描述的 `connect.accepted` 事件。

关键约束：
- Gateway 认证需要 pairing token，client.id 需使用已注册值（如 `"webchat-ui"`），mode 使用 `"ui"`
- Gateway res 帧使用 `ok: boolean` 而非 `result/error` 二选一
- Agent 事件通过 `event: "agent"` 广播，payload 为 AgentEventPayload
- 首次连接后 HelloOk 包含 snapshot（presence/health/sessionDefaults），可用于初始化

## Goals / Non-Goals

**Goals:**

1. 建立可靠的 Gateway WebSocket 连接层，支持认证、重连、RPC、事件分发
2. 实现 Zustand 状态管理，将实时 Agent 事件映射为可视化状态
3. 用 2D SVG 平面图实时展示 Agent 状态、协作关系和对话内容
4. 搭建面板系统提供搜索、过滤、详情、指标和事件时间轴
5. 为 store 和 event-parser 建立完整单元测试，为关键组件建立交互测试
6. 基于真实 Gateway 连接开发，确保协议兼容性

**Non-Goals:**

- 不实现 3D/R3F 渲染（Phase 2 范围）
- 不实现 Sub-Agent 生命周期可视化（Phase 2 范围）
- 不实现 Force Action 干预操作（Phase 3 范围）
- 不实现 Mock 模式——基于真实 Gateway 开发，如需开发时 Gateway 不可用，后续可补充
- 不实现 GLTF 模型加载、后处理特效
- 不做移动端适配（Phase 3）

## Decisions

### D1: Gateway 认证方式——使用 `webchat-ui` 客户端 ID + `ui` 模式

**决策**：客户端连接参数使用 `client.id = "webchat-ui"`、`client.mode = "ui"`、`caps = ["tool-events"]`。

**理由**：
- Gateway 源码中 `GatewayClientId` 枚举已注册 `"webchat-ui"`，无需修改 Gateway 即可使用
- `"ui"` 模式是 Gateway 已支持的客户端模式，适合可视化监控场景
- 请求 `"tool-events"` capability 以接收工具调用的详细事件

**备选考虑**：
- 自定义新 ID（如 `"office-viz"`）：需要修改 Gateway 源码注册，增加不必要的耦合
- 使用 `"companion"` 模式：可行但语义不如 `"ui"` 精确

### D2: 认证 Token 管理——环境变量 + 连接 UI

**决策**：pairing token 通过 `VITE_GATEWAY_TOKEN` 环境变量配置，同时在 TopBar 提供输入框允许运行时输入/更新。

**理由**：
- 开发阶段通过 `.env.local` 文件配置 token，无需每次手动输入
- 运行时输入框支持部署后的首次配对场景
- Token 仅存于内存，刷新后清除，符合安全要求

### D3: WebSocket 响应帧适配——以实际源码为准

**决策**：响应帧类型定义为 `{ type: "res", id: string, ok: boolean, payload?: unknown, error?: ErrorShape }`，以 `ok` 布尔值判断成功/失败，而非之前文档中 result/error 二选一的格式。

**理由**：Gateway 源码审查确认实际使用 `ok` 字段，ErrorShape 使用 `{ code: string, message: string }` 而非 `{ code: number, message: string }`。与真实行为对齐可避免连接问题。

### D4: 事件处理架构——事件队列 + RAF 批量刷新

**决策**：WebSocket 事件先推入优先级队列，每个 requestAnimationFrame 周期（~16ms）批量提交到 Zustand store。lifecycle 和 error 事件标记为高优先级立即处理。

**理由**：
- 多 Agent 并发时事件可达 50-100+/秒，逐条更新会导致 React 重渲染风暴
- RAF 与浏览器渲染周期对齐，避免不必要的中间态渲染
- 高优先级通道确保关键状态变更（start/end/error）零延迟

**备选考虑**：
- 固定 100ms 定时器：简单但与渲染周期不对齐，可能产生撕裂感
- 每条事件直接 setState：简单但性能不可接受

### D5: 工位分配——确定性 hash + 预设坐标网格

**决策**：常驻 Agent 通过 `agentId` 的 hash 值确定性分配到 Desk Zone 预设网格坐标。运行时新出现的 Agent 按到达顺序分配 Hot Desk Zone 空闲位。

**理由**：
- 确定性分配保证同一 Agent 每次刷新位置不变，便于用户形成空间记忆
- Hash 分配不依赖 Agent 创建顺序，新增/删除 Agent 不影响其他 Agent 位置
- 双区域设计为 Phase 2 的 Sub-Agent 动态分配预留空间

### D6: SVG ViewBox 与坐标系——固定 1200×700 视口

**决策**：FloorPlan SVG 使用 `viewBox="0 0 1200 700"` 固定坐标系，四个区域在此坐标系内静态定义。

**理由**：
- 固定坐标系使布局计算与窗口大小解耦，SVG 自动缩放适配容器
- 1200×700 的宽高比（12:7）适合大多数显示器
- 比 Phase 1 文档中的 1000×600 略大，为区域标签和间距留出更多空间

### D7: 状态管理层级——单一 Zustand store + selector 切片

**决策**：使用单一 `useOfficeStore` 作为顶层 store，通过 selector 函数切片订阅避免不必要重渲染。不拆分为多个 store。

**理由**：
- Agent 状态、连接状态、UI 状态之间有频繁交叉引用（如：连接断开时所有 Agent 标记 offline）
- 单一 store + immer 使跨切片的原子更新成为可能
- selector 切片（如 `useOfficeStore(s => s.agents.get(id))`）提供与多 store 相当的性能

### D8: 测试策略——分层测试 + 真实协议验证

**决策**：
- **单元测试**：office-store（状态转换）、event-parser（事件解析）、position-allocator（坐标计算）、event-throttle（批处理逻辑）
- **组件测试**：AgentDot（点击/悬停）、Sidebar（搜索/过滤）、MetricsPanel（数据展示）
- **集成测试**：ws-client 连接生命周期（使用 mock WebSocket）、RPC 请求/响应链路
- 不依赖真实 Gateway 运行测试——所有 WS 测试使用 mock/stub

**理由**：
- store 和 event-parser 是数据链路核心，必须高覆盖率保证正确性
- 组件测试聚焦关键交互路径，不追求全覆盖
- WS 集成测试验证认证流程和重连逻辑，但使用 mock 避免对外部依赖

## Risks / Trade-offs

**[R1] Gateway 认证参数不兼容** → 已通过源码审查确认协议细节，风险降低。仍需 Day 1 跑通真实连接验证。如遇问题，可查阅 Gateway 日志定位原因。

**[R2] 高频事件下 SVG 渲染性能** → Phase 1 使用 SVG 而非 Canvas/WebGL，100+ Agent 场景可能出现卡顿。缓解：事件批处理 + CSS transition 硬件加速 + 非可见区域跳过动画。Phase 2 升级 R3F 后可切换渲染后端。

**[R3] Token 值硬编码风险** → 开发阶段 token 存储在 `.env.local`（已在 .gitignore 中），不会意外提交。运行时 token 仅在内存中。

**[R4] Gateway HelloOk snapshot 数据格式** → HelloOk 中的 snapshot 包含 presence/health/sessionDefaults，具体字段需要运行时验证。如果字段与预期不符，降级为 RPC 逐个拉取初始数据。

**[R5] 断线重连期间事件丢失** → WebSocket 断线期间的事件不可恢复。重连后通过 RPC 拉取最新状态快照（agents.list + usage.status）来重建一致性。可能有短暂的状态不一致窗口。
