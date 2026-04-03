// CLI入口点

import { Command } from 'commander'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { getGlobalFactory } from '../providers/factory/ProviderFactory.js'
import type { ProviderConfig } from '../providers/base/Provider.js'
import { TUIREPL } from '../tui/TUIREPL.js'

const program = new Command()
const CONFIG_DIR = join(homedir(), '.agent-cli')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

interface ModelPreference {
  fast?: string
  balanced?: string
  power?: string
}

interface CLIConfig {
  defaultProvider: string
  defaultModel?: string
  providers: Record<string, ProviderConfig>
  modelPreferences?: ModelPreference
}

function loadConfig(): CLIConfig {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true })
  if (!existsSync(CONFIG_FILE)) {
    const defaultConfig: CLIConfig = {
      defaultProvider: 'anthropic',
      defaultModel: 'claude-sonnet-4-5-20251120',
      providers: {
        anthropic: {},
        openai: {}
      },
      modelPreferences: {
        fast: 'claude-haiku-3-5-20250520',
        balanced: 'claude-sonnet-4-5-20251120',
        power: 'claude-opus-4-5-20251120'
      }
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2))
    return defaultConfig
  }
  return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
}

function saveConfig(config: CLIConfig): void {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
}

export { saveConfig }

async function initialize(): Promise<void> {
  const config = loadConfig()
  const factory = getGlobalFactory()

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    const type = name as 'anthropic' | 'openai'
    await factory.create(name, type, providerConfig)
  }

  if (!factory.get(config.defaultProvider)) {
    console.error(`Provider ${config.defaultProvider} not configured`)
    process.exit(1)
  }
}

function resolveModel(model?: string): { provider: string; modelId: string } {
  const config = loadConfig()

  if (model && model.includes(':')) {
    const [provider, modelId] = model.split(':')
    return { provider, modelId }
  }

  if (model) {
    return { provider: config.defaultProvider, modelId: model }
  }

  if (config.defaultModel) {
    return { provider: config.defaultProvider, modelId: config.defaultModel }
  }

  return { provider: config.defaultProvider, modelId: 'claude-sonnet-4-5-20251120' }
}

async function chat(prompt: string, model?: string): Promise<void> {
  const { provider: providerName, modelId } = resolveModel(model)
  const factory = getGlobalFactory()

  const provider = factory.get(providerName)
  if (!provider) {
    console.error(`Provider ${providerName} not configured. Run: agent config set provider ${providerName}`)
    process.exit(1)
  }

  if (!provider.isModelAvailable(modelId)) {
    console.error(`Model ${modelId} not available on ${providerName}`)
    console.log('Available models:')
    for (const m of provider.listModels()) {
      console.log(`  ${m.id}`)
    }
    process.exit(1)
  }

  const response = await provider.chat(
    [{ role: 'user', content: prompt }],
    { model: modelId }
  )

  console.log(response.content)
}

// 命令定义
program
  .name('agent')
  .description('AI Agent CLI - 智能开发助手')
  .version('0.1.0')

program
  .command('chat <prompt>')
  .description('发送聊天消息')
  .option('-m, --model <model>', '指定模型 (格式: model-id 或 provider:model-id)')
  .option('-p, --profile <profile>', '使用预设模型: fast, balanced, power')
  .action(async (prompt: string, options: { model?: string; profile?: string }) => {
    await initialize()
    const config = loadConfig()
    let model = options.model

    if (options.profile && config.modelPreferences) {
      model = config.modelPreferences[options.profile as keyof typeof config.modelPreferences]
      if (!model) {
        console.error(`Unknown profile: ${options.profile}. Use: fast, balanced, power`)
        process.exit(1)
      }
    }

    await chat(prompt, model)
  })

program
  .command('config')
  .description('查看配置')
  .action(() => {
    const config = loadConfig()
    console.log(JSON.stringify(config, null, 2))
  })

