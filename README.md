# Agent CLI

> A powerful AI-powered CLI tool that goes beyond Claude Code — multi-model support, intelligent resource management, tool orchestration, plugin system, MCP integration, and 4-layer memory.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.0-fbf0cf.svg)](https://bun.sh/)
[![Tests](https://img.shields.io/badge/Tests-363%20passing-brightgreen.svg)]()
[![License](https://img.shields.io/badge/License-MIT-green.svg)]()

## Features

- **Multi-Model Support** — Anthropic (Claude) and OpenAI (GPT) with a unified provider abstraction. Easy to extend for Gemini, Ollama, Groq.
- **4-Layer Memory System** — User, Feedback, Project, and Reference memory layers with Markdown persistence, TF-IDF search, and recency-weighted retrieval.
- **Context Compaction** — Auto-compact, micro-compact, session-memory compact, and history pruning to keep conversations within token budgets.
- **Tool Orchestration** — Dependency analysis, parallel/serial execution planning, timeout handling, and retry logic.
- **Task DAG System** — Directed acyclic graph task management with dependency resolution, priority scheduling, and checkpoint/restore.
- **Plugin Architecture** — Register, activate, and manage plugins with tools, commands, hooks, and extension points.
- **MCP Integration** — Model Context Protocol client and server manager for connecting to external tool servers.
- **Interactive REPL** — Slash commands (`/help`, `/memory`, `/compact`, `/cost`, `/models`, `/clear`, `/exit`) with session history.
- **Terminal UI** — State management, message rendering, progress bars, tool execution visualization, and cost summaries.
- **Resource Management** — Task complexity estimation, dynamic resource allocation, and cost tracking with budget enforcement.

## Quick Start

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Run type checking
bun run typecheck

# Run all tests
bun run test

# Build for production
bun run build
```

## Configuration

Create `~/.agent-cli/config.json`:

```json
{
  "defaultProvider": "anthropic",
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-..."
    },
    "openai": {
      "apiKey": "sk-..."
    }
  }
}
```

## Usage

```bash
# Send a chat message
bun run src/cli/index.ts chat "Explain TypeScript generics"

# Specify a model
bun run src/cli/index.ts chat "Write a Python script" -m claude-sonnet-4-5-20251120

# Use OpenAI
bun run src/cli/index.ts chat "What is Rust?" -m gpt-4o

# View configuration
bun run src/cli/index.ts config

# List available models
bun run src/cli/index.ts models
```

## Architecture

```
src/
├── cli/              # CLI entry point (commander.js)
├── providers/        # Model abstraction layer
│   ├── base/         # Provider interface & types
│   ├── anthropic/    # Anthropic Claude provider
│   ├── openai/       # OpenAI GPT provider
│   └── factory/      # Provider factory
├── tools/            # Tool system
│   ├── file/         # File tools (Read/Write/Edit)
│   ├── search/       # Search tools (Grep/Glob)
│   ├── execution/    # Execution tools (Bash)
│   └── orchestrator/ # Tool orchestration engine
├── harness/          # Resource management
│   ├── TaskEstimator     # Task complexity estimation
│   ├── ResourceAllocator # Dynamic resource allocation
│   └── CostTracker       # Cost tracking
├── tasks/            # Task DAG system
│   ├── TaskGraph         # Task graph management
│   ├── TaskScheduler     # Priority scheduling
│   └── CheckpointManager # Checkpoint/restore
├── memory/           # 4-layer memory system
│   └── MemoryManager     # User/Feedback/Project/Reference
├── compaction/       # Context compaction
│   ├── CompactionEngine  # Auto/micro/session-memory compact
│   └── TokenEstimator    # Token usage estimation
├── plugins/          # Plugin architecture
│   ├── PluginManager     # Plugin lifecycle
│   ├── PluginLoader      # Dynamic loading
│   └── ExtensionPoints   # Extension point registry
├── mcp/              # MCP integration
│   ├── MCPClient         # MCP protocol client
│   ├── MCPServerManager  # Server lifecycle
│   └── ToolAdapter       # MCP tool adapter
├── repl/             # Interactive REPL
│   ├── REPLSession       # Session management
│   └── Commands          # Slash command registry
├── ui/               # Terminal UI
│   ├── UIManager         # UI state management
│   └── TerminalRenderer  # Terminal output rendering
└── optimization/     # Performance
    └── PerformanceOptimizer # LRU cache, dedup, batch, metrics
```

## Available Models

### Anthropic

| Model | Context | Output | Capabilities |
|-------|---------|--------|-------------|
| `claude-opus-4-5-20251120` | 200K | 8K | vision, tools, thinking |
| `claude-sonnet-4-5-20251120` | 200K | 8K | vision, tools, thinking |
| `claude-haiku-3-5-20250520` | 200K | 8K | vision, tools |

### OpenAI

| Model | Context | Output | Capabilities |
|-------|---------|--------|-------------|
| `gpt-4o` | 128K | 16K | vision, tools |
| `gpt-4o-mini` | 128K | 16K | vision, tools |
| `o1-preview` | 128K | 32K | thinking |

## REPL Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/clear` | Clear conversation history |
| `/memory [query]` | Search or view memory stats |
| `/compact` | Compact conversation context |
| `/cost` | Show current session cost |
| `/models` | List available models |
| `/exit` | Exit the REPL |

## Test Coverage

| Module | Tests | Status |
|--------|-------|--------|
| Provider Layer | 16 | ✅ |
| CLI Framework | 4 | ✅ |
| Tool Set | 8 | ✅ |
| Resource Management | 13 | ✅ |
| Task DAG System | 66 | ✅ |
| MCP Integration | 43 | ✅ |
| Plugin Architecture | 55 | ✅ |
| Terminal UI | 39 | ✅ |
| 4-Layer Memory | 32 | ✅ |
| Context Compaction | 30 | ✅ |
| Interactive REPL | 22 | ✅ |
| Integration Tests | 6 | ✅ |
| Performance | 33 | ✅ |
| **Total** | **363** | **✅ 100%** |

## Extending

### Add a New Provider

```typescript
// src/providers/google/GeminiProvider.ts
import { BaseProvider } from '../base/Provider.js'

export class GeminiProvider extends BaseProvider {
  readonly providerName = 'google'
  // ... implement interface methods
}
```

Then register in `ProviderFactory`.

### Add a New Tool

```typescript
import { BaseTool } from '../tools/base.js'

export class MyTool extends BaseTool {
  readonly name = 'my-tool'
  readonly description = 'Does something useful'
  readonly category = 'execution'
  readonly readOnly = false
  readonly dangerous = false
  readonly inputSchema = { /* JSON Schema */ }

  async execute(input: unknown, context: ExecutionContext) {
    return this.success('result')
  }
}
```

### Add a Plugin

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

## License

MIT
