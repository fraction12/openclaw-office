## ADDED Requirements

### Requirement: AppShell 布局

系统 SHALL 提供包含顶栏、侧栏和主区域的响应式布局。

#### Scenario: 布局结构

- **WHEN** 页面加载
- **THEN** 系统 SHALL 渲染三栏布局：顶栏（高度 48px，固定在顶部）、左侧主区域（渲染 FloorPlan）、右侧侧栏（宽度 320px，可折叠）

#### Scenario: 顶栏内容

- **WHEN** 顶栏渲染
- **THEN** SHALL 包含：左侧 Logo + "OpenClaw Office" 标题 + 版本号标签，中间全局指标摘要（Active Agents / Total Tokens），右侧连接状态指示器 + 设置按钮

#### Scenario: 侧栏折叠

- **WHEN** 用户点击侧栏折叠按钮
- **THEN** 侧栏 SHALL 平滑折叠为 48px 宽的图标栏，主区域扩展填满空间

### Requirement: Agent 列表侧栏

系统 SHALL 在右侧侧栏中显示所有 Agent 的列表，支持搜索和过滤。

#### Scenario: Agent 列表展示

- **WHEN** 侧栏展开
- **THEN** 系统 SHALL 显示所有 Agent 的卡片列表，每个卡片包含：Avatar（确定性首字母头像）、名称、状态标签（色彩编码）、最后活跃时间（相对时间如"3秒前"）

#### Scenario: 按名称搜索

- **WHEN** 用户在搜索框输入文本
- **THEN** 列表 SHALL 实时过滤，仅显示名称包含搜索文本的 Agent（不区分大小写）

#### Scenario: 按状态过滤

- **WHEN** 用户点击状态过滤标签（All / Active / Idle / Error）
- **THEN** 列表 SHALL 按选中的状态过滤：All 显示全部、Active 显示 status 不为 idle/offline 的、Idle 仅显示 idle 的、Error 仅显示 error 的

#### Scenario: 点击 Agent 卡片

- **WHEN** 用户点击列表中的 Agent 卡片
- **THEN** 系统 SHALL 选中该 Agent（`selectedAgentId` 更新），列表下方展开 AgentDetailPanel

### Requirement: Agent 详情面板

系统 SHALL 展示选中 Agent 的详细信息。

#### Scenario: 详情面板内容

- **WHEN** 有 Agent 被选中
- **THEN** 面板 SHALL 显示：Avatar + 名称 + 状态标签、当前任务描述（如果 thinking/tool_calling 状态）、当前工具信息（如果 tool_calling 状态，显示工具名称和参数摘要）、最近的对话内容（speechBubble.text，Markdown 渲染）、最近 10 次工具调用历史列表（时间戳 + 工具名）

#### Scenario: 取消选中

- **WHEN** 用户点击面板关闭按钮或点击已选中的 Agent
- **THEN** 面板 SHALL 折叠隐藏，`selectedAgentId` 设为 null

### Requirement: 全局指标卡片

系统 SHALL 显示实时全局运行指标。

#### Scenario: 指标面板布局

- **WHEN** 侧栏顶部渲染指标区域
- **THEN** 系统 SHALL 显示四个指标卡片：Active Agents（数字 + 总数，如 "3/8"）、Total Tokens（格式化显示，如 "87.2k"）、Collaboration Heat（百分比进度条，0-100%）、Token Rate（tokens/min 数字）

#### Scenario: 指标实时更新

- **WHEN** store 中 globalMetrics 变更
- **THEN** 指标卡片 SHALL 在 200ms 内更新显示值，数字变化使用轻微缩放动画

### Requirement: 事件时间轴

系统 SHALL 显示最近事件的时间轴视图。

#### Scenario: 时间轴内容

- **WHEN** 侧栏底部渲染事件时间轴
- **THEN** 系统 SHALL 显示最近 50 条事件，每条包含：时间戳（HH:MM:SS 格式）、Agent 名称（色彩编码）、事件类型图标（lifecycle=圆形、tool=扳手、assistant=气泡、error=三角警告）、简要描述

#### Scenario: 自动滚动

- **WHEN** 新事件到达
- **THEN** 时间轴 SHALL 自动滚动到最新事件（除非用户已手动滚动到上方，此时停止自动滚动并显示"新事件"提示按钮）

#### Scenario: 点击事件条目

- **WHEN** 用户点击时间轴中的事件条目
- **THEN** 系统 SHALL 选中对应的 Agent

### Requirement: Avatar 组件

系统 SHALL 为每个 Agent 生成确定性的可视化头像。

#### Scenario: 确定性首字母头像

- **WHEN** 渲染 Agent Avatar
- **THEN** 系统 SHALL 生成圆形头像：背景色由 agentId hash 从 12 色调色板中确定性选取，前景为 Agent 名称首字母（大写），文字颜色根据背景色亮度自动选择黑/白

#### Scenario: 一致性

- **WHEN** 同一 agentId 在不同位置（列表、详情、平面图 tooltip）渲染 Avatar
- **THEN** 所有位置 SHALL 显示相同的颜色和首字母
