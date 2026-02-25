## ADDED Requirements

### Requirement: SVG 办公室平面图

系统 SHALL 渲染一个 SVG 办公室平面图，使用 `viewBox="0 0 1200 700"` 固定坐标系，包含四个可辨识的功能区域。

#### Scenario: 四区域布局渲染

- **WHEN** FloorPlan 组件加载
- **THEN** 系统 SHALL 渲染四个区域：Desk Zone（固定工位区，左上）、Meeting Zone（会议区，右上）、Hot Desk Zone（热工位区，左下）、Lounge Zone（休息区，右下），每个区域 SHALL 有不同的底色和文字标签标识

#### Scenario: 区域标签可读

- **WHEN** 平面图渲染完成
- **THEN** 每个区域 SHALL 显示中文区域名称（固定工位区 / 会议区 / 热工位区 / 休息区），标签使用半透明背景确保在不同底色上可读

### Requirement: Agent 圆点渲染

系统 SHALL 在平面图上为每个 VisualAgent 渲染一个状态色彩编码的圆点。

#### Scenario: 圆点位置由工位分配算法决定

- **WHEN** Agent 在 store 中被创建或更新
- **THEN** 圆点 SHALL 出现在 position-allocator 分配的坐标位置

#### Scenario: 圆点颜色反映 Agent 状态

- **WHEN** Agent 状态变更
- **THEN** 圆点颜色 SHALL 按以下映射变化：`idle=#22c55e`（绿）、`thinking=#3b82f6`（蓝）、`tool_calling=#f97316`（橙）、`speaking=#a855f7`（紫）、`error=#ef4444`（红）、`offline=#6b7280`（灰），颜色变化 SHALL 使用 CSS transition（duration 400ms）平滑过渡

#### Scenario: 圆点大小

- **WHEN** Agent 圆点渲染
- **THEN** 圆点直径 SHALL 为 24px（SVG 坐标系单位），选中的 Agent 圆点直径 SHALL 放大到 30px 并显示高亮环

#### Scenario: 悬停显示 Agent 名称

- **WHEN** 鼠标悬停在 Agent 圆点上
- **THEN** 系统 SHALL 显示 tooltip 包含 Agent 名称和当前状态

#### Scenario: 点击选中 Agent

- **WHEN** 用户点击 Agent 圆点
- **THEN** 系统 SHALL 调用 `selectAgent(agentId)`，选中的 Agent 圆点显示高亮边框，右侧面板展开 AgentDetailPanel

### Requirement: 工位分配算法

系统 SHALL 为每个 Agent 确定性地分配平面图上的坐标位置。

#### Scenario: 常驻 Agent 固定工位

- **WHEN** 从 `agents.list` 加载的 Agent（非 Sub-Agent）
- **THEN** 系统 SHALL 通过 agentId 的 hash 值在 Desk Zone 的预设网格中确定性分配位置，同一 agentId 每次计算结果相同

#### Scenario: 动态 Agent 热工位

- **WHEN** 运行时出现新 Agent（未在 agents.list 中，可能是 Sub-Agent 或新创建的 Agent）
- **THEN** 系统 SHALL 按顺序分配 Hot Desk Zone 的空闲位置

#### Scenario: 工位容量上限

- **WHEN** Desk Zone 已满（超过 12 个 Agent）
- **THEN** 溢出的 Agent SHALL 分配到 Hot Desk Zone

### Requirement: Agent 间协作连线

系统 SHALL 在有协作关系的 Agent 之间渲染可视连线。

#### Scenario: 连线样式

- **WHEN** store 中存在 CollaborationLink
- **THEN** 系统 SHALL 在两个 Agent 圆点之间渲染 SVG 虚线（`stroke-dasharray: "6,4"`），线条颜色透明度与 `strength` 成正比（strength=1 时完全不透明，strength=0.1 时 10% 透明度）

#### Scenario: 连线动画

- **WHEN** 连线渲染
- **THEN** 虚线 SHALL 有 dash-offset 循环动画，模拟数据流动方向

### Requirement: 对话气泡

系统 SHALL 在 speaking 状态的 Agent 上方显示对话气泡。

#### Scenario: 气泡内容渲染

- **WHEN** Agent 状态为 `"speaking"` 且 `speechBubble` 不为空
- **THEN** 系统 SHALL 在 Agent 圆点上方渲染气泡，使用 react-markdown 渲染 `speechBubble.text` 内容，气泡最大宽度 280px

#### Scenario: 气泡自动淡出

- **WHEN** Agent 状态从 `"speaking"` 变为其他状态后 5 秒
- **THEN** 气泡 SHALL 以淡出动画消失（opacity 1→0，duration 500ms）

#### Scenario: 气泡定位

- **WHEN** 气泡渲染
- **THEN** 气泡 SHALL 定位在 Agent 圆点上方 40px 处，使用 HTML overlay（position absolute）叠加在 SVG 上方，并有指向圆点的小三角箭头
