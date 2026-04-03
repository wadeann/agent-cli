# Agent CLI 用户指南

## 项目概述

Agent CLI 是一个基于 Bun + TypeScript 的 AI Agent 命令行工具，支持多模型接入、智能资源管理、工具编排、插件系统和 MCP 集成。

## 环境要求

- **Bun** >= 1.0
- **Node.js** >= 20 (如果使用 node 运行)

## 安装

```bash
cd agent-cli
bun install
```

## 配置

首次运行时会自动创建 `~/.agent-cli/config.json`。你也可以手动创建：

```bash
mkdir -p ~/.agent-cli
cat > ~/.agent-cli/config.json << 'EOF'
{
  "defaultProvider": "anthropic",
  "providers": {
    "anthropic": {
      "apiKey": "your-anthropic-api-key"
    },
    "openai": {
      "apiKey": "your-openai-api-key"
    }
  }
}
EOF
```

### 配置字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `defaultProvider` | string | 默认使用的 provider 名称 (`anthropic` / `openai`) |
| `providers.anthropic.apiKey` | string | Anthropic API Key |
| `providers.openai.apiKey` | string | OpenAI API Key |
| `providers.*.baseUrl` | string | 自定义 API 端点 (可选) |
| `providers.*.maxRetries` | number | 最大重试次数 (默认 3) |
| `providers.*.timeout` | number | 请求超时毫秒数 (默认 600000) |

## 快速开始

### 1. 发送聊天消息

```bash
# 使用默认 provider 和模型
bun run src/cli/index.ts chat "Explain TypeScript generics"

# 指定模型
bun run src/cli/index.ts chat "Write a Python script" -m claude-sonnet-4-5-20251120

# 使用 OpenAI
bun run src/cli/index.ts chat "What is Rust?" -m gpt-4o
```

### 2. 查看配置

```bash
bun run src/cli/index.ts config
```

### 3. 列出可用模型

```bash
bun run src/cli/index.ts models
```

输出示例：
```
=== anthropic ===
  claude-opus-4-5-20251120 - Claude Opus 4.5
    Context: 200,000 tokens
    Pricing: $15/M in, $75/M out
  claude-sonnet-4-5-20251120 - Claude Sonnet 4.5
    Context: 200,000 tokens
    Pricing: $3/M in, $15/M out
  claude-haiku-3-5-20250520 - Claude Haiku 3.5
    Context: 200,000 tokens
    Pricing: $0.8/M in, $4/M out

=== openai ===
  gpt-4o - GPT-4o
    Context: 128,000 tokens
    Pricing: $5/M in, $15/M out
  gpt-4o-mini - GPT-4o Mini
    Context: 128,000 tokens
    Pricing: $0.15/M in, $0.6/M out
  o1-preview - O1 Preview
    Context: 128,000 tokens
    Pricing: $15/M in, $60/M out
```

### 4. 查看帮助

```bash
bun run src/cli/index.ts --help
```

## 可用模型

### Anthropic

| 模型 ID | 上下文窗口 | 最大输出 | 能力 |
|---------|-----------|---------|------|
| `claude-opus-4-5-20251120` | 200K | 8K | vision, tools, thinking |
| `claude-sonnet-4-5-20251120` | 200K | 8K | vision, tools, thinking |
| `claude-haiku-3-5-20250520` | 200K | 8K | vision, tools |

### OpenAI

| 模型 ID | 上下文窗口 | 最大输出 | 能力 |
|---------|-----------|---------|------|
| `gpt-4o` | 128K | 16K | vision, tools |
| `gpt-4o-mini` | 128K | 16K | vision, tools |
| `o1-preview` | 128K | 32K | thinking |

## 开发命令

```bash
bun run dev          # 运行 CLI (开发模式)
bun run build        # 构建为二进制
bun run typecheck    # TypeScript 类型检查
bun run test         # 运行所有测试
bun run test:watch   # 监听模式运行测试
```

