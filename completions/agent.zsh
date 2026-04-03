# zsh completion for agent CLI
#compdef agent

_agent() {
  local -a commands models profiles config_keys

  commands=(
    'chat:Send a chat message'
    'config:View or set configuration'
    'models:List available models'
    'repl:Start interactive TUI session'
  )

  models=(
    'claude-opus-4-5-20251120:Claude Opus 4.5'
    'claude-sonnet-4-5-20251120:Claude Sonnet 4.5'
    'claude-haiku-3-5-20250520:Claude Haiku 3.5'
    'gpt-4o:GPT-4o'
    'gpt-4o-mini:GPT-4o Mini'
    'o1-preview:O1 Preview'
  )

  profiles=(
    'fast:Fast model for quick responses'
    'balanced:Balanced model for general use'
    'power:Most capable model for complex tasks'
  )

  config_keys=(
    'provider:Set default provider'
    'model:Set default model'
    'model.fast:Set fast model'
    'model.balanced:Set balanced model'
    'model.power:Set power model'
  )

  _arguments -C \
    '1: :->command' \
    '2: :->subcommand' \
    '*:: :->args'

  case $state in
    command)
      _describe 'commands' commands
      ;;
    subcommand)
      case $words[1] in
        chat)
          _arguments \
            '-m[Specify model]:model:($models)' \
            '-p[Use model profile]:profile:($profiles)' \
            ':prompt:_message "Enter your prompt"'
          ;;
        config)
          _describe 'config keys' config_keys
          ;;
        repl)
          _arguments \
            '-m[Specify model]:model:($models)'
          ;;
        models)
          _arguments '--json[Output as JSON]'
          ;;
      esac
      ;;
    args)
      case $words[1] in
        chat)
          _message "Enter your prompt"
          ;;
      esac
      ;;
  esac
}

_agent "$@"
