# CLAUDE.md — Hipocampus

## Project Overview

Hipocampus is a drop-in memory harness for AI agents. It provides persistent, structured memory across sessions using a 3-tier architecture (hot/warm/cold) with a 5-level compaction tree and optional hybrid search (BM25 + vector via qmd).

- **Version:** 0.1.6
- **License:** MIT
- **Repository:** https://github.com/kevin-hs-sohn/hipocampus

## Tech Stack

- **Language:** JavaScript (ES6 modules, `.mjs` files)
- **Runtime:** Node.js >= 18
- **Module system:** ESM (`"type": "module"` in package.json)
- **External dependencies:** None — uses only Node.js built-ins (`node:fs`, `node:child_process`, `node:path`, `node:url`)
- **Optional tool:** `qmd` for BM25 + vector search

## Repository Structure

```
cli/                          # CLI entry points
  init.mjs                    # `hipocampus init` — 9-step initialization
  compact.mjs                 # `hipocampus compact` — mechanical compaction (no LLM)
skills/                       # Agent skill definitions (SKILL.md files)
  hipocampus-core-cc/         # Session protocol for Claude Code
  hipocampus-core-oc/         # Session protocol for OpenClaw
  hipocampus-core-codex/      # Session protocol for Codex
  hipocampus-core-gemini/     # Session protocol for Gemini CLI
  hipocampus-core-shared/     # Shared memory mode (cross-platform)
  hipocampus-compaction/      # 5-level compaction tree builder
  hipocampus-search/          # Search guide (ROOT.md judgment, qmd, tree traversal)
  hipocampus-flush/           # Manual flush (user-invocable)
spec/                         # Formal specifications
  layers.md                   # 3-tier architecture
  compaction.md               # Compaction algorithm
  file-formats.md             # Exact format specs for all memory files
  checkpoint.md               # Session & checkpoint protocol
templates/                    # Template files copied during init
  SCRATCHPAD.md, WORKING.md, TASK-QUEUE.md, MEMORY.md, USER.md, HEARTBEAT.md
```

## Commands

```bash
# Install globally
npm install -g hipocampus

# Initialize memory system in a project
npx hipocampus init
npx hipocampus init --no-vector        # BM25 only, skip embeddings (~2GB)
npx hipocampus init --no-search        # Skip qmd entirely
npx hipocampus init --shared-memory    # Cross-platform file-based memory
npx hipocampus init --platform claude-code
npx hipocampus init --platform openclaw
npx hipocampus init --platform codex
npx hipocampus init --platform gemini

# Run mechanical compaction manually
npx hipocampus compact
```

There are no build, test, or lint commands — the project distributes source directly.

## Code Conventions

- **2-space indentation** throughout
- **ES6 modules** with `.mjs` extensions and `import`/`export` syntax
- **Sync operations** preferred (`execSync`, `fs.readFileSync`, `fs.writeFileSync`) — the CLI runs sequentially
- **Guard clauses** for early returns on platform/config detection
- **Silent fallbacks** for optional tools (qmd may not be installed)
- **No external dependencies** — keep it that way; use only Node.js built-ins
- **No linter or formatter configured** — maintain existing style when editing

## Architecture

### 3-Tier Memory

| Tier | Name | Content | Access |
|------|------|---------|--------|
| Layer 1 | Hot | SCRATCHPAD.md, WORKING.md, TASK-QUEUE.md, ROOT.md | Always loaded in system prompt (~500 lines) |
| Layer 2 | Warm | Raw daily logs (`memory/YYYY-MM-DD.md`), `knowledge/*.md`, `plans/*.md` | On-demand file reads |
| Layer 3 | Cold | Compaction tree nodes (daily/weekly/monthly), qmd search index | Search or tree traversal |

### 5-Level Compaction Tree

```
Raw logs (memory/YYYY-MM-DD.md) — permanent, append-only
    ↓ threshold: ~200 lines
Daily nodes (memory/daily/YYYY-MM-DD.md)
    ↓ threshold: ~300 lines
Weekly nodes (memory/weekly/YYYY-WNN.md)
    ↓ threshold: ~500 lines
Monthly nodes (memory/monthly/YYYY-MM.md)
    ↓ always LLM
ROOT.md (memory/ROOT.md) — self-compresses at ~3K tokens
```

**Status lifecycle:** `tentative` (period active, regenerated on new data) → `fixed` (period ended, never updated).

### Execution Model

1. **Session Start** — read hot memory, dispatch compaction subagent
2. **End-of-Task Checkpoint** — subagent appends structured log to raw daily file
3. **Proactive Flush** — subagent dumps context every ~20 messages or on topic switch
4. **Pre-Compaction Hook** — mechanical (no LLM): backup, compact tree, update ROOT.md, reindex qmd

All memory writes dispatch to subagents to keep the main session context clean.

## Key Files

| File | Purpose |
|------|---------|
| `cli/init.mjs` | Main entry point — 9-step init (platform detection, template copy, skill install, hook registration) |
| `cli/compact.mjs` | Mechanical compaction with smart thresholds (200/300/500 lines) |
| `skills/hipocampus-compaction/SKILL.md` | LLM-driven compaction instructions (242 lines) |
| `skills/hipocampus-search/SKILL.md` | Search protocol (ROOT.md → qmd → tree traversal) |
| `spec/file-formats.md` | Canonical format for every memory file |
| `spec/compaction.md` | Full compaction algorithm spec |

## Platform Support

The project targets four platforms:

- **Claude Code** — Skills install to `.claude/skills/`, hooks registered in `.claude/settings.json`, memory loaded via auto-memory
- **OpenClaw** — Skills install to `skills/`, uses file-based MEMORY.md + USER.md, hooks via AGENTS.md
- **Codex** — Skills install to `skills/`, uses file-based MEMORY.md + USER.md, protocol injected into AGENTS.md
- **Gemini CLI** — Skills install to `skills/`, uses file-based MEMORY.md + USER.md, protocol injected into GEMINI.md

Platform is auto-detected during `init` (`openclaw.json` → OpenClaw, `GEMINI.md` → Gemini, `AGENTS.md` → OpenClaw, otherwise → Claude Code). Use `--platform codex` to explicitly select Codex.

## Configuration

Generated at init time as `hipocampus.config.json`:

```json
{
  "platform": "claude-code",
  "sharedMemory": false,
  "search": { "vector": true, "embedModel": "auto" },
  "compaction": { "rootMaxTokens": 3000 }
}
```

## Development Notes

- This is a CLI tool distributed via npm — no build step needed
- The `files` field in package.json controls what ships: `cli/`, `spec/`, `templates/`, `skills/`, `LICENSE`, `README.md`
- When adding new skills, follow the existing `skills/<name>/SKILL.md` pattern
- Compaction thresholds are intentionally conservative — below-threshold content is copied verbatim to avoid information loss
- The `--shared-memory` mode uses `hipocampus-core-shared` instead of platform-specific core skills
