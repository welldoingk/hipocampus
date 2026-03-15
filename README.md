# engram

Drop-in memory harness for AI agents. Zero infrastructure — just files.

3-tier memory architecture with compaction tree and hybrid search via [qmd](https://github.com/tobi/qmd). One command to set up, works immediately with [Claude Code](https://claude.ai/code) and [OpenClaw](https://github.com/openclaw) bots.

## Quick Start

```bash
npx engram init
```

This creates the full memory structure in your project:

```
MEMORY.md              # Long-term memory (Core frozen + Adaptive dynamic)
USER.md                # User profile built over conversations
SCRATCHPAD.md          # Active working state
WORKING.md             # Current tasks
TASK-QUEUE.md          # Task backlog
memory/                # Daily logs + compaction tree
knowledge/             # Searchable knowledge base
plans/                 # Task plans
engram.config.json     # Configuration
.claude/skills/        # Agent skills (engram-core, engram-compaction, engram-search)
```

It also installs [qmd](https://github.com/tobi/qmd) if missing, registers search collections, and generates vector embeddings for hybrid search.

### Options

```bash
# Split SCRATCHPAD/WORKING by domain (for multi-area projects)
npx engram init --domains web,backend,infra

# Disable vector search (BM25 only, saves ~2GB disk)
npx engram init --no-vector
```

## Why Engram

| | Ad-hoc MEMORY.md | OpenViking | **Engram** |
|---|---|---|---|
| Setup | Manual | Python server + embedding model + config | `npx engram init` |
| Infrastructure | None | Server + DB | **None** |
| Search | None | Vector + directory recursive | **BM25 + vector hybrid (via qmd)** |
| Memory structure | Unstructured | Filesystem paradigm | **3-tier (hot/warm/cold)** |
| Agent integration | DIY | Plugin API | **Drop-in skills** |
| Cost optimization | None | L0/L1/L2 tiered loading | **Prompt cache friendly** |

## Architecture

```
Layer 1 — System Prompt (every API call, ~400 lines total)
  MEMORY.md, USER.md, SCRATCHPAD.md, WORKING.md, TASK-QUEUE.md

Layer 2 — On-Demand (read when needed)
  memory/YYYY-MM-DD.md    daily logs (permanent)
  knowledge/*.md          searchable knowledge
  plans/*.md              task plans

Layer 3 — Search (via qmd)
  qmd query "..."         hybrid BM25 + vector + rerank
  qmd search "..."        BM25 keyword search
  Compaction tree          monthly → weekly → daily drill-down
```

**Layer 1** stays small and stable, maximizing prompt cache hits (up to 90% token savings). The agent writes its own memory — no external system decides what to remember.

**Layer 2** stores detailed records. Daily logs are permanent and never deleted.

**Layer 3** makes everything searchable. The compaction tree (weekly/monthly summaries) provides a hierarchical fallback when keyword search misses.

## Configuration

`engram.config.json`:

```json
{
  "domains": {
    "default": {
      "scratchpad": "SCRATCHPAD.md",
      "working": "WORKING.md"
    }
  },
  "search": {
    "vector": true,
    "embedModel": "auto"
  }
}
```

### Domain Partitioning

For projects with distinct areas, split work-state files by domain:

```json
{
  "domains": {
    "web": {
      "scratchpad": "SCRATCHPAD-WEB.md",
      "working": "WORKING-WEB.md"
    },
    "backend": {
      "scratchpad": "SCRATCHPAD-BACKEND.md",
      "working": "WORKING-BACKEND.md"
    }
  }
}
```

MEMORY.md and USER.md are always global — they represent the user, not the task domain.

### Search

| Setting | Default | Description |
|---------|---------|-------------|
| `vector` | `true` | Vector search via local GGUF models (~2GB). Set `false` for BM25-only |
| `embedModel` | `"auto"` | `"auto"` for embeddinggemma-300M, `"qwen3"` for CJK-optimized |

## Skills

Engram installs three agent skills into `.claude/skills/`:

- **engram-core** — Session start protocol + 6-step end-of-task checkpoint. The core memory discipline.
- **engram-compaction** — Builds the compaction tree (weekly/monthly summaries). Run during maintenance.
- **engram-search** — Search guide: when to use hybrid vs BM25, query construction, compaction tree fallback.

## For OpenClaw Bots

```
/install engram
```

The bot self-provisions the same structure in its workspace.

## Spec

The memory system is formally specified in [`spec/`](./spec/):

- [layers.md](./spec/layers.md) — 3-tier architecture definition
- [file-formats.md](./spec/file-formats.md) — exact format of each file
- [compaction.md](./spec/compaction.md) — compaction tree algorithm
- [checkpoint.md](./spec/checkpoint.md) — session start/end protocol

## Built at clawy.pro

Engram is extracted from the memory system powering 80+ production AI bots at [clawy.pro](https://clawy.pro). It's been running in production since early 2026, handling thousands of conversations across diverse use cases.

## License

MIT