program
  .command('config set <key> <value>')
  .description('设置配置项')
  .action((key: string, value: string) => {
    const config = loadConfig()
    if (key === 'provider') {
      config.defaultProvider = value
    } else if (key === 'model') {
      config.defaultModel = value
    } else if (key.startsWith('model.')) {
      const profile = key.split('.')[1]
      if (!config.modelPreferences) config.modelPreferences = {}
      config.modelPreferences[profile as keyof ModelPreference] = value
    } else if (key.startsWith('provider.')) {
      const parts = key.split('.')
      const providerName = parts[1]
      const setting = parts[2]
      if (!config.providers[providerName]) config.providers[providerName] = {}
      if (setting === 'apiKey') {
        config.providers[providerName].apiKey = value
      } else if (setting === 'baseUrl') {
        config.providers[providerName].baseUrl = value
      } else if (setting === 'timeout') {
        config.providers[providerName].timeout = parseInt(value, 10)
      } else if (setting === 'maxRetries') {
        config.providers[providerName].maxRetries = parseInt(value, 10)
      } else {
        console.error(`Unknown provider setting: ${setting}`)
        console.log('Available settings: apiKey, baseUrl, timeout, maxRetries')
        process.exit(1)
      }
    } else {
      console.error(`Unknown config key: ${key}`)
      console.log('Available keys:')
      console.log('  provider                    - Set default provider')
      console.log('  model                       - Set default model')
      console.log('  model.fast|balanced|power   - Set profile model')
      console.log('  provider.<name>.apiKey      - Set provider API key')
      console.log('  provider.<name>.baseUrl     - Set provider base URL')
      console.log('  provider.<name>.timeout     - Set provider timeout (ms)')
      console.log('  provider.<name>.maxRetries  - Set provider max retries')
      process.exit(1)
    }
    saveConfig(config)
    console.log(`Set ${key} = ${value}`)
  })

program
  .command('models')
  .description('列出可用模型')
  .option('-j, --json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    await initialize()
    const factory = getGlobalFactory()
    const config = loadConfig()
    const allModels: Array<{ id: string; name: string; provider: string; current: boolean }> = []

    for (const name of factory.list()) {
      const provider = factory.get(name)!
      for (const model of provider.listModels()) {
        const isCurrent = config.defaultModel === model.id
        allModels.push({ id: model.id, name: model.name, provider: name, current: isCurrent })
      }
    }

    if (options.json) {
      console.log(JSON.stringify(allModels, null, 2))
      return
    }

    console.log(`Default: ${config.defaultModel}\n`)
    for (const m of allModels) {
      const marker = m.current ? ' ★' : ''
      console.log(`  ${m.id} - ${m.name} [${m.provider}]${marker}`)
      console.log(`    Context: ${m.id.includes('opus') || m.id.includes('sonnet') || m.id.includes('haiku') ? '200K' : '128K'} tokens`)
    }
    console.log('\nSwitch model: agent config set model <model-id>')
    console.log('Use profile:  agent chat "hello" -p fast|balanced|power')
  })

program
  .command('repl')
  .description('Start interactive TUI session')
  .option('-m, --model <model>', '指定模型')
  .action(async (options: { model?: string }) => {
    await initialize()
    const config = loadConfig()
    const factory = getGlobalFactory()
    const provider = factory.get(config.defaultProvider)!
    const modelId = options.model ?? config.defaultModel ?? provider.listModels()[0]?.id

    const repl = new TUIREPL({
      provider,
      model: modelId,
      title: `Agent CLI — ${config.defaultProvider}`
    })

    repl.start()
  })

const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('AI Agent CLI v0.1.0')
  console.log('Usage:')
  console.log('  agent chat "your prompt"')
  console.log('  agent chat "hello" -m gpt-4o')
  console.log('  agent chat "hello" -p fast|balanced|power')
  console.log('  agent repl              # Interactive TUI mode')
  console.log('  agent models')
  console.log('  agent config')
  console.log('  agent config set provider openai')
  console.log('  agent config set model gpt-4o')
  console.log('  agent config set provider.anthropic.apiKey sk-ant-...')
  console.log('  agent config set provider.openai.baseUrl https://proxy.example.com/v1')
} else {
  program.parse(process.argv)
}
