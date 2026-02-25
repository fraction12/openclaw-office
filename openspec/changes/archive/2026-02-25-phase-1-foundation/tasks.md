## 1. 项目脚手架与环境配置

- [x] 1.1 执行 `pnpm install` 安装所有依赖，验证无版本冲突
- [x] 1.2 创建 `src/styles/globals.css` 配置 Tailwind CSS 4（`@import "tailwindcss"`），验证 `bg-gray-950` 等类名生效
- [x] 1.3 创建 `.env.local` 配置文件，声明 `VITE_GATEWAY_URL` 和 `VITE_GATEWAY_TOKEN` 环境变量
- [x] 1.4 创建 `src/vite-env.d.ts` 声明 ImportMetaEnv 类型（VITE_GATEWAY_URL / VITE_GATEWAY_TOKEN）
- [x] 1.5 创建目录结构：`src/gateway/`、`src/store/`、`src/components/layout/`、`src/components/office-2d/`、`src/components/overlays/`、`src/components/panels/`、`src/components/shared/`、`src/hooks/`、`src/lib/`
- [x] 1.6 配置 Vitest：创建 `vitest.config.ts`，设置 jsdom 环境、路径别名、setupFiles（引入 @testing-library/jest-dom）
- [x] 1.7 创建 `tests/setup.ts` 引入 `@testing-library/jest-dom`
- [x] 1.8 验证 `pnpm dev` 启动后浏览器可访问 `http://localhost:5180`
- [x] 1.9 验证 `pnpm test` 可正常运行（空测试通过）

## 2. Gateway 协议类型定义

- [x] 2.1 创建 `src/gateway/types.ts`，定义 GatewayRequest、GatewayResponseFrame（ok/error 格式）、GatewayEventFrame 类型
- [x] 2.2 定义 ConnectParams 类型（minProtocol/maxProtocol/client/caps/auth），严格对齐 Gateway 源码
- [x] 2.3 定义 HelloOk 类型（type/protocol/server/features/snapshot/policy）
- [x] 2.4 定义 AgentEventPayload 类型（runId/seq/stream/ts/data/sessionKey）
- [x] 2.5 定义 AgentVisualStatus 联合类型（idle/thinking/tool_calling/speaking/spawning/error/offline）
- [x] 2.6 定义 VisualAgent / CollaborationLink / OfficeStore / GlobalMetrics 类型
- [x] 2.7 定义 ErrorShape 类型（code: string / message: string / retryable? / retryAfterMs?）
- [x] 2.8 定义 AgentSummary 类型（id / name / identity?），对齐 agents.list RPC 响应

## 3. WebSocket 客户端实现

- [x] 3.1 创建 `src/gateway/ws-client.ts`，实现 GatewayWsClient 类，包含 connect(url, token) 方法
- [x] 3.2 实现 challenge → connect 认证握手：监听 `connect.challenge` 事件，自动发送 connect 请求（client.id="webchat-ui", mode="ui", caps=["tool-events"]）
- [x] 3.3 实现认证成功处理：解析 HelloOk 响应（ok=true），更新连接状态，缓存 snapshot 数据
- [x] 3.4 实现认证失败处理：解析 error 响应（ok=false），更新连接状态为 error
- [x] 3.5 实现自动重连：指数退避 `min(1000 * 2^attempt, 30000) + random(0, 1000)` 毫秒，最大 20 次
- [x] 3.6 实现事件分发：收到 event 帧后根据 event 名称路由到注册的回调函数
- [x] 3.7 实现连接状态管理：维护 connecting/connected/reconnecting/disconnected/error 状态枚举，提供 onStatusChange 回调
- [x] 3.8 实现 shutdown 事件处理：收到 shutdown 事件时停止自动重连

## 4. RPC 客户端实现

- [x] 4.1 创建 `src/gateway/rpc-client.ts`，实现 `request<T>(method, params): Promise<T>` 方法
- [x] 4.2 实现请求 ID 生成（crypto.randomUUID）和响应匹配（通过 id 字段关联 req/res）
- [x] 4.3 实现超时处理：默认 10 秒超时，reject 错误码 TIMEOUT
- [x] 4.4 实现未连接检查：ws 未连接时立即 reject 错误码 NOT_CONNECTED
- [x] 4.5 实现错误响应处理：ok=false 时 reject 包含 code 和 message 的错误

## 5. 事件解析器实现

- [x] 5.1 创建 `src/gateway/event-parser.ts`，实现 parseAgentEvent 函数，输入 GatewayEventFrame 输出 AgentVisualStatus
- [x] 5.2 实现 lifecycle stream 解析：phase=start→thinking, phase=thinking→thinking, phase=end→idle, phase=fallback→error
- [x] 5.3 实现 tool stream 解析：phase=start→tool_calling（提取 name/args），phase=end→thinking（清除 currentTool）
- [x] 5.4 实现 assistant stream 解析：提取 text 字段，状态→speaking
- [x] 5.5 实现 error stream 解析：提取 message 字段，状态→error
- [x] 5.6 实现 runId → Agent 映射逻辑：通过 sessionKey 关联已知 Agent，未知 runId 创建临时 VisualAgent

