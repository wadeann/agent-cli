// CLI入口点

import { Command } from 'commander'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { getGlobalFactory } from '../providers/factory/ProviderFactory.js'
import type { ProviderConfig } from '../providers/base/Provider.js'

const program = new Command()
const CONFIG_DIR = join(homedir(), '.agent-cli')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

interface CLIConfig {
  defaultProvider: string
  providers: Record<string, ProviderConfig>
}

function loadConfig(): CLIConfig {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true })
  if (!existsSync(CONFIG_FILE)) {
    const defaultConfig: CLIConfig = {
      defaultProvider: 'anthropic',
      providers: {}
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

async function chat(prompt: string, model?: string): Promise<void> {
  const config = loadConfig()
  const factory = getGlobalFactory()
  const providerName = model?.split(':')[0] ?? config.defaultProvider
  const modelId = model ?? 'claude-sonnet-4-5-20251120'
  
  const provider = factory.get(providerName)
  if (!provider) {
    console.error(`Provider ${providerName} not found`)
    process.exit(1)
  }
  
  if (!provider.isModelAvailable(modelId)) {
    console.error(`Model ${modelId} not available`)
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
  .option('-m, --model <model>', '指定模型', '')
  .action(async (prompt: string, options: { model?: string }) => {
    await initialize()
    await chat(prompt, options.model)
  })

program
  .command('config')
  .description('查看配置')
  .action(() => {
    const config = loadConfig()
    console.log(JSON.stringify(config, null, 2))
  })

program
  .command('models')
  .description('列出可用模型')
  .action(async () => {
    await initialize()
    const factory = getGlobalFactory()
    for (const name of factory.list()) {
      const provider = factory.get(name)!
      console.log(`\n=== ${name} ===`)
      for (const model of provider.listModels()) {
        console.log(`  ${model.id} - ${model.name}`)
        console.log(`    Context: ${model.contextWindow.toLocaleString()} tokens`)
        console.log(`    Pricing: $${model.pricing.inputPer1M}/M in, $${model.pricing.outputPer1M}/M out`)
      }
    }
  })

const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('AI Agent CLI v0.1.0')
  console.log('使用 agent --help 查看帮助')
} else {
  program.parse(process.argv)
}
