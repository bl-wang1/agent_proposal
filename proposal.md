# 具身智能空间感知 Agent 框架研究方法 Proposal

版本：2026-06-28  
方向：以空间事实状态为主线，聚焦 SpatialFact Graph、主动空间感知与空间谓词验证  
工作名：ECAOS, Embodied Context-Aware Spatial Agent

## 0. 摘要

本 proposal 关注一个具身智能领域的核心断点：近两年 VLA/机器人基础模型在单步或短程操作上快速进步，数字 Agent 框架在工具调用、状态管理、handoff、guardrail、observability 上快速成熟，但真实世界机器人仍缺少一套能把空间信息编码为可推理、可验证、可主动更新的 Agent 框架。机器人并不是只需要“看见物体”，而是需要知道物体、区域、路径、遮挡、可达性、可操作面和风险之间的空间关系，并把这些关系接入任务规划和技能执行。

我建议研究 ECAOS：一个面向长程具身任务的空间感知 Agent 框架。它把高层 Agent 规划、SpatialFact Graph、主动感知策略、标准化技能接口、空间谓词验证器、VLA/导航/操作控制器和安全治理组合成一个可实验、可迭代的系统。研究目标不是再训练一个单一“大模型”，也不是引入常见意义上的预测式 world model，而是回答：如何让机器人把真实环境编码为可行动的空间事实状态，并在不确定、遮挡、关系冲突或可达性未知时主动补充感知，从而更可靠地完成长程导航与操作任务。

本 proposal 收敛到三个核心贡献：`SpatialFact Graph` 负责把空间信息编码为可查询、可过期、可追溯的 Agent 状态；`Uncertainty-Guided Active Perception` 负责在遮挡、冲突、可达性未知或高风险动作前主动补齐关键事实；`Spatial Predicate Verifier` 负责验证技能执行后的空间 effect 是否真实达成。技能契约、运行时治理、持续学习和 Agentic RL 仍然重要，但在本 proposal 中作为系统支撑和长期路线，而不是第一阶段主贡献。

更精确地说，ECAOS 的研究命题不是“把很多模块拼成 AgentOS”，而是：

> 在长程具身任务中，能否通过结构化空间事实状态、主动空间感知和空间谓词验证，把真实环境中的对象、关系、可达性、遮挡与 affordance 编码进 Agent 决策，从而减少空间误判、隐藏失败和重复探索，并提升任务成功率？

这个命题可被反驳。如果结构化空间事实状态不能比文本上下文或普通地图更好地支持任务规划，如果主动感知不能降低关系误判、遮挡失败或可达性错误，如果空间谓词验证不能比技能返回值更早发现隐藏失败，那么 ECAOS 的核心假设就不成立。

核心假设：

1. 具身泛化不能只靠更大的端到端策略；Agent 需要显式空间状态，包含拓扑、语义对象、几何摘要、可达性、遮挡、affordance、时间戳和置信度。
2. 空间记忆不应只是向量检索或 3D 地图；它必须参与任务分解、技能前置条件检查、失败归因和下一步感知动作选择。
3. 主动感知是空间状态维护的一部分；当空间事实低置信度、互相冲突、过期或影响高风险动作时，系统应主动 inspect、换视角、低风险探测或请求人类标注。
4. 技能契约、持续学习、安全治理和版本准入是支撑模块；它们服务于空间事实、主动感知和空间验证，而不是本 proposal 的第一阶段主贡献。

核心贡献边界：

1. 主贡献一是结构化空间事实状态：不是只用文本上下文或静态 3D memory，而是把对象、关系、可达性、遮挡、证据、置信度和过期时间写成 Agent 可查询、可更新的状态。
2. 主贡献二是基于不确定性的主动空间感知：不是盲目多看或多问，而是在信息收益、任务价值、动作成本和风险之间选择 inspect、换视角、低风险探测或 ask-human。
3. 主贡献三是空间谓词 verifier：不是相信技能返回的 `success`，而是独立检查 `visible`、`reachable`、`inside/on/near` 等 effect 是否成立，专门发现 hidden spatial failure。
4. 技能契约、运行时治理、持续学习、candidate promotion 和 Agentic RL 不删除，但放到系统扩展与长期路线中，作为让三项核心贡献可部署、可回归、可演进的工程支撑。

## 1. 背景与问题本质

具身智能正在出现三条技术线的汇合。