## 6. Zustand Store 实现

- [x] 6.1 创建 `src/store/office-store.ts`，使用 `create<OfficeStore>()(immer(...))` 创建主 store
- [x] 6.2 实现 agents Map 的 CRUD 操作：addAgent / updateAgent / removeAgent
- [x] 6.3 实现 `processAgentEvent(event)` action，调用 event-parser 解析事件后更新对应 Agent 状态
- [x] 6.4 实现 selectAgent / setViewMode / setConnectionStatus 等 UI action
- [x] 6.5 创建 `src/store/agent-reducer.ts`，封装事件到 Agent 状态的映射逻辑（从 processAgentEvent 调用）
- [x] 6.6 创建 `src/store/metrics-reducer.ts`，实现 globalMetrics 聚合：activeAgents 计数、totalTokens 累加
- [x] 6.7 实现 CollaborationLink 维护：基于 sessionKey 建立/更新/衰减/移除协作链接
- [x] 6.8 实现事件历史记录：维护最近 200 条事件摘要的队列

## 7. 事件批处理实现

- [x] 7.1 创建 `src/lib/event-throttle.ts`，实现 EventThrottle 类
- [x] 7.2 实现事件队列：push(event) 将事件加入队列
- [x] 7.3 实现 RAF 批量刷新：每个 requestAnimationFrame 回调中批量提交队列到 store
- [x] 7.4 实现高优先级通道：lifecycle start/end 和 error 事件绕过队列立即处理
- [x] 7.5 实现队列溢出保护：超过 500 条时丢弃旧事件保留最新 200 条

## 8. useGatewayConnection Hook

- [x] 8.1 创建 `src/hooks/useGatewayConnection.ts`，封装 WsClient + RpcClient 的初始化和生命周期
- [x] 8.2 实现自动连接：组件挂载时读取环境变量 URL 和 token，初始化 WebSocket 连接
- [x] 8.3 实现事件桥接：将 ws-client 的事件回调绑定到 EventThrottle → store.processAgentEvent 链路
- [x] 8.4 实现初始化数据拉取：连接成功后调用 agents.list / tools.catalog / usage.status
- [x] 8.5 实现组件卸载时的资源清理：关闭 WebSocket 连接，清除定时器

## 9. 工位分配与常量定义

- [x] 9.1 创建 `src/lib/constants.ts`，定义四个区域的坐标范围（Desk Zone / Meeting Zone / Hot Desk Zone / Lounge Zone）
- [x] 9.2 定义状态颜色映射：idle=#22c55e, thinking=#3b82f6, tool_calling=#f97316, speaking=#a855f7, error=#ef4444, offline=#6b7280
- [x] 9.3 创建 `src/lib/position-allocator.ts`，实现 allocatePosition(agentId, isSubAgent, occupied) 函数
- [x] 9.4 实现 Desk Zone 确定性 hash 分配：基于 agentId 的 hash 值选取预设网格位置
- [x] 9.5 实现 Hot Desk Zone 顺序分配：未知 Agent 按到达顺序分配空闲位
- [x] 9.6 实现溢出处理：Desk Zone 满时溢出到 Hot Desk Zone

## 10. Avatar 生成器

- [x] 10.1 创建 `src/lib/avatar-generator.ts`，实现 generateAvatar(agentId) 函数
- [x] 10.2 实现 12 色调色板和确定性 hash 选色
- [x] 10.3 实现首字母提取（从 Agent name 或 id 提取）
- [x] 10.4 实现文字颜色自动选择（基于背景色亮度选黑/白）

## 11. AppShell 布局组件

- [x] 11.1 创建 `src/components/layout/AppShell.tsx`，实现顶栏(48px) + 主区域 + 侧栏(320px) 三栏布局
- [x] 11.2 创建 `src/components/layout/TopBar.tsx`，实现 Logo + 标题 + 版本号 + 全局指标摘要 + 连接状态指示器
- [x] 11.3 实现连接状态指示器：不同状态显示不同颜色圆点 + 文字描述
- [x] 11.4 实现 Token 输入框：环境变量未设置时在 TopBar 显示输入框
- [x] 11.5 实现侧栏折叠/展开功能（折叠为 48px 图标栏）
- [x] 11.6 更新 `App.tsx`，引入 AppShell + useGatewayConnection hook

## 12. 2D SVG 平面图组件

- [x] 12.1 创建 `src/components/office-2d/FloorPlan.tsx`，实现 SVG 平面图容器（viewBox="0 0 1200 700"）
- [x] 12.2 实现四区域渲染：不同底色的 rect + 区域名称 text 标签
- [x] 12.3 创建 `src/components/office-2d/AgentDot.tsx`，实现状态色彩编码圆点（直径 24px，选中 30px + 高亮环）
- [x] 12.4 实现 AgentDot 的 CSS transition 颜色过渡（duration 400ms）
- [x] 12.5 实现 AgentDot 悬停 tooltip（Agent 名称 + 状态）
- [x] 12.6 实现 AgentDot 点击选中（调用 store.selectAgent）
- [x] 12.7 创建 `src/components/office-2d/ConnectionLine.tsx`，实现虚线连线（stroke-dasharray: "6,4"）+ 透明度控制 + dash-offset 动画
- [x] 12.8 创建 `src/components/office-2d/ZoneLabel.tsx`，实现区域标签组件

