# Agent CLI — User Guide

## 1. Quick Start

```bash
# Clone and install
git clone https://github.com/wadeann/agent-cli.git
cd agent-cli
bun install

# Configure your API keys
mkdir -p ~/.agent-cli
cat > ~/.agent-cli/config.json << 'EOF'
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
EOF
```

## 2. Basic Usage

### Single-shot Chat
```bash
# Use default model
bun run src/cli/index.ts chat "Explain TypeScript generics"

# Specify model
bun run src/cli/index.ts chat "Write a Python script" -m gpt-4o

# Use model profile
bun run src/cli/index.ts chat "Quick question" -p fast
bun run src/cli/index.ts chat "Complex architecture" -p power
```

### Configuration
```bash
# View current config
bun run src/cli/index.ts config

# Change default model
bun run src/cli/index.ts config set model gpt-4o

# Change default provider
bun run src/cli/index.ts config set provider openai

# Set API keys
bun run src/cli/index.ts config set provider.anthropic.apiKey sk-ant-...
bun run src/cli/index.ts config set provider.openai.apiKey sk-...

# Set base URL (for proxies / compatible APIs)
bun run src/cli/index.ts config set provider.openai.baseUrl https://your-proxy.com/v1
bun run src/cli/index.ts config set provider.anthropic.baseUrl https://your-proxy.com/anthropic

# Set provider timeout (milliseconds)
bun run src/cli/index.ts config set provider.anthropic.timeout 120000

# Set provider max retries
bun run src/cli/index.ts config set provider.openai.maxRetries 5

# Change profile models
bun run src/cli/index.ts config set model.fast gpt-4o-mini
bun run src/cli/index.ts config set model.power claude-opus-4-5-20251120

# List available models
bun run src/cli/index.ts models
bun run src/cli/index.ts models --json
```

### Example config.json

```json
{
  "defaultProvider": "openai",
  "defaultModel": "gpt-4o",
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-...",
      "baseUrl": "",
      "timeout": 120000,
      "maxRetries": 3
    },
    "openai": {
      "apiKey": "sk-...",
      "baseUrl": "https://your-proxy.com/v1",
      "timeout": 60000,
      "maxRetries": 3
    }
  },
  "modelPreferences": {
    "fast": "gpt-4o-mini",
    "balanced": "gpt-4o",
    "power": "claude-opus-4-5-20251120"
  }
}
```

## 3. Interactive TUI Mode

```bash
# Start interactive session
bun run src/cli/index.ts repl

# Start with specific model
bun run src/cli/index.ts repl -m gpt-4o
```

### TUI Slash Commands
```
/help              Show available commands
/clear             Clear conversation history
/memory [query]    Search or view memory stats
/compact           Compact conversation context
/cost              Show current session cost
/model <id>        Switch model
/models            List available models
/exit              Exit the REPL
```

## 4. Session Management

Sessions are automatically saved to `~/.agent-cli/sessions/`:

```typescript
import { SessionManager } from './src/cli/SessionManager.js'

const manager = new SessionManager()
await manager.initialize()

// Create new session
const session = manager.createSession('My Project')

// Add messages
manager.addMessage('user', 'Help me build a CLI tool')
manager.addMessage('assistant', 'I can help with that...')

// List sessions
const sessions = manager.listSessions()

// Switch session
manager.switchSession('session-id')

// Get history
const history = manager.getSessionHistory(10)
```

## 5. Memory System

The 4-layer memory system persists across sessions:

```typescript
import { MemoryManager } from './src/memory/MemoryManager.js'

const memory = new MemoryManager()

// Add entries to different layers
memory.addEntry('user', 'Preference', 'Prefers TypeScript', { tags: ['coding'] })
memory.addEntry('feedback', 'Style', 'Keep responses concise')
memory.addEntry('project', 'Status', 'Building CLI tool')
memory.addEntry('reference', 'API', 'https://api.example.com')

// Search memory
const results = memory.search('TypeScript')
// Returns: [{ entry, score, matchedLayer }]

// Get relevant context for prompts
const context = memory.getRelevantContext('CLI tool')

// Save to disk
await memory.saveToDisk()

// Load from disk
memory.loadFromDisk()
```

## 6. Multi-Agent Collaboration

```typescript
import { AgentCoordinator } from './src/agents/AgentCoordinator.js'

const coordinator = new AgentCoordinator()

// Register agents with roles
coordinator.registerAgent({
  id: 'planner',
  name: 'Planner',
  role: 'planner',
  capabilities: ['plan', 'analyze'],
  systemPrompt: 'You are a technical planner.'
}, async (task) => {
  // Return plan
  return 'Step 1: Design API\nStep 2: Implement\nStep 3: Test'
})

coordinator.registerAgent({
  id: 'coder',
  name: 'Coder',
  role: 'coder',
  capabilities: ['code'],
  systemPrompt: 'You are a senior developer.'
}, async (task) => {
  return 'Code implemented'
})

// Chain agents in sequence
const result = await coordinator.collaborate(
  ['planner', 'coder'],
  'Build a REST API'
)

console.log(result.success)    // true
console.log(result.steps)      // 2
console.log(result.duration)   // ms
console.log(result.output)     // Final output
```

## 7. Context Compaction

Prevent context window overflow:

```typescript
import { CompactionEngine } from './src/compaction/CompactionEngine.js'

const engine = new CompactionEngine()

// Check if compaction needed
if (engine.shouldAutoCompact(messages, 200000)) {
  const memoryContext = memory.getRelevantContext('current task')
  
  // Compact with session memory
  const result = engine.compactWithSessionMemory(
    messages,
    memoryContext,
    200000
  )
  
  console.log(`Saved ${result.tokensSaved} tokens`)
}
```

