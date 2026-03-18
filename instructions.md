# Janki -- Claude Code Configuration Guide

Complete reference for the `.claude/` configuration in this repository.

## Overview

The `.claude/` folder configures Claude Code for Janki, a personal Windows desktop app for learning Japanese built with Tauri 2.x + Svelte 5. It contains skills (reusable workflows), agents (specialized personas), rules (conditional instructions), settings, and shared agent memory.

## Quick Reference

| Action | Command |
|--------|---------|
| Plan a new project | Say "plan repo" |
| Initialize Claude Code config | Say "initialize repo" |
| Update to latest practices | Say "update practices" |
| Plan a feature | Say "spec developer" |
| Run code review | Say "code review" |
| Run security audit | Say "security scan" |
| Check performance | Say "performance review" |
| Audit dependencies | Say "dependency audit" |
| Generate tests | Say "scaffold tests" |
| Sync documentation | Say "sync docs" |
| Generate diagram | Say "mermaid diagram" |
| Add LL-G lesson | Say "add lesson" |

## Folder Structure

```
.claude/
  agents/                    # Custom agent definitions
    architect.md             # Planning, architecture (opus, skills: plan-repo, spec-developer)
    reviewer.md              # Code review (sonnet, context: patterns.md + guardrails)
    security.md              # Security analysis (opus, isolation: worktree)
    performance.md           # Performance analysis (sonnet)
    explorer.md              # Research and exploration (sonnet)
  rules/                     # Conditional instructions (globs frontmatter)
    commit-changelog.md      # Changelog + version bump on git commit
    llg-check.md             # LL-G check before code edits (src/**, src-tauri/**)
    bp-check.md              # BP check before config work (CLAUDE.md, .claude/**)
    frontend.md              # Svelte 5 component conventions (src/**/*.svelte, *.ts, *.css)
    database.md              # SQLite + tauri-plugin-sql conventions (src/lib/db/**)
    tests.md                 # Vitest testing conventions (**/*.test.*, **/*.spec.*)
  skills/                    # Executable skill definitions
    plan-repo/SKILL.md       # Stack planning (opus)
    init-repo/SKILL.md       # Repo initialization (opus)
    spec-developer/SKILL.md  # Feature spec generation (opus)
    code-review/SKILL.md     # Code review (sonnet, fork)
    security-scan/SKILL.md   # Security audit (opus, fork)
    performance-review/SKILL.md   # Performance analysis (sonnet, fork)
    dependency-audit/SKILL.md     # Dependency audit (sonnet, fork)
    test-scaffold/SKILL.md        # Test generation (sonnet)
    doc-sync/SKILL.md             # Documentation sync (sonnet, fork)
    mermaid-diagram/SKILL.md      # Diagram generation (sonnet)
    update-practices/SKILL.md     # Best practice updates (sonnet)
    add-lesson/SKILL.md           # LL-G contribution (haiku)
  references/
    infrastructure.md        # Desktop app architecture (Tauri, SQLite, no cloud)
    design-guardrails.md     # UI rules, SRS colors, typography, accessibility
    tools.md                 # CLI tools with install commands and usage
    source-urls.md           # URL registry for fetching best practices
  agent-memory/              # Version-controlled shared knowledge
    README.md                # Agent memory conventions
    decisions.md             # Architectural decisions and rationale
    debugging.md             # Known gotchas and failed approaches
    patterns.md              # Discovered code patterns
  scripts/
    check-changelog-staged.sh  # Pre-commit hook script
  settings.json              # Project-level Claude Code settings
  settings.local.json.example  # Template for personal overrides
  bp-audit.md                # BP best practices audit results
CLAUDE.md                    # Master project rules (180 lines)
agents.md                    # Agent registry
instructions.md              # This file
README.md                    # GitHub-facing README
llms.txt                     # Machine-readable project index
tasks/                       # Saved plans and specs
  plan-repo.md               # Full development plan (4 phases)
```

## Skills

Skills are reusable workflows in `.claude/skills/<name>/SKILL.md`.

| Skill | Model | Context | Trigger |
|-------|-------|---------|---------|
| plan-repo | opus | -- | "plan repo" |
| init-repo | opus | -- | "initialize repo" |
| spec-developer | opus | -- | "spec developer" |
| code-review | sonnet | fork | "code review" |
| security-scan | opus | fork | "security scan" |
| performance-review | sonnet | fork | "performance review" |
| dependency-audit | sonnet | fork | "dependency audit" |
| test-scaffold | sonnet | -- | "scaffold tests" |
| doc-sync | sonnet | fork | "sync docs" |
| mermaid-diagram | sonnet | -- | "mermaid diagram" |
| update-practices | sonnet | -- | "update practices" |
| add-lesson | haiku | -- | "add lesson" |

### Skill Frontmatter Fields

| Field | Purpose |
|-------|---------|
| `model: haiku\|sonnet\|opus` | Which model runs the skill. haiku=step-by-step, sonnet=analysis, opus=planning |
| `context: fork` | Run in isolated subagent context (prevents context pollution) |
| `disable_model_invocation: true` | Prevents auto-loading; invoke manually only |
| `agent: <name>` | Bind skill to a specific agent persona |
| `allowed-tools` | Restrict which tools the skill can use |
| `argument-hint` | Describe expected arguments |

## Agents

Agents are spawned automatically or via the Agent tool. Registered in [agents.md](agents.md).

| Agent | Model | Enhancements | Purpose |
|-------|-------|--------------|---------|
| architect | opus | skills: plan-repo, spec-developer | Planning, architecture, tech decisions |
| reviewer | sonnet | context: reviews against patterns.md + guardrails | Code review, quality |
| security | opus | isolation: worktree | Vulnerability analysis in isolated copy |
| performance | sonnet | -- | Bottleneck identification |
| explorer | sonnet | -- | Research, docs, codebase exploration |