## 13. 对话气泡组件

- [x] 13.1 创建 `src/components/overlays/SpeechBubble.tsx`，实现 HTML overlay 气泡，定位在 Agent 圆点上方
- [x] 13.2 集成 react-markdown 渲染 speechBubble.text 内容
- [x] 13.3 实现气泡最大宽度 280px，超出滚动
- [x] 13.4 实现气泡自动淡出：Agent 离开 speaking 状态 5 秒后 opacity 1→0（duration 500ms）
- [x] 13.5 实现气泡指向箭头（小三角指向 Agent 圆点）

## 14. 面板组件实现

- [x] 14.1 创建 `src/components/layout/Sidebar.tsx`，实现 Agent 列表 + 搜索框 + 状态过滤标签（All/Active/Idle/Error）
- [x] 14.2 实现搜索框实时过滤（不区分大小写的名称匹配）
- [x] 14.3 实现状态过滤标签切换
- [x] 14.4 实现 Agent 卡片列表：Avatar + 名称 + 状态标签 + 最后活跃时间
- [x] 14.5 创建 `src/components/panels/AgentDetailPanel.tsx`，实现选中 Agent 的详情展示
- [x] 14.6 实现详情面板内容：Avatar + 名称 + 状态、当前工具信息、最近对话内容（Markdown 渲染）、工具调用历史（最近 10 次）
- [x] 14.7 创建 `src/components/panels/MetricsPanel.tsx`，实现四个指标卡片（Active Agents / Total Tokens / Collaboration Heat / Token Rate）
- [x] 14.8 创建 `src/components/panels/EventTimeline.tsx`，实现事件时间轴（最近 50 条）
- [x] 14.9 实现时间轴自动滚动 + 手动滚动检测 + "新事件"提示按钮
- [x] 14.10 创建 `src/components/shared/Avatar.tsx`，实现确定性首字母圆形头像

## 15. 单元测试

- [x] 15.1 创建 `src/gateway/__tests__/event-parser.test.ts`，测试所有 stream 类型的解析
- [x] 15.2 测试 event-parser 边界情况：未知 stream、缺失 data 字段、未知 runId
- [x] 15.3 创建 `src/store/__tests__/office-store.test.ts`，测试 Agent 状态转换完整生命周期
- [x] 15.4 测试 office-store 全局指标聚合：activeAgents 计数、Agent 列表初始化
- [x] 15.5 测试 office-store 的 selectAgent / 事件历史记录
- [x] 15.6 创建 `src/lib/__tests__/event-throttle.test.ts`，测试批量事件缓存和刷新、高优先级立即处理、队列溢出保护
- [x] 15.7 创建 `src/lib/__tests__/position-allocator.test.ts`，测试确定性分配、无碰撞、溢出处理

## 16. 集成测试

- [x] 16.1 创建 `src/gateway/__tests__/ws-client.test.ts`，使用 mock WebSocket 测试认证握手流程
- [x] 16.2 测试 ws-client 重连逻辑：断线触发重连、指数退避延迟、重连成功后状态恢复
- [x] 16.3 创建 `src/gateway/__tests__/rpc-client.test.ts`，测试请求/响应匹配、超时处理、未连接拒绝

## 17. 组件交互测试

- [x] 17.1 创建 `src/components/office-2d/__tests__/AgentDot.test.tsx`，测试颜色渲染、点击选中、悬停 tooltip
- [x] 17.2 创建 `src/components/layout/__tests__/Sidebar.test.tsx`，测试搜索过滤、状态标签过滤
- [x] 17.3 创建 `src/components/panels/__tests__/MetricsPanel.test.tsx`，测试指标数据展示

## 18. 端到端验证

- [x] 18.1 启动 `pnpm dev`，验证页面渲染 AppShell 布局
- [x] 18.2 验证 WebSocket 连接 Gateway 成功，TopBar 显示"已连接"
- [x] 18.3 验证 Agent 列表从 agents.list RPC 加载并显示在侧栏和平面图
- [x] 18.4 触发 Agent 运行，验证平面图上圆点颜色实时变化
- [x] 18.5 验证 speaking 状态的 Agent 显示 Markdown 气泡
- [x] 18.6 验证事件时间轴实时更新
- [x] 18.7 验证全局指标卡片数据正确
- [x] 18.8 断开 Gateway 验证重连逻辑和 TopBar 状态变化
- [x] 18.9 执行 `pnpm test` 确认所有测试通过
- [x] 18.10 执行 `pnpm typecheck` 确认无类型错误
- [x] 18.11 执行 `pnpm check` 确认 lint + format 通过
