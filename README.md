# Agent CLI

> A powerful AI-powered CLI tool that goes beyond Claude Code — multi-model support, intelligent resource management, tool orchestration, plugin system, MCP integration, 4-layer memory, multi-agent collaboration, and anti-blocking harness.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.0-fbf0cf.svg)](https://bun.sh/)
[![Tests](https://img.shields.io/badge/Tests-598%20passing-brightgreen.svg)]()
[![License](https://img.shields.io/badge/License-MIT-green.svg)]()

## Features

### Core
- **Multi-Model Support** — Anthropic (Claude) and OpenAI (GPT) with unified provider abstraction. Easy to extend for Gemini, Ollama, Groq.
- **Model Profiles** — Switch between fast/balanced/power presets. Configure per-provider models in `config.json`.
- **Interactive TUI** — Full-screen terminal UI with scrolling messages, input bar, streaming status, and cost display.
- **REPL Mode** — `agent repl` for interactive sessions with slash commands.

### Intelligence
- **4-Layer Memory System** — User, Feedback, Project, and Reference memory layers with Markdown persistence, TF-IDF search, and recency-weighted retrieval.
- **Context Compaction** — Auto-compact, micro-compact, session-memory compact, and history pruning to keep conversations within token budgets.
- **Tool Orchestration** — Dependency analysis, parallel/serial execution planning, timeout handling, and retry logic.

### Collaboration
- **Multi-Agent Framework** — MessageBus for async pub/sub, AgentCoordinator for task dispatch, role-based agents (planner/coder/reviewer/tester).
- **Task DAG System** — Directed acyclic graph task management with dependency resolution, priority scheduling, and checkpoint/restore.
- **Plugin Architecture** — Register, activate, and manage plugins with tools, commands, hooks, and extension points.

### Infrastructure
- **MCP Integration** — Model Context Protocol client and server manager for connecting to external tool servers.
- **Anti-Blocking Harness** — Subprocess streaming with SIGINT interrupt, parallel function calling, circuit breaker with loop detection, Router-Worker pub/sub, dead letter queue.
- **Security Hardening** — Input validation, command allowlist/denylist, tool permission scopes, rate limiting (requests/tokens/cost), cost-per-hour caps.
- **Resource Management** — Task complexity estimation, dynamic resource allocation, and cost tracking with budget enforcement.
- **Performance Optimization** — LRU caching, message deduplication, batch processing, debouncing, metrics collection.

## Quick Start

```bash
bun install
bun run dev          # CLI mode
bun run repl         # Interactive TUI mode
bun run typecheck    # Type checking
bun run test         # Run all tests (513 tests)
bun run build        # Production build
```

## Configuration

Create `~/.agent-cli/config.json`:

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-5-20251120",
  "providers": {
    "anthropic": { "apiKey": "sk-ant-..." },
    "openai": { "apiKey": "sk-..." }
  },
  "modelPreferences": {
    "fast": "claude-haiku-3-5-20250520",
    "balanced": "claude-sonnet-4-5-20251120",
    "power": "claude-opus-4-5-20251120"
  }
}
```

## Usage

```bash
# Single-shot CLI
agent chat "Explain TypeScript generics"
agent chat "Write a Python script" -m gpt-4o
agent chat "Hello" -p fast        # Use fast model profile
agent chat "Hello" -p balanced    # Use balanced model profile
agent chat "Hello" -p power       # Use power model profile

# Interactive TUI
agent repl                        # Start interactive session
agent repl -m gpt-4o             # Start with specific model

# Configuration
agent config                      # View current config
agent config set model gpt-4o     # Change default model
agent config set provider openai  # Change default provider
agent config set model.fast gpt-4o-mini  # Change fast profile model

# Models
agent models                      # List all available models
agent models --json              # JSON output
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
├── harness/          # Resource management + anti-blocking
│   ├── TaskEstimator     # Task complexity estimation
│   ├── ResourceAllocator # Dynamic resource allocation
│   ├── CostTracker       # Cost tracking
│   └── blocking/         # Anti-blocking system
│       ├── SubprocessManager    # Non-blocking subprocess + SIGINT
│       ├── ParallelFunctionCaller # Concurrent tool execution
│       ├── CircuitBreaker       # Loop detection + step limits
│       └── RouterWorker         # Pub/sub task dispatch
├── tasks/            # Task DAG system
│   ├── TaskGraph         # Task graph management
│   ├── TaskScheduler     # Priority scheduling
│   └── CheckpointManager # Checkpoint/restore
├── memory/           # 4-layer memory system
│   └── MemoryManager     # User/Feedback/Project/Reference
├── compaction/       # Context compaction
│   ├── CompactionEngine  # Auto/micro/session-memory compact
│   └── TokenEstimator    # Token usage estimation
├── agents/           # Multi-agent collaboration
│   ├── MessageBus        # Async pub/sub messaging
│   └── AgentCoordinator  # Task dispatch + chain collaboration
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
├── tui/              # Terminal UI
│   ├── TUIRenderer       # Full-screen ANSI rendering
│   └── TUIREPL           # Interactive TUI session
├── ui/               # UI state management
│   ├── UIManager         # UI state management
│   └── TerminalRenderer  # Terminal output rendering
├── security/         # Security hardening
│   └── SecurityValidator # Input validation, rate limiting
├── context/          # Self-improving context system
│   ├── ProjectContext      # Persistent memory across sessions
│   ├── SmartContext        # Context-aware compaction
│   ├── InteractiveRefiner  # Try-fail-adjust feedback loop
│   └── SelfCorrectingRecovery # Auto error analysis + fix suggestions
├── sync/             # Cloud sync
│   └── SyncManager       # Bidirectional sync, conflict resolution
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
| `/model <id>` | Switch model |
| `/models` | List available models |
| `/exit` | Exit the REPL |

## Test Coverage

| Module | Tests | Status |
|--------|-------|--------|
| Provider Layer | 16 | ✅ |
| CLI Framework | 5 | ✅ |
| Tool Set | 8 | ✅ |
| Resource Management | 13 | ✅ |
| Task DAG System | 66 | ✅ |
| MCP Integration | 43 | ✅ |
| Plugin Architecture | 55 | ✅ |
| Terminal UI | 39 | ✅ |
| 4-Layer Memory | 32 | ✅ |
| Context Compaction | 30 | ✅ |
| Interactive REPL | 22 | ✅ |
| Integration Tests | 11 | ✅ |
| Performance | 33 | ✅ |
| Anti-Blocking | 59 | ✅ |
| Multi-Agent | 29 | ✅ |
| Security | 23 | ✅ |
| Cloud Sync | 17 | ✅ |
| Benchmarks + E2E | 21 | ✅ |
| Error Handling | 20 | ✅ |
| Context System | 64 | ✅ |
| Shell Completions | — | ✅ |
| CI/CD + Docker | — | ✅ |
| **Total** | **598** | **✅ 100%** |

## Extending

### Add a New Provider

```typescript
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

### Add an Agent

```typescript
import { AgentCoordinator } from './agents/AgentCoordinator.js'

const coordinator = new AgentCoordinator()

coordinator.registerAgent({
  id: 'code-reviewer',
  name: 'Code Reviewer',
  role: 'reviewer',
  capabilities: ['review', 'suggest'],
  systemPrompt: 'You are a code reviewer.'
}, async (task) => {
  // Review code and return result
  return 'Code looks good!'
})
```

## License

MIT