## 架构概览

```
src/
├── cli/              # CLI 入口 (commander.js)
├── providers/        # 模型抽象层
│   ├── base/         # Provider 接口和类型
│   ├── anthropic/    # Anthropic Provider
│   ├── openai/       # OpenAI Provider
│   └── factory/      # Provider 工厂
├── tools/            # 工具系统
│   ├── file/         # 文件工具 (Read/Write/Edit)
│   ├── search/       # 搜索工具 (Grep/Glob)
│   ├── execution/    # 执行工具 (Bash)
│   └── orchestrator/ # 工具编排引擎
├── harness/          # 资源管理
│   ├── TaskEstimator     # 任务复杂度估算
│   ├── ResourceAllocator # 动态资源分配
│   └── CostTracker       # 成本追踪
├── tasks/            # 任务 DAG 系统
│   ├── TaskGraph         # 任务图管理
│   ├── TaskScheduler     # 任务调度器
│   └── CheckpointManager # 检查点管理
├── plugins/          # 插件系统
│   ├── PluginManager     # 插件管理器
│   ├── PluginLoader      # 插件加载器
│   └── ExtensionPoints   # 扩展点系统
├── mcp/              # MCP 集成
│   ├── MCPClient         # MCP 客户端
│   ├── MCPServerManager  # 服务器管理器
│   └── ToolAdapter       # MCP 工具适配器
└── ui/               # 终端 UI
    ├── UIManager         # UI 状态管理
    └── TerminalRenderer  # 终端渲染器
```

## 测试覆盖

| 模块 | 测试数 | 状态 |
|------|--------|------|
| Provider 层 | 16 | ✅ |
| CLI 框架 | 4 | ✅ |
| 工具集 | 8 | ✅ |
| 资源管理 | 13 | ✅ |
| 任务 DAG | 66 | ✅ |
| 插件系统 | 55 | ✅ |
| MCP 集成 | 43 | ✅ |
| 终端 UI | 39 | ✅ |
| **总计** | **240** | **✅ 100%** |

## 扩展开发

### 添加新的 Provider

1. 在 `src/providers/` 下创建新目录
2. 继承 `BaseProvider` 实现接口
3. 在 `ProviderFactory` 中注册

```typescript
// src/providers/google/GeminiProvider.ts
import { BaseProvider } from '../base/Provider.js'

export class GeminiProvider extends BaseProvider {
  readonly providerName = 'google'
  // ... 实现接口方法
}
```

### 添加新的工具

```typescript
// src/tools/custom/MyTool.ts
import { BaseTool } from '../base.js'

export class MyTool extends BaseTool {
  readonly name = 'my-tool'
  readonly description = 'Does something useful'
  readonly category = 'execution'
  readonly readOnly = false
  readonly dangerous = false
  readonly inputSchema = { /* JSON Schema */ }

  async execute(input: unknown, context: ExecutionContext) {
    // 实现工具逻辑
    return this.success('result')
  }
}
```

### 添加插件

```typescript
import type { PluginV2 } from './plugins/types.js'

export const myPlugin: PluginV2 = {
  manifest: {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    description: 'A custom plugin'
  },
  status: 'installed',
  tools: [/* custom tools */],
  commands: [/* custom commands */],
  async onActivate(context) {
    context.logger.info('Plugin activated')
  }
}
```

## 常见问题

**Q: 如何切换默认 provider?**

编辑 `~/.agent-cli/config.json` 中的 `defaultProvider` 字段。

**Q: 支持哪些模型?**

运行 `bun run src/cli/index.ts models` 查看完整列表。

**Q: 如何自定义 API 端点?**

在配置的 provider 中添加 `baseUrl` 字段：

```json
{
  "providers": {
    "openai": {
      "apiKey": "sk-...",
      "baseUrl": "https://your-proxy.com/v1"
    }
  }
}
```
