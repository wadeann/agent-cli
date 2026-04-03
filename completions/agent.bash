# bash completion for agent CLI
_agent() {
  local cur prev opts
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"

  opts="chat config models repl --help --version"
  models="claude-opus-4-5-20251120 claude-sonnet-4-5-20251120 claude-haiku-3-5-20250520 gpt-4o gpt-4o-mini o1-preview"
  profiles="fast balanced power"

  case "${prev}" in
    -m|--model)
      COMPREPLY=($(compgen -W "${models}" -- ${cur}))
      return 0
      ;;
    -p|--profile)
      COMPREPLY=($(compgen -W "${profiles}" -- ${cur}))
      return 0
      ;;
    chat)
      COMPREPLY=($(compgen -W "-m -p --model --profile" -- ${cur}))
      return 0
      ;;
    repl)
      COMPREPLY=($(compgen -W "-m --model" -- ${cur}))
      return 0
      ;;
    config)
      COMPREPLY=($(compgen -W "set" -- ${cur}))
      return 0
      ;;
    set)
      COMPREPLY=($(compgen -W "provider model model.fast model.balanced model.power" -- ${cur}))
      return 0
      ;;
  esac

  COMPREPLY=($(compgen -W "${opts}" -- ${cur}))
  return 0
}

complete -F _agent agent