### Agent Frontmatter Fields

| Field | Purpose |
|-------|---------|
| `model` | Which model runs the agent |
| `permissionMode: plan` | Agent can read but not write |
| `background: true` | Run without blocking main session |
| `isolation: worktree` | Run in isolated git worktree |
| `context: <text>` | Additional instructions for the agent |
| `skills: [skill1, skill2]` | Skills the agent can invoke |
| `maxTurns: N` | Cap agentic iterations (budget) |
| `effort` | Set model effort level |
| `disallowedTools` | Block specific tools |

## Path-Scoped Rules

Rules in `.claude/rules/*.md` load conditionally based on file glob patterns.

| Rule File | Triggers On | Purpose |
|-----------|-------------|---------|
| `commit-changelog.md` | git commits | Changelog + version bump enforcement |
| `llg-check.md` | `src/**`, `src-tauri/**`, `data/**` | LL-G check before code edits |
| `bp-check.md` | `CLAUDE.md`, `.claude/**`, config files | BP check before config work |
| `frontend.md` | `src/**/*.svelte`, `src/**/*.ts`, `src/**/*.css` | Svelte 5 + shadcn-svelte conventions |
| `database.md` | `src/lib/db/**`, `src-tauri/**` | SQLite + tauri-plugin-sql conventions |
| `tests.md` | `**/*.test.*`, `**/*.spec.*`, `**/test/**` | Vitest testing conventions |

## Hooks

Configured in `.claude/settings.json`.

| Event | Matcher | Type | Action |
|-------|---------|------|--------|
| PreToolUse | `Bash(git commit*)` | command | Check changelog is staged |
| PreToolUse | `Bash(rm -rf*)` | prompt | LLM safety check on destructive deletes |
| PostToolUse | `Edit\|Write` | command | Auto-format with Biome on .svelte/.ts/.js/.json |
| Stop | (all) | command | Bell notification |
| Notification | (all) | command | Bell notification |

### Hook Types

| Type | Description |
|------|-------------|
| `command` | Shell command. Exit 0 = allow, 2 = block (PreToolUse) |
| `http` | POST to URL. Requires `allowedHttpHookUrls` in settings |
| `prompt` | Single-turn LLM yes/no judgment |
| `agent` | Multi-turn subagent with tool access |

## Settings

### settings.json (shared, version-controlled)

- `permissions.allow` -- Auto-approved: Read, Glob, Grep, WebFetch, WebSearch
- `permissions.deny` -- Blocked: SSH, AWS, Azure, Kube, Docker, npm, git creds, env files, keys
- `env.ENABLE_TOOL_SEARCH` -- Lazy-load MCP tools (saves ~10% baseline context)
- `plansDirectory` -- Plans saved to `tasks/`

### settings.local.json (personal, git-ignored)

Create from `.claude/settings.local.json.example` for personal overrides:

```json
{
  "disableAllHooks": false,
  "alwaysThinkingEnabled": true,
  "language": "en"
}
```

## Knowledge Base Integration

### LL-G (RULE 1) -- What NOT to Do

Before writing code, fetch the LL-G index and load relevant HIGH-severity entries. Contribute discoveries back via `/add-lesson`. Technologies relevant to Janki: TypeScript, Tailwind CSS, Svelte, Tauri.

### BP (RULE 3) -- What TO Do

Before config/tooling work, fetch the BP index and load FOUNDATIONAL + RECOMMENDED entries. Use `/add-dir C:\Github\BP` for local access.

## Hierarchical CLAUDE.md

| File | Scope | Status |
|------|-------|--------|
| Root `CLAUDE.md` | Project-wide rules, stack, RULE 0/1/3 | Exists (180 lines) |
| `src/CLAUDE.md` | Svelte 5 frontend conventions | Planned (Phase 1) |
| `src-tauri/CLAUDE.md` | Tauri/Rust backend conventions | Planned (Phase 1) |

## Development Workflow

1. **Plan:** `plan-repo` or `spec-developer` to create plans in `tasks/`
2. **Check:** LL-G (RULE 1) + BP (RULE 3) before writing code
3. **Build:** Execute plans in a fresh session
4. **Review:** `code-review`, `security-scan`, `performance-review`
5. **Learn:** Route gotchas to LL-G via `/add-lesson`, update agent memory

## Context Management

- Use `/compact` at ~50% context
- Start fresh conversations for unrelated topics
- Plan in one session, execute in another
- Use `/handoff` before ending complex sessions
- Break tasks to complete in under 50% context

## Adding New Components

### New Skill

1. Create `.claude/skills/<name>/SKILL.md` with YAML frontmatter
2. Add `model`, `context: fork`, `allowed-tools` as needed
3. Update CLAUDE.md skill table and this file

### New Agent

1. Create `.claude/agents/<name>.md` with YAML frontmatter
2. Register in `agents.md`
3. Update CLAUDE.md agent list

### New Rule

1. Create `.claude/rules/<name>.md` with `globs` frontmatter
2. Rules auto-load when editing matching files

## Troubleshooting

- **Skill not triggering:** Check `user-invocable: true` in SKILL.md frontmatter
- **Agent not found:** Ensure registered in `agents.md`
- **Settings not applied:** Hierarchy: CLI flags > settings.local.json > settings.json > global
- **Hooks not running:** Verify event name and matcher in settings.json
- **Context overload:** Use `/compact`, break into smaller tasks, or fresh session
