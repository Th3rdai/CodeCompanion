# Claude Code automation (this repo)

Implemented from the **claude-automation-recommender** plan: skills, agents, hooks, and optional MCP servers.

## Layout

| Path | Purpose |
|------|---------|
| `.claude/settings.json` | **Hooks**: PreToolUse (sensitive files), PostToolUse (unit tests) |
| `.claude/hooks/*.sh` | Bash scripts (require **bash**, **jq**, **npm** on PATH) |
| `.claude/skills/*/SKILL.md` | Project skills — `/code-companion-conventions`, `/release-desktop` |
| `.claude/agents/*.md` | Subagents — `security-pass`, `mcp-contract-check` |
| `.claude/commands/` | Slash commands (e.g. `validate-project`) |
| `.mcp.json.example` | Optional MCP servers for **Claude Code** (copy or merge) |

**Git:** `.claude/` is listed in `.gitignore` so local-only Claude files stay untracked. **Team-shared** files under `.claude/` are committed with `git add -f <path>`. Add the same for any new hook/skill you want in the repo.

## Hooks

- **PreToolUse** (`Edit|Write`): `block-sensitive-files.sh` — **deny** `.env*`, `cert/*.key`, `server.key`; **ask** before `.cc-config.json`.
- **PostToolUse** (`Edit|Write`): `run-unit-tests.sh` — runs `FORCE_HTTP=1 npm run test:unit` when edited paths under `lib/`, `server.js`, or `mcp/` (non-fatal).

If hooks do not run, ensure Claude Code’s **working directory** is the repo root (where `package.json` and `server.js` live).

## Skills

- **`code-companion-conventions`** — Canonical pointers (CLAUDE.md, BUILD.md, design-system, MCP PATH). Invoke when doing large refactors.
- **`release-desktop`** — Desktop release checklist (`disable-model-invocation: true`, human-driven).

## Subagents

- **`security-pass`** — OWASP / Security pentest scope.
- **`mcp-contract-check`** — Tool registrations vs `tool-call-handler` / builtin tools.

## MCP servers (optional)

Copy `/.mcp.json.example` to `/.mcp.json` and adjust, **or** use CLI:

```bash
claude mcp add context7 -- npx -y @upstash/context7-mcp
claude mcp add playwright -- npx -y @playwright/mcp@latest
```

**Context7** may require an API key — see [Context7 docs](https://context7.com/docs/resources/developer). Set **`CONTEXT7_API_KEY`** in your environment if prompted.

**Playwright** MCP installs browser binaries on first use; ensure network access for `npx`.

## Plugins (manual)

Not stored in-repo. Install from the Claude Code plugin marketplace if desired:

- **anthropic-agent-skills** — general productivity skills bundle
- **frontend-design** — UI polish aligned with design systems

## References

- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [Skills](https://code.claude.com/en/skills)
- [Subagents](https://code.claude.com/en/sub-agents)
