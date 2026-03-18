# CLI Tools Reference

Claude Code reads this file to know which CLI tools are available and how to use them. When a command fails because a tool is missing, check this file for the install command and offer to install it.

## How This File Works

- **init-repo** and **plan-repo** populate this file based on the detected/chosen stack.
- Each tool entry includes: install command, version check, and common usage.
- Claude Code should check `<tool> --version` before assuming a tool is available.
- If a tool is missing and needed, ask the user before installing.

## Important: Local Desktop App

Janki is a local desktop app built with Tauri. There are no remote databases, no cloud services, no Docker. Everything runs locally on Windows 11.

## Core Tools

### Node.js
- **Check:** `node --version`
- **Install:** https://nodejs.org or `nvm install --lts`
- **Required version:** 18+
- **Usage:** Runtime for frontend build tooling

### Rust
- **Check:** `rustc --version && cargo --version`
- **Install:** https://rustup.rs (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- **Required version:** Stable toolchain
- **Usage:** Tauri backend compilation

### pnpm
- **Check:** `pnpm --version`
- **Install:** `npm i -g pnpm`
- **Usage:**
  - `pnpm install` -- install dependencies
  - `pnpm add <pkg>` -- add dependency
  - `pnpm add -D <pkg>` -- add dev dependency
  - `pnpm remove <pkg>` -- remove dependency

## Tauri CLI

### tauri-cli
- **Check:** `pnpm tauri --version`
- **Install:** `pnpm add -D @tauri-apps/cli`
- **Usage:**
  - `pnpm tauri dev` -- start dev mode (frontend + Tauri window)
  - `pnpm tauri build` -- build production installer
  - `pnpm tauri icon <source.png>` -- generate app icons from source image
  - `pnpm tauri info` -- show system info and Tauri config
  - `pnpm tauri plugin add <name>` -- add a Tauri plugin

## Build & Dev

### Vite
- **Check:** `pnpm vite --version`
- **Install:** `pnpm add -D vite`
- **Usage:**
  - Dev server starts automatically via `pnpm tauri dev`
  - `pnpm vite build` -- build frontend only (rarely needed standalone)
  - `pnpm vite preview` -- preview production build in browser

### TypeScript
- **Check:** `pnpm tsc --version`
- **Install:** `pnpm add -D typescript`
- **Usage:**
  - `pnpm tsc --noEmit` -- type-check without emitting
  - `pnpm svelte-check` -- type-check Svelte files

## Linting & Formatting

### Biome
- **Check:** `pnpm biome --version`
- **Install:** `pnpm add -D @biomejs/biome`
- **Usage:**
  - `pnpm biome check .` -- lint + format check
  - `pnpm biome check --write .` -- lint + format fix
  - `pnpm biome lint .` -- lint only
  - `pnpm biome format --write .` -- format only
  - `pnpm biome ci .` -- CI mode (no writes, exit code on issues)

## Testing

### Vitest
- **Check:** `pnpm vitest --version`
- **Install:** `pnpm add -D vitest`
- **Usage:**
  - `pnpm vitest` -- run tests in watch mode
  - `pnpm vitest run` -- run tests once
  - `pnpm vitest run --coverage` -- run with coverage
  - `pnpm vitest <pattern>` -- run tests matching pattern

## Svelte

### svelte-check
- **Check:** `pnpm svelte-check --version`
- **Install:** `pnpm add -D svelte-check`
- **Usage:**
  - `pnpm svelte-check` -- type-check all Svelte files
  - `pnpm svelte-check --threshold warning` -- include warnings

### shadcn-svelte CLI
- **Check:** `pnpm shadcn-svelte --help`
- **Install:** (comes with shadcn-svelte init)
- **Usage:**
  - `pnpm shadcn-svelte init` -- initialize shadcn-svelte in project
  - `pnpm shadcn-svelte add button` -- add a component
  - `pnpm shadcn-svelte add card dialog input` -- add multiple components

## Git
- **Check:** `git --version`
- **Usage:** Version control. Always available.

## Available MCP Servers

Claude Code has access to the following MCP (Model Context Protocol) servers. These provide direct integration with external services without needing CLI tools.

### GitHub MCP

| MCP Server | Purpose |
|------------|---------|
| **github** | Full GitHub integration: repos, issues, PRs, branches, commits, code search, releases, reviews |

### Communication & Productivity MCPs

| MCP Server | Purpose |
|------------|---------|
| **claude_ai_Slack** | Read/search channels, send messages, create canvases, search users |
| **claude_ai_Gmail** | Search/read emails, create drafts, get profile |
| **claude_ai_Google_Calendar** | List/create/update events, find free time, RSVP |
| **claude_ai_Notion** | Search/create/update pages and databases, query views, manage comments |

### Notion MCP (Direct)

| MCP Server | Purpose |
|------------|---------|
| **notion** | Direct Notion API: search, create/update pages, query databases, manage comments |

### IT Management MCPs

| MCP Server | Purpose |
|------------|---------|
| **ninjaone** | RMM/endpoint management: devices, organizations, tickets, patches, scripts, alerts |
| **zendesk** | Help desk: tickets, users, organizations, triggers, automations, macros, views |

### Browser Automation MCP

| MCP Server | Purpose |
|------------|---------|
| **claude-in-chrome** | Chrome browser automation: navigate, click, type, read pages, take screenshots, record GIFs, execute JS |

## Project-Specific Tools

<!-- init-repo and plan-repo append project-specific entries here -->
<!-- Format: ### Tool Name -->
<!-- - **Check:** `command --version` -->
<!-- - **Install:** `install command` -->
<!-- - **Usage:** Common commands for this project -->