## 8. Anti-Blocking System

### Subprocess Management
```typescript
import { SubprocessManager } from './src/harness/blocking/SubprocessManager.js'

const procManager = new SubprocessManager(5)

// Spawn with timeout
const handle = await procManager.spawn('npm', ['install'], {
  timeoutMs: 60000,
  maxOutputBytes: 1024 * 1024
})

await handle.waitForExit()
console.log(handle.status) // 'completed' | 'failed' | 'timeout' | 'interrupted'

// Interrupt running process
await handle.interrupt()
```

### Circuit Breaker
```typescript
import { CircuitBreaker } from './src/harness/blocking/CircuitBreaker.js'

const breaker = new CircuitBreaker({
  maxSteps: 100,
  maxRetriesPerTask: 5,
  loopDetectionWindow: 10,
  loopThreshold: 3
})

// Record each step
const check = breaker.recordStep('edit file.ts', 'Edit')
if (check.shouldStop) {
  console.log('Circuit breaker triggered:', check.reason)
}

// Track retries
const retry = breaker.recordRetry('task-id')
if (retry.shouldStop) {
  // Task added to dead letter queue
}
```

## 9. Security

```typescript
import { SecurityValidator } from './src/security/SecurityValidator.js'

const security = new SecurityValidator()

// Validate input
const check = security.validateInput('rm -rf /')
console.log(check.valid)      // false
console.log(check.severity)   // 'critical'

// Validate commands
const cmdCheck = security.validateCommand('ls', ['-la'])
console.log(cmdCheck.valid)   // true

// Rate limiting
const rateCheck = security.checkRateLimit(1000, 0.01)
console.log(rateCheck.valid)  // true (within limits)

// Tool permissions
security.setPermission('custom-tool', {
  toolName: 'custom-tool',
  level: 'execute',
  maxInvocationsPerMinute: 10
})
```

## 10. Plugins

### Use Built-in Plugins
```typescript
import { PluginMarketplace } from './plugins/marketplace.js'

const marketplace = new PluginMarketplace()

// Search plugins
const plugins = marketplace.search('git')

// List all
const all = marketplace.list()
```

### Create Custom Plugin
```typescript
import type { PluginV2 } from './src/plugins/types.js'

export const myPlugin: PluginV2 = {
  manifest: {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    description: 'Does something useful'
  },
  status: 'installed',
  tools: [
    {
      name: 'my-tool',
      description: 'Does something',
      inputSchema: { type: 'object' }
    }
  ],
  commands: [
    {
      name: 'my-command',
      description: 'Run my command',
      handler: async (args) => {
        console.log('Running...')
      }
    }
  ],
  async onActivate(context) {
    context.logger.info('Plugin activated')
    context.storage.set('initialized', true)
  }
}
```

## 11. Error Handling & Self-Correction

```typescript
import { SelfCorrectingRecovery, ErrorReporter } from './src/context/SelfCorrectingRecovery.js'

const recovery = new SelfCorrectingRecovery()
const reporter = new ErrorReporter()

// Report error
const error = new ProviderAuthError('anthropic')
reporter.report(error)

// Analyze and get fix suggestions
const analysis = recovery.analyzeError(error)
console.log(analysis.rootCause)
console.log(analysis.suggestions)
console.log(analysis.autoFixable)

// Generate readable report
console.log(recovery.formatAnalysis(analysis))
```

## 12. Cloud Sync

```typescript
import { SyncManager } from './src/sync/SyncManager.js'

const sync = new SyncManager({
  remoteUrl: 'https://sync.example.com',
  conflictStrategy: 'local_wins',
  autoSync: true
})

// Set sync provider (implement SyncProvider interface)
sync.setProvider(mySyncProvider)

// Register local data
sync.registerLocal('config', JSON.stringify(config))
sync.registerLocal('memory', JSON.stringify(memoryData))

// Sync
const result = await sync.sync('bidirectional')
console.log(`Pushed: ${result.pushed}, Pulled: ${result.pulled}`)

// Resolve conflicts
if (result.conflicts > 0) {
  sync.resolveConflict('config', true) // use local
}
```

## 13. Performance Monitoring

```typescript
import { PerformanceMetrics } from './src/optimization/PerformanceOptimizer.js'

const metrics = new PerformanceMetrics()

// Track operations
const stop = metrics.startTimer('api-call')
// ... do work ...
const elapsed = stop()

// Track counters
metrics.increment('requests')
metrics.increment('tokens', 1500)

// Get metrics
const report = metrics.getAllMetrics()
console.log(report.timings['api-call'])
// { count, min, max, avg, p95 }
```

## 14. Shell Completions

```bash
# Bash
source completions/agent.bash

# Zsh
source completions/agent.zsh

# Fish
source completions/agent.fish
```

## 15. Docker

```bash
# Build
docker build -t agent-cli .

# Run
docker run -it agent-cli chat "Hello"
docker run -it agent-cli repl
```

## 16. CI/CD

The project includes GitHub Actions workflow (`.github/workflows/ci.yml`):
- Runs on push/PR to main
- Tests with Bun 1.0 and 1.1
- Runs typecheck and all tests

---

**Full documentation:** https://github.com/wadeann/agent-cli  
**Issues:** https://github.com/wadeann/agent-cli/issues
