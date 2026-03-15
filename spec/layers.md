# Engram Memory Layers

## Overview

Engram organizes agent memory into three tiers optimized for cost and retrieval speed. Layer 1 is always loaded (hot), Layer 2 is read on demand (warm), Layer 3 is accessed via search (cold).

## Layer 1: System Prompt (Hot Memory)

Injected into every API call. Must stay small (~400 lines total across all files).

| File | Purpose | Target Size |
|------|---------|-------------|
| MEMORY.md | Long-term memory (Core frozen + Adaptive dynamic) | ~50 lines |
| USER.md | User profile, preferences, communication style | ~50 lines |
| SCRATCHPAD.md | Current work state, pending decisions | ~150 lines |
| WORKING.md | In-progress task list | ~100 lines |
| TASK-QUEUE.md | Queued tasks | ~50 lines |

**Properties:**
- Loaded every API call — keep lean
- Stable content maximizes prompt cache hit rate (up to 90% token savings)
- Agent-curated — the agent reads AND writes these files
- MEMORY.md has frozen Core section + compactable Adaptive section
- SCRATCHPAD.md and WORKING.md can be split by domain (see domain partitioning)

## Layer 2: On-Demand (Warm Memory)

Read by the agent when needed, not injected into system prompt.

| Path | Purpose | Lifecycle |
|------|---------|-----------|
| `memory/YYYY-MM-DD.md` | Daily session logs | Permanent (never deleted) |
| `knowledge/*.md` | Detailed knowledge base | Agent-managed |
| `plans/*.md` | Task plans and execution records | Agent-managed |

**Properties:**
- Agent reads specific files via file tools or qmd search
- Daily logs are the source of truth — detailed raw records
- Knowledge files are curated by the agent for search discoverability
- No size limit per file, but agent should keep them focused

## Layer 3: Search (Cold Memory)

Accessed via qmd search engine. Includes compaction tree indexes.

| Path | Purpose |
|------|---------|
| `memory/weekly/YYYY-WNN.md` | Weekly summary index nodes |
| `memory/monthly/YYYY-MM.md` | Monthly summary index nodes |

**Search methods:**
- `qmd query "..."` — hybrid BM25 + vector + rerank (when vector enabled)
- `qmd search "..."` — BM25 keyword search (always available)
- Compaction tree traversal: monthly → weekly → daily (fallback when search misses)

**Properties:**
- Weekly/monthly files are BM25-optimized index nodes (keyword-dense)
- Original daily files are never deleted — indexes are supplements, not replacements
- Tree traversal: start broad (monthly), drill down (weekly → daily)
- Vector search requires GGUF models (~2GB, auto-downloaded by qmd)

## Directory Structure

```
project/
├── MEMORY.md                  # Layer 1 — long-term memory
├── USER.md                    # Layer 1 — user profile
├── SCRATCHPAD.md              # Layer 1 — active work state
├── WORKING.md                 # Layer 1 — current tasks
├── TASK-QUEUE.md              # Layer 1 — task queue
├── memory/                    # Layer 2 + 3
│   ├── 2026-03-15.md         # Daily log (Layer 2, permanent)
│   ├── 2026-03-14.md
│   ├── weekly/
│   │   └── 2026-W11.md       # Weekly index (Layer 3)
│   └── monthly/
│       └── 2026-02.md        # Monthly index (Layer 3)
├── knowledge/                 # Layer 2
│   └── *.md
├── plans/                     # Layer 2
│   └── *.md
└── engram.config.json         # Configuration
```