第一条是机器人基础模型与 VLA。RT-1 展示了大规模真实机器人数据对语言条件控制和泛化的重要性，使用 13 台机器人、17 个月收集约 13 万 episodes、覆盖 700+ 任务的数据训练模型 [RT-1](https://research.google/blog/rt-1-robotics-transformer-for-real-world-control-at-scale/)。RT-2 把互联网视觉语言知识迁移到机器人动作 token 中，提高对新物体和语义指令的泛化 [RT-2](https://robotics-transformer2.github.io/)。Open X-Embodiment 汇集 22 种机器人、1M+ 真实轨迹和 527 个技能，推动跨本体策略训练 [Open X-Embodiment](https://robotics-transformer-x.github.io/)。Octo、OpenVLA、π0、GR00T N1、Gemini Robotics 等继续沿着“大规模数据 + 多模态模型 + 动作输出”的方向推进 [Octo](https://octo-models.github.io/)、[OpenVLA](https://arxiv.org/abs/2406.09246)、[π0](https://arxiv.org/abs/2410.24164)、[GR00T N1](https://arxiv.org/abs/2503.14734)、[Gemini Robotics-ER 1.6](https://ai.google.dev/gemini-api/docs/robotics-overview)。

第二条是 Agent 系统工程。LangGraph 强调 durable execution、streaming、human-in-the-loop、memory 等能力 [LangGraph](https://docs.langchain.com/oss/python/langgraph/overview)。Microsoft Agent Framework 将 AutoGen 的 agent 抽象与 Semantic Kernel 的企业级状态、类型、middleware、telemetry 和 graph workflow 结合 [Microsoft Agent Framework](https://learn.microsoft.com/en-us/agent-framework/overview/)。OpenAI Agents SDK 的官方文档把 agent 定义、运行循环、handoff、guardrail、工具、sandbox、tracing 和 eval 组织成一套 code-first agent 应用能力 [OpenAI Agents SDK](https://developers.openai.com/api/docs/guides/agents)。这些框架解决了数字环境中的编排、可观测、恢复和安全检查问题，但它们默认的状态、动作和风险模型仍主要面向软件工具，而不是连续、带物理风险、强时序约束的机器人世界。

第三条是持续学习与长程具身任务。Voyager 通过自动课程、可增长技能库和环境反馈驱动的迭代 prompting，展示了开放世界 Agent 的 lifelong learning 思路 [Voyager](https://arxiv.org/abs/2305.16291)。机器人 lifelong RL 研究强调稳定性-可塑性困境、灾难性遗忘、知识组合与复用 [Nature Machine Intelligence 2025](https://www.nature.com/articles/s42256-025-00983-2)、[Continual RL Survey](https://arxiv.org/html/2506.21872v2)。EmbodiedBench 显示，MLLM 在高层任务上更强，但低层导航与操作仍弱，最好模型平均分仅约 28.9%，说明“会看会说”尚不等于“会长期执行” [EmbodiedBench](https://arxiv.org/abs/2502.09560)。

问题本质：当前具身智能缺的是一个能把“感知结果”变成“可行动空间理解”的系统层。这个系统层必须同时处理空间编码、主动感知、任务分解、技能选择、空间谓词验证、低层控制、失败恢复和安全监督。

## 2. 研究目标

### 2.1 总目标

设计并验证一个以空间事实状态为核心的具身 Agent 框架，使机器人能在动态真实环境中编码、感知、验证和主动更新空间信息，并用这些空间状态完成长程操作与导航任务。

### 2.2 具体目标

1. 构建一个 SpatialFact Graph，把拓扑、语义对象、局部几何、可达性、遮挡、affordance、时间戳和置信度编码为可查询的空间事实状态。
2. 提出一套空间感知与主动学习机制，使 Agent 在信息不足时能选择 inspect、换视角、低风险探测、主动请求标注或暂停高风险动作。
3. 将空间谓词接入任务图和技能契约，使不同机器人本体、导航栈、操作策略和工具都能围绕 precondition/effect/verifier 被统一调度。
4. 建立 trace-to-spatial-update 闭环，把失败轨迹、验证结果和人工标注转化为候选空间事实、感知器和 affordance 更新。
5. 形成可复现实验路径：空间编码消融、主动感知消融、空间谓词验证、仿真基准和受控真实 shadow。
6. 输出对风险点的工程化约束：低置信度空间事实不能驱动高风险动作，必须经过安全 gate、人工确认、回滚和审计。

### 2.3 收敛后的最小机制

第一版 ECAOS 只证明三个机制是否成立：

1. `SpatialFact Graph`：把真实空间状态写成可查询、可过期、可追溯的空间事实。
2. `Uncertainty-Guided Active Perception`：当空间事实低置信度、冲突、遮挡、可达性未知或影响高风险动作时，选择 `inspect`、`change_viewpoint`、`probe_reachability`、`ask_human` 或 `defer`。
3. `Spatial Predicate Verifier`：检查技能执行后的空间谓词是否成立，而不是相信裸 `success` 返回。

`Skill Contract` 仍然是必要接口：每个技能都应声明 `precondition`、`effect`、`verifier`、`rollback`、`risk` 和 `failure_code`。但它服务于空间状态、主动感知和 verifier 的实验闭环，不作为第一阶段独立贡献。

首轮最小空间谓词只保留三类：

```text
visible(object)
reachable(object_or_pose)
relation(a, b) = on | inside | near
```

一个贯穿任务例子是：找到桌上的杯子，确认杯子可见且可达，抓取后放进水槽，并验证 `inside(cup, sink)` 是否成立。这个任务足够暴露对象定位、遮挡、可达性、放置关系、技能前提和隐藏空间失败，不需要第一版同时覆盖所有家居任务。

核心数据结构是 `SpatialFact`：

```text
SpatialFact = {
  subject: cup_12,
  predicate: visible | reachable | on | inside | near | occluded_by | placeable_on,
  object: sink_3 | table_2 | null,
  frame: map | robot | object,
  confidence: 0.0-1.0,
  evidence: rgbd_frame_id | human_label | verifier_result | active_probe,
  source_viewpoint: camera_pose_or_robot_pose,
  last_verified_at,
  expires_at,
  risk_relevance: low | medium | high
}
```

第一版不追求完整知识图谱推理，只定义三个必要更新规则：新证据提高或降低 `confidence`；互相冲突的事实进入 `conflict` 状态并触发主动感知；超过 `expires_at` 或缺少独立证据的高风险事实不能直接驱动动作。这样 `confidence`、`evidence` 和 `expires_at` 不只是字段，而是影响 planner、active perception 和 verifier 的状态变量。

## 3. 任务定义

### 3.1 环境与任务流

给定一个连续到来的具身任务流：

```text
T = {tau_1, tau_2, ..., tau_n, ...}
tau_i = (instruction, environment, embodiment, constraints, success_metric)
```

系统在每个任务中接收多模态观察：

```text
o_t = {RGB-D/video, proprioception, map/state, audio/text, tool feedback, human feedback}
```

输出分层动作：

```text
a_t = {plan_step, tool_call, navigation_goal, manipulation_skill, VLA_action, ask_human, abort}
```

每条执行轨迹记录为：

```text
trajectory = {
  instruction,
  observations,
  belief_state,
  spatial_world_state,
  spatial_memory_diff,
  active_perception_actions,
  task_graph,
  tool_calls,
  skill_calls,
  low_level_actions,
  rewards,
  safety_events,
  human_interventions,
  final_outcome
}
```

### 3.2 优化目标

系统需要最大化：

1. 空间 grounding、关系判断和可达性预测准确率。
2. 长程任务成功率。
3. 新环境、新物体、新本体上的空间泛化成功率。
4. 主动感知的数据效率和错误下降速度。
5. 可解释、可审计、可恢复的执行质量。

同时最小化：

1. 空间关系误判、过期记忆和隐藏空间失败。
2. 安全约束违规。
3. 无效探索、重复 inspect 和重复失败。
4. 人类介入次数。
5. 延迟和资源成本。

### 3.3 关键指标

| 指标 | 定义 | 作用 |
|---|---|---|
| Success Rate | 完整任务成功比例 | 总体能力 |
| Spatial Grounding Accuracy | 对象、区域、关系与坐标/语义引用的匹配准确率 | 空间理解质量 |
| Relation Predicate Accuracy | on/inside/near/open/blocked 等空间关系判断准确率 | 空间谓词可靠性 |
| Reachability Accuracy | reachable、graspable、placeable、path_clear 等预测准确率 | 行动可行性 |
| Stale Memory Detection | 过期空间事实被发现的比例 | 动态环境适应 |
| Active Learning Gain | 主动 inspect/换视角/标注后错误率下降 | 主动感知价值 |
| Hidden Spatial Failure Rate | 技能返回 success 但空间 effect 未达成的比例 | 进度验证价值 |
| Safety Violation Rate | 约束违规/近失误频次 | 部署安全 |
| Recovery Rate | 失败检测后恢复成功比例 | Agentic 执行韧性 |
| Cross-Embodiment Delta | 迁移到新本体后的性能下降 | 本体泛化 |

## 4. 相关方法调研

### 4.1 LLM/VLM/VLA 驱动的具身控制

SayCan 把语言模型的高层语义能力与可执行技能的 affordance/value 结合，用“合理性 + 可行性”筛选机器人动作 [SayCan](https://say-can.github.io/)。Code as Policies 使用语言模型生成可调用感知和控制 API 的程序，把自然语言任务转成可执行策略代码 [Code as Policies](https://code-as-policies.github.io/)。PaLM-E 把连续传感器输入接入语言模型，做具身推理、VQA 和机器人规划 [PaLM-E](https://palm-e.github.io/)。

这些方法的共同贡献是把语言推理接入机器人动作空间。局限是：多数工作仍偏单任务或短程演示，持续学习机制、运行时治理、跨任务记忆和真实部署数据闭环不足。

### 4.2 机器人基础模型与跨本体数据

RT-1、RT-2、Open X-Embodiment、RT-X、Octo、OpenVLA、π0、GR00T N1 和 Gemini Robotics 说明，泛化机器人策略正在从小任务模型走向基础模型。OpenVLA 是 7B 开源 VLA，训练在约 970k 真实机器人 demonstrations 上，并提供训练和微调代码 [OpenVLA](https://github.com/openvla/openvla)。Octo 是 transformer diffusion policy，使用 Open X-Embodiment 中约 800k trajectories 训练，强调快速适配新传感器和动作空间 [Octo](https://arxiv.org/abs/2405.12213)。LeRobot 把真实机器人、数据采集、数据流、训练和推理栈整合到开源 PyTorch 生态中，降低数据闭环门槛 [LeRobot](https://arxiv.org/html/2602.22818v1)。

这些方法给 ECAOS 提供低层能力来源，但它们本身不等价于 Agent 系统：缺少明确的任务状态机、长期空间记忆、技能治理、失败恢复策略、模型版本与 replay 管理。

### 4.3 数字 Agent 框架

LangGraph、Microsoft Agent Framework、OpenAI Agents SDK、CrewAI 等框架在 agent orchestration、tool use、handoff、memory、guardrail、observability 上提供工程模式 [LangGraph](https://docs.langchain.com/oss/python/langgraph/overview)、[Microsoft Agent Framework](https://learn.microsoft.com/en-us/agent-framework/overview/)、[OpenAI Agents SDK](https://developers.openai.com/api/docs/guides/agents)、[CrewAI](https://docs.crewai.com/)。

启发：具身 Agent 也需要 durable execution、状态恢复、人类检查点、tracing、工具 schema、沙箱和评估闭环。

不足：数字框架默认工具调用是离散 API，失败代价较低；机器人动作是连续控制，存在碰撞、损坏、人员安全、执行延迟、传感噪声和物理不可逆问题。因此要把 digital agent runtime 改造成 embodied runtime，必须增加空间状态、动作权限、技能 precondition/effect、实时监控和安全 supervisor。

### 4.4 持续学习与灾难性遗忘

Continual RL 文献把问题归纳为任务流下的稳定性-可塑性平衡：既要适应新任务，又要保留旧任务性能 [Continual RL Survey](https://arxiv.org/html/2506.21872v2)。机器人 lifelong RL 进一步强调知识保存、组合和重用在长程任务中的价值 [Nature Machine Intelligence 2025](https://www.nature.com/articles/s42256-025-00983-2)。Voyager 的技能库路线说明，知识可以通过可检索的程序化技能保存，而不必全部写入模型参数 [Voyager](https://voyager.minedojo.org/)。

ECAOS 的选择：采用“多载体知识”而不是单一参数更新。旧知识由 replay buffer、adapter、专家模块、技能库、空间记忆 schema、任务图模板共同承载；每次更新都要求通过旧任务回归测试和 safety eval。

### 4.5 空间记忆、长程规划与评估

HoloAgent-0 把 Embodied AgentOS、3D spatial memory 和 embodied skills 组织为真实机器人部署框架，指出数字 Agent loop 迁移到物理机器人时需要闭环执行、资源调度、反馈监控和重新规划 [HoloAgent-0](https://arxiv.org/abs/2606.23565)。3DLLM-Mem 关注长期 3D 时空记忆和 embodied reasoning [3DLLM-Mem](https://3dllm-mem.github.io/)。Habitat 3.0、RoboCasa/RoboCasa365、ManiSkill-HAB、EmbodiedBench 等为导航、重排、家居操作、空间理解和长程任务提供评估基准 [Habitat 3.0](https://aihabitat.org/habitat3/)、[RoboCasa](https://robocasa.ai/)、[RoboCasa365](https://arxiv.org/html/2603.04356v1)、[ManiSkill-HAB](https://openreview.net/forum?id=6bKEWevgSd)、[EmbodiedBench](https://embodiedbench.github.io/)。

启发：ECAOS 需要把 3D spatial memory 设为一级模块，不应把世界状态压缩成纯文本上下文。

### 4.6 Agentic RL

Agent Lightning 把任意 Agent 执行轨迹抽象成 MDP，并通过分层 credit assignment 把复杂 agent 交互转成可训练 transition，强调训练和 agent 执行解耦 [Agent Lightning](https://arxiv.org/abs/2508.03680)。这对具身 Agent 很重要：真实机器人轨迹中包含 planner 决策、工具选择、skill 调用、低层动作、失败恢复和人类介入，不能简单用单回合 RLHF 建模。

ECAOS 的 Agentic RL 不直接从一开始训练所有低层动作，而是先训练高层策略：

1. 何时分解任务。
2. 何时检索空间记忆。
3. 何时调用导航/操作/VLA 技能。
4. 何时检查进度。
5. 何时回滚、重试、换技能或请求人类。
6. 何时拒绝执行危险动作。

### 4.7 安全与运行时治理

Microsoft 2026 年披露的 AutoJack 案例说明：当 agent 能浏览不可信网页并连接本地 MCP/工具服务时，localhost 不能再被视为信任边界 [Microsoft AutoJack](https://www.microsoft.com/en-us/security/blog/2026/06/18/autojack-single-page-rce-host-running-ai-agent/)。OWASP 将 prompt injection 列为 LLM 应用关键风险之一 [OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)。具身 Agent 的风险更高，因为错误工具调用会变成物理动作。Runtime governance 研究也强调，应把能力准入、策略检查、执行监控、回滚和人工 override 外置为运行层 [Harnessing Embodied Agents](https://arxiv.org/html/2604.07833v1)。

ECAOS 必须从第一天设计治理层，而不是后补安全提示词。

## 5. 研究空白与改进点

| 现有方向 | 已解决 | 未解决 |
|---|---|---|
| VLA/机器人基础模型 | 感知-语言-动作映射，跨任务/跨本体初步泛化 | 显式空间状态、遮挡/可达性建模、长程空间关系维护 |
| 数字 Agent 框架 | 工具调用、状态恢复、handoff、guardrail、tracing | 物理世界状态、连续动作、空间不确定性、安全约束 |
| 空间记忆 | 3D/时空记忆开始形成 | 与任务图、技能 precondition、空间谓词 verifier 和主动感知策略的统一接口 |
| 主动学习 | 在视觉识别和数据筛选中较成熟 | 面向机器人空间不确定性的 inspect、换视角、探测、标注请求和安全约束整合 |
| 持续 RL/学习 | 遗忘与迁移的理论和部分算法 | 将空间失败转成 SpatialFact、perception update、affordance update 和安全准入 |
| 仿真基准 | 大规模可控训练和评估 | sim-to-real、动态真实环境、空间关系变化和长期部署数据质量 |
| 安全治理 | prompt injection、tool security、runtime policy 被重视 | 面向机器人空间动作的权限、实时监控、物理回滚和责任审计 |

因此，ECAOS 的创新不在单点模型，而在“以空间事实状态为核心的具身 Agent 框架”：空间信息被结构化编码，Agent 主动补齐不确定空间事实，并用空间谓词验证任务是否真的推进。

### 5.1 与 HoloAgent-0 和数字 Agent 框架的差异

HoloAgent-0 已经把 Embodied AgentOS、3D spatial memory 和 skills 组织成真实机器人框架；LangGraph、Microsoft Agent Framework、OpenAI Agents SDK 已经证明数字 Agent runtime 可以拥有 durable execution、tool use、tracing 和 guardrail。ECAOS 必须避免只成为这些系统的并列表述。

差异点应收敛到三件事：

1. SpatialFact Graph as agent state：Agent 的核心状态不是文本历史，而是带 confidence、evidence、expires_at 和 risk_relevance 的空间事实图。
2. Uncertainty-Guided Active Perception：当空间事实不确定、互相冲突或影响高风险动作时，Agent 主动选择 inspect、换视角、低风险探测或请求人类标注。
3. Spatial Predicate Verifier：verifier 检查 visible、reachable、on/inside/near 等空间 effect 是否真的发生，专门发现 hidden spatial failure。

Skill Contract 是必要的接口假设：没有 precondition、effect、rollback、risk 和 failure code，空间状态与 verifier 很难接入真实技能。但它不是第一阶段需要证明的新贡献。若上述三点不能在实验中带来可测收益，ECAOS 就不应被视作独立研究贡献。持续学习、candidate promotion、Agentic RL 和安全治理仍然保留，但它们是长期系统路线，而不是主命题本身。

## 6. 方法 Proposal：ECAOS

### 6.1 总体架构

ECAOS 分为七层：

1. Instruction & Goal Layer：接收自然语言任务、约束、用户偏好和环境上下文。
2. Spatial State Layer：维护 SpatialFact Graph，包括拓扑、语义对象、局部几何、遮挡、可达性、affordance、时间戳和置信度。
3. Active Perception Layer：根据不确定性和任务价值选择换视角、inspect、低风险探测、重定位或请求标注。
4. Planner & Progress Layer：生成空间任务图，选择子目标，检查空间谓词，触发重规划。
5. Skill Registry Layer：统一描述导航、抓取、放置、开关门、抽屉操作、视觉定位、网页/数据库工具等能力。
6. Policy & Controller Layer：接入 VLA、导航策略、操作策略、经典规划器、低层控制器。
7. Governance & Learning Layer：动作准入、权限、碰撞/危险检测、human approval、rollback、trace、空间事实更新和候选发布。

关键设计原则：

1. Agent planner 不直接输出电机命令，只输出可审计的任务图和 skill call。
2. 每个 skill 必须声明 preconditions、effects、input/output schema、uncertainty、cost、safety class、rollback handler。
3. 低层策略可以是 VLA 或经典控制，但都必须被 skill wrapper 包装成可观测、可回滚、可度量的调用。
4. Memory 不只是向量库；必须包含空间事实、空间谓词、episodic trace、procedural skill memory 和 failure memory。
5. 主动学习不等于多采数据；系统必须用 uncertainty、expected information gain、任务风险和动作成本决定是否值得补充感知。

### 6.2 技能接口

统一技能 schema：

```json
{
  "skill_id": "open_drawer.v2",
  "embodiments": ["mobile_manipulator", "dual_arm"],
  "inputs": {
    "target_object": "drawer_handle",
    "pose_hint": "SE3 optional",
    "force_limit": "float",
    "timeout_s": "int"
  },
  "preconditions": [
    "target_visible_or_localized",
    "reachable(target_pose)",
    "collision_risk < threshold"
  ],
  "effects": [
    "drawer_state = open",
    "handle_pose_updated"
  ],
  "safety_class": "contact_sensitive",
  "controller": "vla_policy | impedance_controller | scripted | hybrid",
  "confidence_model": "calibrated_success_predictor",
  "rollback": "stop_and_retract"
}
```

这个接口的作用是把不可控的大模型动作转为可治理的系统调用。但 schema 本身还不够，真正可迁移的是 skill 的语义契约。

ECAOS 将 skill 定义为四元组：

```text
Skill = Intent + Contract + Implementation + Verifier
```

| 组成 | 作用 | 示例 |
|---|---|---|
| Intent | 高层语义目标 | open_drawer |
| Contract | 可验证前置条件和效果 | handle reachable, drawer openness > 20cm |
| Implementation | 本体相关执行器 | single-arm VLA, dual-arm controller, scripted impedance |
| Verifier | 效果检查器 | vision + force + joint state 判断 drawer_state=open |

这种拆分解决跨本体泛化的核心矛盾：同一个 `open_drawer` 在不同机器人上不共享低层动作，但可以共享任务图、precondition、effect、失败类型和 verifier 训练信号。若 verifier 判定 effect 未达成，系统不应把它简单记为“任务失败”，而要区分是 contract 不满足、implementation 不适配、perception 错误，还是 memory stale。

#### 6.2.1 Transfer axes 与 adapter contract

泛化必须拆成三个可测迁移轴，而不是只报告一个平均成功率：

| 迁移轴 | 保持不变 | 允许变化 | 主要失败边界 |
|---|---|---|---|
| 跨环境 | 任务目标、成功谓词、技能契约、风险等级、发布门槛 | 地图、光照、障碍物、人流、定位方式 | world_state_error、navigation_failure、stale_memory |
| 跨物体 | 操作意图、关系谓词、验证逻辑 | 外观、大小、材质、抓取姿态、遮挡、相似干扰物 | perception_error、affordance_error、verifier_uncertain |
| 跨本体 | task graph、SkillContract、failure code、trace schema、verifier 目标 | 自由度、末端执行器、底盘、控制器、动作空间、安全半径 | implementation_mismatch、controller_failure、safety_margin_error |

对应的工程原则是：共享 contract，替换 adapter。

```text
ImplementationAdapter:
  embodiment: mobile_manipulator_v2
  implements: place_object:v3
  controller: ros2_place_action
  action_space: ee_pose_delta + gripper
  safety_limits:
    max_speed: 0.35
    max_force: 20
    human_clearance: 0.8
  contract_tests:
    min_effect_success: 0.85
    max_unsafe_events: 0
    max_hidden_failure: 0.05
```

新 adapter 不能因为接上了控制器就上线，必须通过 contract test：effect 成功率、安全事件、hidden failure、overblocking 和旧任务回归都达标。

### 6.3 空间事实状态

空间事实状态由五个子结构组成。这里的“状态”不是预测式 world model，而是面向 planner、active perception 和 verifier 的 SpatialFact Graph：

1. Metric map：几何地图、障碍物、可通行区域、机器人位姿。
2. Semantic object graph：对象类别、实例、状态、位置、容器关系、可操作部件。
3. Geometry & visibility graph：局部几何摘要、可见性、遮挡关系、观察视角和传感器覆盖。
4. Affordance graph：对象-技能可用性，例如 cup 可 grasp，drawer 可 open，counter 可 place。
5. Temporal event graph：谁在何时移动了什么，哪些尝试失败，失败原因是什么。

Planner 使用空间事实状态回答：

1. 目标物体可能在哪里。
2. 哪个路径和视角最可能成功。
3. 当前计划是否偏离任务进度。
4. 目标是否可见、可达、可抓、可放，是否被遮挡或处于高风险区域。
5. 当前失败是 perception、navigation、manipulation、stale memory 还是 instruction ambiguity。
6. 是否需要主动感知、询问人类或换技能。

每个 SpatialFact 必须带置信度、证据、过期时间和风险相关性：

```text
SpatialFact = {
  subject,
  predicate,
  object_or_value,
  frame,
  confidence,
  evidence,
  last_verified_at,
  expires_at,
  observation_viewpoint,
  conflict_set,
  risk_relevance
}
```

第一版 `SpatialFact Graph` 不做复杂开放世界推理，只保留三类状态更新：

1. Evidence fusion：同一谓词的新观测、verifier 结果和人工标注更新 `confidence` 与 `last_verified_at`，并保留证据来源。
2. Conflict handling：同一对象出现互斥关系或新旧观测冲突时，不直接覆盖旧事实，而是写入 `conflict_set`，交给主动感知或 verifier 复核。
3. Expiry and risk gating：低置信度、过期或高风险相关的 SpatialFact 不能直接驱动高风险动作，只能触发 `inspect`、`change_viewpoint`、`probe_reachability`、`ask_human` 或低风险探索。

这样可以显式处理“错误记忆比没有记忆更危险”的问题，也让 `confidence`、`evidence` 和 `expires_at` 成为影响决策的状态变量，而不是日志字段。

空间记忆本身也需要被评估，而不只通过最终成功率间接评估：

| Memory 指标 | 含义 |
|---|---|
| Object localization accuracy | 目标物体位置预测误差 |
| State prediction accuracy | drawer open/closed、cup in sink 等状态预测准确率 |
| Affordance calibration | skill success posterior 是否校准 |
| Stale memory detection | 过期事实被发现的比例 |
| Memory-induced failure | 由错误记忆导致的失败比例 |

### 6.4 主动空间感知与主动学习

主动学习在 ECAOS 中不是离线挑数据，而是运行时策略：当空间状态不足以支持下一步动作时，Agent 主动选择最有信息价值且风险最低的感知动作。

触发条件包括：

1. 空间事实低置信度：例如 `inside(cup, sink)`、`reachable(handle)`、`path_clear(room_a, room_b)` 的 confidence 低于阈值。
2. 空间事实互相冲突：例如视觉检测认为杯子在桌上，历史 memory 认为杯子在水槽。
3. 遮挡或视角不足：目标对象、抓取点、门把手或放置区域不可见。
4. 可达性未知：对象可见但抓取路径、底盘位置或末端姿态不可行性未确认。
5. 高风险动作依赖未经验证的空间事实：例如接近人、越过狭窄通道、打开门、移动易碎物。

可选主动感知动作包括：

```text
active_perception_action = {
  inspect(object_or_region),
  change_viewpoint(candidate_pose),
  localize_again(object),
  probe_reachability(target_pose, low_risk=True),
  ask_human_for_label(question, candidates),
  defer_high_risk_action(reason)
}
```

策略目标不是“看得越多越好”，而是在信息收益、动作成本、任务延迟和安全风险之间做选择：

```text
score(action) =
  expected_information_gain(spatial_fact)
  + expected_task_success_gain(action)
  - motion_cost(action)
  - latency_cost(action)
  - safety_risk(action)
  - human_burden(action)
```

第一版不需要一次学出完整策略，可以用可解释的估计器启动：

1. `expected_information_gain`：用目标 SpatialFact 的置信度缺口、冲突数量和可见性遮挡程度估计。
2. `expected_task_success_gain`：只在该 SpatialFact 是下一步 precondition 或 verifier target 时给高权重。
3. `motion_cost` 和 `latency_cost`：来自导航距离、视角切换距离和技能耗时统计。
4. `safety_risk`：来自治理层的碰撞、人员距离、接触敏感和物体脆弱性规则。
5. `human_burden`：对 ask-human 设置递增成本，避免策略把求助当成默认恢复路径。

后续 learned active perception policy 只替换这些估计器，不改变 trace schema 和评估指标。

主动学习样本也必须进入 trace：

```text
active_learning_event = {
  uncertainty_source,
  selected_action,
  alternative_actions,
  expected_gain,
  observation_result,
  updated_spatial_fact,
  label_source,
  downstream_effect
}
```

评估主动学习时，需要报告：

| 主动学习指标 | 含义 |
|---|---|
| Query efficiency | 每次 inspect/标注带来的空间错误下降 |
| Viewpoint gain | 换视角后 object/relation/reachability 置信度提升 |
| Avoided unsafe action | 主动感知避免高风险误动作的次数 |
| Unnecessary query rate | 本可直接完成却过度感知或过度询问的比例 |
| Human label burden | 每任务或每小时请求人类标注次数 |

### 6.5 任务规划与进度检查

Planner 采用 hierarchical task graph，而不是一次性完整 plan：

```text
Goal: "把餐桌上的杯子放进水槽，然后擦桌面"

Task graph:
1. localize(cup, table)
2. navigate_to(table)
3. grasp(cup)
4. verify_in_gripper(cup)
5. navigate_to(sink)
6. place(cup, sink)
7. verify_object_at(cup, sink)
8. localize(cloth/sponge)
9. wipe(table_surface)
10. verify_surface_clean(table)
```

每个节点有：

1. success predicate。
2. observation query。
3. allowed skills。
4. retry budget。
5. safety constraints。
6. fallback path。

进度检查器不只判断最终成功，而是在每个子目标后检查：

1. 对象状态是否改变。
2. 机器人是否仍在安全区域。
3. 任务图是否需要重排。
4. 是否出现新障碍或人类干预。
5. 当前执行 trace 是否值得进入训练数据。

Progress checker 是 ECAOS 的核心监督源。长程具身任务的关键失败常常不是“机器人没有动作”，而是“系统以为动作带来了进展，但真实世界没有变化”。因此每个 task graph node 必须包含独立 verifier：

```text
subgoal = {
  action: place(cup, sink),
  expected_effect: object_inside(cup, sink),
  verifier: vision_relation_checker + depth_geometry_checker,
  failure_boundary: effect_verification_failed,
  recovery_candidates: [regrasp(cup), place_deeper(cup, sink), ask_human]
}
```

Verifier 必须尽量避免和执行技能共享同一个单点信号。第一版至少使用三类独立证据中的两类：

1. multi-view vision / depth：从不同视角检查对象、容器边界和空间关系。
2. geometry and state consistency：用深度几何、地图、关节/夹爪状态或 force/proprioception 检查 effect 是否物理可行。
3. oracle or human audit for evaluation：仿真 state 或抽样人工标注只用于训练和评估 verifier，不直接给线上 planner 当捷径。

如果 verifier 与执行策略使用同一帧视觉结果且没有独立证据，它只能记为 weak verifier，不能用于证明 hidden spatial failure 的下降。

Progress checker 的训练信号来自四类来源：

1. 仿真 state：提供高质量但分布偏窄的 verifier 标签。
2. 真实轨迹人工抽检：标注关键失败边界。
3. 多传感器一致性：视觉、深度、force、proprioception 互相校验。
4. 后验任务结果：最终成功/失败反推哪些子目标判断可能错误。

相比只训练 planner，优先训练 progress checker 更有价值：它能把稀疏 final reward 变成密集、可定位、可回放的局部监督。

### 6.6 系统扩展与长期路线

以下模块让 ECAOS 从一次性实验走向可维护系统，但不作为第一阶段主贡献。它们的作用是支撑空间事实、主动感知和 verifier 的长期更新、上线准入和安全运行。

#### 6.6.1 空间更新与持续学习闭环

ECAOS 的学习闭环服务于空间能力，而不是把所有轨迹直接用于 fine-tune：

1. Collect：记录空间观测、观察视角、空间谓词、skill 调用、验证结果、主动感知动作、失败和人工标注。
2. Diagnose：把失败归因到对象定位、关系判断、遮挡、可达性、affordance、stale memory、规划、技能或安全门控。
3. Curate：筛选高价值空间样本，去重，保留反例、遮挡场景、关系冲突和主动感知前后的对比片段。
4. Update：分别更新 SpatialFact、stale detector、relation predictor、reachability predictor、affordance estimator、active perception policy。
5. Rehearse：用旧空间事实、旧任务 replay、仿真回放和 benchmark regression 检查空间记忆退化。
6. Admit：候选空间事实、候选感知器或候选主动策略先进入 shadow，不直接覆盖线上稳定版本。
7. Monitor：在线跟踪空间错误类别漂移、主动感知收益、安全事件和人类标注负担。

#### 6.6.2 Failure-to-Spatial-Learning Pipeline

ECAOS 的持续学习闭环应以空间失败归因为中心，而不是以“收集更多数据”为中心：

```text
Execute
  -> Verify progress
  -> Detect failure boundary
  -> Diagnose failure type
  -> Emit spatial update signal
  -> Build candidate memory/perception bundle
  -> Run spatial regression and safety tests
  -> Shadow deploy
  -> Promote or reject
```

失败类型至少拆成：

| Failure type | 训练或系统动作 |
|---|---|
| object_localization_error | 更新对象定位器、视角选择策略或 memory query |
| relation_error | 增加空间关系样本，更新 relation predicate checker |
| occlusion_error | 更新遮挡判断和 next-best-view policy |
| reachability_error | 更新 reachable/graspable/placeable 预测器 |
| affordance_error | 更新对象-技能成功先验和 affordance estimator |
| stale_memory | 降低 SpatialFact confidence，训练 stale detector |
| unnecessary_query | 调整 active perception cost，降低过度 inspect 或过度询问 |
| wrong_skill | 更新 skill selector 或 success predictor |
| bad_precondition | 修正 skill contract 或 precondition checker |
| controller_failure | 更新低层 adapter 或切换 implementation |
| effect_verification_failed | 训练 progress checker 和 recovery policy |
| unsafe_plan | 强化 action gate 或 human checkpoint |
| instruction_ambiguity | 训练 ask-human policy 和 clarification template |

这种机制让空间失败成为结构化资产，而不是训练数据中的噪声。

避免空间能力退化的机制：

1. Replay：按任务族、环境族、对象族、本体族维护分层 replay buffer。
2. Adapter isolation：新场景优先训练 LoRA/adapter 或专家模块，不直接覆盖 base policy。
3. Skill versioning：技能作为可版本化资产，旧技能不被覆盖，新技能先以候选版本上线。
4. Spatial regression suite：每次更新必须跑旧对象、旧关系、旧布局、旧可达性和安全集。
5. Routing/gating：根据 embodiment、环境、对象和不确定性选择 expert，而非单一参数共享。
6. Memory distillation：将高频成功轨迹蒸馏为任务图模板和 skill priors，而非只保留原始轨迹。

#### 6.6.3 Agentic RL 训练

Agentic RL 是长期优化方向，不参与第一版最小可发表实验。它只在空间事实、主动感知、verifier 和 trace schema 稳定后，用于优化高层决策、恢复和求助策略。

把一条具身执行轨迹拆成高层 transition：

```text
s_t = {instruction, belief_state, spatial_memory_summary, task_graph_state, skill_stats, safety_state}
a_t = {choose_skill, ask_memory, inspect_progress, replan, ask_human, abort}
r_t = success_reward + progress_reward - safety_penalty - wasted_action_cost - intervention_cost
```

训练目标：

1. Planner policy：学会选择下一步和何时重规划。
2. Tool/skill policy：学会何时调用哪个工具/技能。
3. Progress checker：学会发现“看似执行但实际没进展”的状态。
4. Recovery policy：学会从失败中恢复，而不是重复同一动作。
5. Ask-human policy：学会在高风险或信息不足时请求帮助。

训练方式：

1. Offline RL：先用历史轨迹和仿真轨迹训练，降低真实探索风险。
2. Hierarchical credit assignment：将最终成功/失败分解给关键决策点。
3. Constrained RL：安全违规作为硬约束，不仅是负 reward。
4. Preference/RLAIF：对多个计划候选进行偏好学习，优化可解释性和安全性。
5. Online fine-tuning：只在低风险任务和 shadow mode 通过后开启。

#### 6.6.4 Trace-Level Credit Assignment

Agentic RL 不能把整条轨迹的最终成败平均分给所有决策。ECAOS 先通过 diagnosis model 找到 failure boundary，再只对相关高层决策回传 credit。

示例：

```text
Goal: 把杯子放进水槽，然后擦桌面
Trace:
  localize(cup) -> success
  grasp(cup) -> success
  navigate_to(sink) -> success
  place(cup, sink) -> effect_verification_failed
  inspect_progress -> cup near sink, not inside sink
  recovery -> regrasp + place_deeper -> success

Credit:
  place skill selection: weak negative
  progress checker: strong positive
  recovery policy: positive
  original planner: neutral unless repeated bad placement
```

这样 RL 优化的是“在失败边界处如何检查、恢复、换技能、求助”，而不是盲目惩罚整条计划。

#### 6.6.5 Agentic RL transition builder

训练接口从 trace 中抽取高层决策点，不把整段机器人控制流直接塞进 RL：

```python
def build_agentic_rl_transitions(trace):
    transitions = []

    for event in trace.events:
        if not event.is_decision_point():
            continue

        state = encode_state(
            task_node=event.task_node,
            world=event.world_before,
            memory_confidence=event.memory_confidence,
            skill_stats=event.skill_stats,
            risk=event.governance_risk,
            failure_history=trace.failure_context(event),
        )

        action = event.high_level_action
        outcome = trace.local_outcome_after(event)

        reward = (
            reward_progress(outcome)
            + reward_recovery(outcome)
            - penalty_unsafe(outcome)
            - penalty_wasted_steps(outcome)
            - penalty_unnecessary_takeover(outcome)
        )

        if outcome.violates_hard_constraint:
            transitions.append(HardReject(state, action, reason=outcome.reason))
            continue

        transitions.append(Transition(
            state=state,
            action=action,
            reward=reward,
            next_state=encode_state(outcome.next_event),
            credit=trace.failure_boundary.credit_for(event),
        ))

    return balance_by_task_risk_and_failure_type(transitions)
```

这里的边界很重要：硬安全约束不是负 reward，而是拒绝条件；ask-human 既不能被简单惩罚，也不能被滥用成恢复率来源；inspect、abort、retry 的行为分布必须进入候选策略审计。

#### 6.6.6 Runtime Governance

Runtime governance 是部署前提，不是第一阶段创新点。它保证空间事实和主动感知不会把低置信度判断直接转化成高风险物理动作。

治理层与 planner 分离，拥有最终动作准入权：

1. Capability admission：任务开始前检查当前机器人是否有权限、有技能、有传感器、有环境约束。
2. Action gate：每个 skill call 前做 precondition、碰撞、力控、速度、人员距离、物体脆弱性检查。
3. Tool sandbox：任何外部工具、浏览器、本地服务、MCP 或 shell 都必须隔离和授权。
4. Human checkpoint：高风险动作，例如接近人、开门、使用尖锐/高温/电器，必须人工确认或使用更保守策略。
5. Runtime monitor：实时检测 stuck、oscillation、unexpected contact、lost localization。
6. Rollback/abort：每个 skill 必须提供 stop、retract、restore 或 safe-state handler。
7. Audit trail：所有计划、动作、模型版本、传感器证据、拦截原因写入不可变日志。

#### 6.6.7 Candidate Promotion Policy

空间更新的关键不是训练出候选模型，而是决定候选空间事实、候选感知器或候选主动策略是否允许上线。ECAOS 把每次更新打包成 candidate bundle：

```text
candidate_bundle = {
  spatial_fact_delta,
  relation_checker_version,
  reachability_predictor_version,
  affordance_estimator_version,
  active_perception_policy_version,
  spatial_verifier_version,
  training_trace_set,
  evaluation_report
}
```

准入规则采用 constrained promotion：

```text
promote if:
  spatial_grounding_delta >= threshold
  relation_accuracy_delta >= threshold
  old_spatial_regression_delta >= -threshold
  safety_violation_delta <= 0
  unnecessary_query_delta <= threshold
  human_label_burden_delta <= threshold
  calibration_error <= threshold
  overblocking_rate <= threshold
```

否则候选只能进入 shadow mode 或被拒绝。这里的 `unnecessary_query_delta` 和 `overblocking_rate` 很重要：主动学习不能退化成过度询问，治理层也不能只追求保守。

#### 6.6.8 Trace admission 与数据治理

真实轨迹不是默认训练数据。每条 trace 进入训练池前必须经过用途授权、脱敏、标签质量、安全事件和 replay 平衡检查：

```text
admit_trace_for_learning(trace):
  if no training consent -> audit only
  if sensitive raw stream -> redact or strip raw stream
  if unresolved safety event -> quarantine
  if low confidence failure label -> human audit
  if duplicate and low marginal value -> reject
  if replay buffer becomes imbalanced -> defer
  else -> admit with dataset card and retention policy
```

这样空间更新不会把隐私、错误标签、低质量重复失败和安全事故一起放大。

#### 6.6.9 Policy audit

主动感知和 Agentic RL 候选还需要证明自己没有学会钻空子：

```text
reject if:
  unsafe_events > 0
  hidden_spatial_failure_rate increases
  overblocking_rate increases beyond threshold
  unnecessary_query_rate increases beyond threshold
  human_takeover_rate increases without autonomous recovery gain
  inspect/ask-human/abort distribution drifts abnormally
  controller_fault_rate increases
  holdout scenarios fail
```

这对应五类典型失配：verifier gaming、ask-human overuse、unnecessary query、overblocking 和 risk transfer。候选策略只有通过 policy audit，才能进入 shadow run。

### 6.7 Examiner Case Study

用一个失败案例穿透整个系统：

```text
任务：把餐桌上的杯子放进水槽，然后擦桌面。
失败：place(cup, sink) 后，杯子停在水槽边缘，planner 原本准备进入 wipe(table)。
spatial verifier：发现 object_inside(cup, sink)=false，阻止任务进入下一节点。
diagnosis：effect_verification_failed，可能原因是 place pose 太浅、sink 可放置区域估计错误或视角遮挡导致关系误判。
active perception：换到水槽侧面 inspect，确认杯子在边缘而非水槽内部。
memory delta：更新 sink 的安全放置区域、cup near-edge failure event 和对应观察视角。
recovery：regrasp(cup) + place_deeper(cup, sink)。
training signal：增强 relation predicate checker、place affordance estimator 和 active perception policy。
promotion evidence：如果新空间更新在 held-out sink/cup 场景降低 hidden spatial failure 且不增加 unsafe contact 或 unnecessary query，允许灰度发布。
```

这个案例表明，ECAOS 的核心不是“会调用更多模块”，而是能把一次真实空间失败转成可定位、可验证、可主动感知、可准入的空间更新。

## 7. 实现路径

### 阶段 0：最小系统定义

目标：完成 ECAOS 的最小空间闭环。

任务：

1. 定义 spatial schema、skill schema、trajectory schema、task graph schema。
2. 选择基准环境：Habitat 3.0 或 RoboCasa/ManiSkill-HAB 作为仿真主线。
3. 选择低层策略：OpenVLA/Octo/LeRobot policy + 经典导航/控制 fallback。
4. 实现 planner、spatial verifier、spatial state、active perception stub、governance 的最小闭环。

成功标准：

1. 能完成 5-10 个长程 household task。
2. 每一步都有 trace。
3. 空间失败能被分类。
4. 安全 gate 能拦截人为设置的危险指令。

#### 前 90 天可交付物

第一版按小团队可执行规模设计，目标是在前三个月交付可复现实验包：

| 时间 | 工程交付 | 实验交付 | 验收证据 |
|---|---|---|---|
| Week 1-3 | spatial schema、任务卡、skill contract、trace store、回放脚本 | 3 个任务族，每个 2-3 个 seed 场景 | 同一 episode 可从 trace 重放空间事实、门控、技能结果和 verifier 判断 |
| Week 4-6 | planner、governance、spatial state snapshot、verifier 最小闭环 | text-memory、2D-map、ECAOS-spatial-lite 三个 baseline | 能统计 spatial grounding、relation accuracy、hidden spatial failure、human label burden |
| Week 7-10 | 空间失败归因、主动感知策略、数据治理、candidate spatial bundle stub | 100+ 条 episode，覆盖成功、失败、主动感知、人工标注和恢复 | 失败能归因到 object、relation、occlusion、reachability、skill、governance 或 data_quality |
| Week 11-13 | shadow evaluation、量化门槛、报告面板、关键案例回放 | 固定 split 的首轮消融实验 | 证明 SpatialFact Graph、active perception 和 verifier 是否带来显著增益；若没有，定位失败模块 |

### 阶段 1：空间事实状态与长程规划

目标：验证结构化空间事实状态对长程成功率和空间错误率的增益。

实验：

1. text memory vs 2D map vs 3D semantic memory vs 3D+affordance+temporal memory。
2. 一次性 plan vs spatial hierarchical task graph。
3. skill success only vs spatial predicate verifier。

指标：

1. spatial grounding accuracy。
2. relation / reachability accuracy。
3. hidden spatial failure rate。
4. long-horizon success 和平均任务时长。

### 阶段 2：主动空间感知

目标：让系统在空间不确定时主动补充观测，而不是盲目执行或过度询问。

实验设计：

1. 场景 A：目标被遮挡，需要换视角或 inspect。
2. 场景 B：空间事实冲突，需要重新定位或请求标注。
3. 场景 C：对象可见但可达性未知，需要低风险探测。
4. 场景 D：高风险动作依赖低置信度空间事实，需要询问或暂停。

对比：

1. no-active-perception。
2. heuristic inspect。
3. learned next-best-view / active perception policy。
4. oracle active perception upper bound。

成功标准：

1. 空间错误率下降。
2. hidden spatial failure 下降。
3. unnecessary query 和 human label burden 受控。
4. 长程任务成功率提升或不下降。

### 阶段 3：长期扩展：Agentic RL 优化规划与恢复

目标：在前三项核心机制被验证后，用 RL 优化高层 agent 决策，而不是只靠 prompt 或手写规则。本阶段不属于第一篇最小实验的必要条件。

实验：

1. 训练 planner 选择 skill 和重规划时机。
2. 训练 progress checker 发现无效进展。
3. 训练 recovery policy 在感知失败、抓取失败、路径受阻时选 fallback。
4. 训练 ask-human policy 平衡自主性和风险。

对比：

1. 手写 planner。
2. LLM planner with prompt only。
3. LLM planner + trace retrieval。
4. LLM planner + Agentic RL。

成功标准：

1. 长程任务成功率提高。
2. 重复失败减少。
3. 安全拦截后恢复率提高。
4. 人类介入次数下降。

### 阶段 4：长期扩展：真实机器人闭环

目标：在受控真实环境中验证数据闭环。本阶段用于检验系统可部署性，不作为空间事实、主动感知和 verifier 三项核心贡献成立的前提。

任务：

1. 部署到一个移动操作机器人或双臂平台。
2. 每日执行固定任务集和随机任务集。
3. 记录真实失败，回流训练。
4. 每周发布新 adapter/skill 版本。
5. 对比发布前后成功率和遗忘。

成功标准：

1. 真实任务成功率逐周提升。
2. 旧任务保持稳定。
3. 安全事件为零或低于严格阈值。
4. 人类介入率下降。
5. trace 能解释主要失败原因。

## 8. 实验矩阵

| 实验 | 自变量 | 因变量 | 证明什么 |
|---|---|---|---|
| Spatial Encoding | text memory/2D map/3D semantic/3D+affordance+temporal | spatial grounding、relation accuracy、success | 空间编码是否必要 |
| Active Perception | no inspect/heuristic inspect/learned next-best-view/human label | active learning gain、query burden、hidden failure | 主动感知是否减少空间误判 |
| Spatial Verifier | skill success only/spatial predicate verifier/oracle verifier | hidden spatial failure、subgoal SR | 空间谓词验证是否必要 |
| Spatial Update | static memory/stale detector/trace-to-memory update | stale detection、repeated spatial failure | 空间更新是否减少重复失败 |
| Cross-Domain Spatial Generalization | 已知布局/新布局/新物体/新遮挡 | cross-domain SR、relation error | 空间 schema 是否泛化 |
| Safety Gate | 无 gate/软 gate/硬 gate + approval | violation、unnecessary query、success | 安全层的成本收益 |

### 8.1 最小可发表实验

第一篇论文/第一个 demo 不应同时追求跨本体、真实机器人闭环和完整在线学习。最小可发表实验应压缩为空间 Agent 的核心问题：

```text
Benchmark: RoboCasa365 或 ManiSkill-HAB 二选一
Task family: 10-20 个 household rearrangement + manipulation-like long-horizon tasks
Low-level skills: scripted or existing policy wrappers, not重新训练大 VLA
Main variable: SpatialFact Graph + active perception + spatial predicate verifier
```

系统对照：

1. Text-memory baseline：LLM 规划 + 文本上下文 + 技能调用。
2. 2D-map baseline：任务图 + 2D 拓扑/占据地图 + 技能调用。
3. 3D-semantic baseline：3D 对象语义记忆 + 技能调用。
4. ECAOS-spatial-lite：SpatialFact Graph + 空间谓词 verifier。
5. ECAOS-active：ECAOS-spatial-lite + 主动 inspect/换视角/标注请求。
6. Oracle-spatial upper bound：仿真 state 或人工 oracle 空间事实。

公平性约束：

1. 所有系统共享同一低层技能库、传感器输入、安全硬约束和 episode seed。
2. ECAOS 的优势只能来自空间表示、主动感知、空间验证和空间更新，不能来自更多低层技能。
3. baseline 不能通过冒险动作提高成功率，所有急停、禁区、近人保护和权限规则一致。
4. 空间谓词、active perception event、overblocking、human label 和安全事件使用同一 trace schema，并抽样人工审计。

核心指标：

| 指标 | 证明点 |
|---|---|
| long-horizon success | 是否真的提升任务完成 |
| spatial grounding accuracy | 是否正确绑定对象、区域和空间引用 |
| relation / reachability accuracy | 是否正确判断关系、可达性和可操作面 |
| hidden spatial failure rate | 是否减少“技能成功但空间 effect 未达成” |
| active learning gain | 主动 inspect/标注是否真的降低错误 |
| unnecessary query / human label burden | 主动学习是否被滥用 |
| safety violation / overblocking | 空间安全层是否平衡安全和可执行性 |

最小实验只需要证明一个硬命题：结构化空间事实状态 + 主动空间感知 + 空间谓词 verifier 能比文本上下文、2D map 或静态 3D semantic memory 更少空间误判、更早发现隐藏空间失败，并提升长程任务成功率。真实机器人和跨本体可以作为第二阶段。

## 9. 风险点与应对

### 9.1 Sim-to-real gap

风险：仿真中成功的 planner 或 policy 到真实世界失败。  
应对：真实数据从阶段 0 就进入 schema；仿真只作为 pretrain 和 regression，不作为唯一评估。关键技能必须在真实环境做小规模校准。

### 9.2 灾难性遗忘

风险：更新新任务后旧技能失效。  
应对：replay buffer、adapter isolation、skill versioning、旧任务 regression、routing/gating、灰度发布。

### 9.3 数据污染与低质量自训练

风险：失败轨迹或错误自动标注被当成成功数据。  
应对：trajectory diagnosis、human audit sampling、confidence threshold、失败数据单独建模，不把所有真实数据直接混入 imitation training。

### 9.4 Reward hacking

风险：Agentic RL 学会钻 reward 空子，例如反复检查进度而不执行。  
应对：多目标 reward、时间/动作成本、人工偏好评审、硬安全约束、held-out scenario eval，以及 policy audit。重点检查 verifier gaming、ask-human overuse、overblocking 和 risk transfer；若 inspect/ask-human/abort 行为分布异常漂移，即使 success rate 提升也不能上线。

### 9.5 运行时安全

风险：模型生成危险动作、工具被 prompt injection 操纵、本地服务被滥用。  
应对：能力最小化、动作 gate、工具沙箱、人工确认、日志审计、红队测试、runtime governance 外置。

### 9.6 跨本体动作空间不一致

风险：同一 skill 在不同机器人上动作定义不同。  
应对：skill-level abstraction + embodiment adapter；高层任务图共享，低层控制按本体实现；用 success predictor 做选择。

### 9.7 延迟与实时性

风险：大模型规划和 3D 记忆查询过慢，无法闭环控制。  
应对：高层低频规划，低层实时控制；缓存空间 query；小模型 progress checker；本地 safety monitor 不依赖云端模型。

## 10. 预期贡献

第一阶段主贡献收敛为三条：

1. 一个结构化空间事实状态模型：把拓扑、对象、几何、可达性、遮挡、affordance、证据、置信度和过期时间接入 Agent 决策，而不是只作为文本上下文或静态 3D memory。
2. 一个基于不确定性的主动空间感知机制：在低置信度、遮挡、关系冲突、可达性未知和高风险动作前，按信息收益、任务价值、动作成本和风险选择 inspect、换视角、低风险探测或请求标注。
3. 一个空间谓词 verifier：独立检查 `visible`、`reachable`、`on/inside/near` 等 effect 是否成立，发现“技能返回 success 但空间目标未达成”的 hidden spatial failure。

系统扩展贡献包括 skill contract、trace-to-spatial-update、runtime governance、candidate promotion 和 Agentic RL。它们服务于长期部署和持续改进，但不作为第一阶段证明 ECAOS 成立的必要贡献。

## 11. 迭代深化记录

### 第 1 轮：从“训练一个机器人模型”转向“构建空间 Agent 框架”

最初可选路线是直接微调一个 VLA 模型，提高操作成功率。但这不能解释长程失败中的空间误判、遮挡、可达性错误和状态过期问题。因此主线改为空间 Agent 框架：低层模型只是技能层，研究核心是系统如何编码、感知、验证和更新空间。

### 第 2 轮：从“记忆库”转向“空间事实状态”

普通向量记忆不足以支持具身任务。机器人需要知道物体在哪里、是否可见、是否可达、哪里被遮挡、哪个表面可放置、哪个技能对哪个对象有效。因此 ECAOS 把 memory 升级为空间事实状态：拓扑、对象、几何、可达性、affordance、时间和置信度共同构成 Agent 状态。

### 第 3 轮：从“被动感知”转向“主动空间学习”

真实世界空间状态经常不完整：遮挡、错检、过期记忆和可达性未知会直接导致长程失败。因此系统不能只被动使用当前观测，而要根据 uncertainty、expected information gain、动作成本和安全风险主动选择 inspect、换视角、低风险探测或请求标注。

### 第 4 轮：从“让 LLM 自我约束”转向“外置 runtime governance”

AutoJack 和 prompt injection 相关安全事件说明，agent 一旦连接工具和本地服务，传统信任边界会失效。具身机器人风险更高。因此安全层必须拥有独立准入权和拦截权，不能只依赖 prompt 或模型内部对齐。

## 12. 最小可发表研究问题

如果需要压缩成论文/项目的一条主线，可以聚焦：

> 在长程家居操作与导航任务中，一个用 SpatialFact Graph、主动空间感知和空间谓词验证驱动的 embodied Agent 框架，是否能比文本记忆、2D map 和静态 3D semantic memory，在空间 grounding、关系/可达性判断、隐藏空间失败率和长程成功率上显著更好？

最小实验：

1. RoboCasa365 或 Habitat 3.0 中 10-20 个长程任务，按空间关系、遮挡、可达性和动态变化分层。
2. LeRobot/OpenVLA/Octo 作为低层操作策略。
3. 对比六个系统：text-memory、2D-map、3D-semantic、ECAOS-spatial-lite、ECAOS-active、oracle-spatial upper bound。
4. 指标：success、spatial grounding、relation predicate accuracy、reachability accuracy、stale memory detection、active learning gain、hidden spatial failure、safety violation、unnecessary query。

附加约束：若研究主线扩展到跨环境、跨物体或跨本体泛化，必须分别报告 cross-domain SR、cross-object failure label、cross-embodiment delta 和 adapter admission 结果，不能用混合平均分替代。

## 13. 参考资料

1. Voyager: An Open-Ended Embodied Agent with Large Language Models, 2023. https://arxiv.org/abs/2305.16291
2. SayCan: Do As I Can, Not As I Say, 2022. https://say-can.github.io/
3. Code as Policies, 2022. https://code-as-policies.github.io/
4. RT-1: Robotics Transformer for Real-World Control at Scale, 2022. https://research.google/blog/rt-1-robotics-transformer-for-real-world-control-at-scale/
5. PaLM-E: An Embodied Multimodal Language Model, 2023. https://palm-e.github.io/
6. RT-2: Vision-Language-Action Models, 2023. https://robotics-transformer2.github.io/
7. Open X-Embodiment and RT-X, 2023. https://robotics-transformer-x.github.io/
8. Octo: An Open-Source Generalist Robot Policy, 2024. https://octo-models.github.io/
9. OpenVLA: An Open-Source Vision-Language-Action Model, 2024. https://arxiv.org/abs/2406.09246
10. DROID: A Large-Scale In-the-Wild Robot Manipulation Dataset, 2024. https://arxiv.org/abs/2403.12945
11. BridgeData V2, 2023. https://proceedings.mlr.press/v229/walke23a.html
12. π0: A Vision-Language-Action Flow Model for General Robot Control, 2024. https://arxiv.org/abs/2410.24164
13. GR00T N1: An Open Foundation Model for Generalist Humanoid Robots, 2025. https://arxiv.org/abs/2503.14734
14. Gemini Robotics-ER 1.6 official docs, 2026. https://ai.google.dev/gemini-api/docs/robotics-overview
15. LeRobot: An Open-Source Library for End-to-End Robot Learning, 2026. https://arxiv.org/html/2602.22818v1
16. HoloAgent-0: A Unified Embodied Agent Framework with 3D Spatial Memory, 2026. https://arxiv.org/abs/2606.23565
17. 3DLLM-Mem: Long-Term Spatial-Temporal Memory for Embodied Agents, 2025. https://3dllm-mem.github.io/
18. EmbodiedBench, 2025. https://embodiedbench.github.io/
19. Habitat 3.0, 2023. https://aihabitat.org/habitat3/
20. RoboCasa and RoboCasa365. https://robocasa.ai/ and https://arxiv.org/html/2603.04356v1
21. ManiSkill-HAB, 2025. https://openreview.net/forum?id=6bKEWevgSd
22. Isaac Lab, NVIDIA. https://developer.nvidia.com/isaac/lab
23. Agent Lightning, 2025. https://arxiv.org/abs/2508.03680
24. LangGraph documentation. https://docs.langchain.com/oss/python/langgraph/overview
25. Microsoft Agent Framework overview. https://learn.microsoft.com/en-us/agent-framework/overview/
26. OpenAI Agents SDK documentation. https://developers.openai.com/api/docs/guides/agents
27. CrewAI documentation. https://docs.crewai.com/
28. Preserving and combining knowledge in robotic lifelong reinforcement learning, Nature Machine Intelligence, 2025. https://www.nature.com/articles/s42256-025-00983-2
29. A Survey of Continual Reinforcement Learning, 2025. https://arxiv.org/html/2506.21872v2
30. Microsoft AutoJack security analysis, 2026. https://www.microsoft.com/en-us/security/blog/2026/06/18/autojack-single-page-rce-host-running-ai-agent/
31. OWASP LLM01 Prompt Injection. https://genai.owasp.org/llmrisk/llm01-prompt-injection/
32. Harnessing Embodied Agents: Runtime Governance for Policy-Constrained Execution, 2026. https://arxiv.org/html/2604.07833v1
33. Datasheets for Datasets, 2018. https://arxiv.org/abs/1803.09010
34. Data Cards, 2022. https://arxiv.org/abs/2204.01075
35. ROS 2 Managed Nodes. https://design.ros2.org/articles/node_lifecycle.html
