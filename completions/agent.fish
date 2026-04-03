# fish completion for agent CLI
complete -c agent -n "__fish_use_subcommand" -a chat -d "Send a chat message"
complete -c agent -n "__fish_use_subcommand" -a config -d "View or set configuration"
complete -c agent -n "__fish_use_subcommand" -a models -d "List available models"
complete -c agent -n "__fish_use_subcommand" -a repl -d "Start interactive TUI session"

complete -c agent -n "__fish_seen_subcommand_from chat repl" -s m -l model -d "Specify model" -a "claude-opus-4-5-20251120\tClaude\ Opus\ 4.5 claude-sonnet-4-5-20251120\tClaude\ Sonnet\ 4.5 claude-haiku-3-5-20250520\tClaude\ Haiku\ 3.5 gpt-4o\tGPT-4o gpt-4o-mini\tGPT-4o\ Mini o1-preview\tO1\ Preview"
complete -c agent -n "__fish_seen_subcommand_from chat" -s p -l profile -d "Use model profile" -a "fast\tFast\ model balanced\tBalanced\ model power\tPower\ model"

complete -c agent -n "__fish_seen_subcommand_from config" -a set -d "Set configuration value"
complete -c agent -n "__fish_seen_subcommand_from config set" -a "provider model model.fast model.balanced model.power"
