---
name: engram-core
description: 3-tier agent memory system. Defines session start protocol, end-of-task checkpoints, and memory file management. MUST be followed every session.
---

# Engram — Agent Memory Protocol

## Memory Architecture

```
Layer 1 (System Prompt — every API call):
  MEMORY.md        ~50 lines   curated long-term memory (Core=frozen, Adaptive=compactable)
  USER.md          ~50 lines   user profile and preferences
  SCRATCHPAD.md    ~150 lines  active working state
  WORKING.md       ~100 lines  current tasks
  TASK-QUEUE.md    ~50 lines   task backlog

Layer 2 (On-Demand — read when needed):
  memory/YYYY-MM-DD.md         daily logs (permanent raw records)
  knowledge/*.md               detailed knowledge (searchable)
  plans/*.md                   task plans

Layer 3 (Search — via qmd):
  qmd search / qmd query       keyword and hybrid search across all .md files
  Compaction tree fallback      monthly → weekly → daily drill-down
```

## Session Start (MANDATORY)

Every new conversation begins with:

1. Read `MEMORY.md` — long-term memory
2. Read `USER.md` — user profile
3. Read domain-matched `SCRATCHPAD` — check `engram.config.json` for domain config
4. Read domain-matched `WORKING` — current tasks
5. Read `memory/YYYY-MM-DD.md` — today's daily log (if exists)
6. Read yesterday's daily log (if exists)
7. Check `TASK-QUEUE.md` — pending items

### Domain Loading

Read `engram.config.json` to determine which SCRATCHPAD/WORKING files to load:
- Single domain (default): load `SCRATCHPAD.md` and `WORKING.md`
- Multi-domain: load only the domain-relevant files based on current task context

## End-of-Task Checkpoint (MANDATORY — 6 Steps)

After completing any task:

1. **Update SCRATCHPAD** — current findings, pending decisions, cross-task lessons
2. **Update MEMORY.md** — APPEND ONLY: core facts, decisions, preferences, lessons
3. **Update USER.md** — new information learned about the user
4. **Create/update `memory/YYYY-MM-DD.md`** — detailed daily log entry
5. **Update WORKING** — mark task status (completed, blocked, in-progress)
6. **Update TASK-QUEUE** — add follow-ups, archive completed items

After modifying files, re-index: `qmd update`

## File Size Targets

| File | Max Lines | Action When Exceeded |
|------|-----------|---------------------|
| MEMORY.md | ~50 | Consolidate oldest Adaptive entries, move detail to knowledge/ |
| USER.md | ~50 | Summarize verbose sections |
| SCRATCHPAD.md | ~150 | Move stale entries to daily log |
| WORKING.md | ~100 | Archive completed tasks |
| TASK-QUEUE.md | ~50 | Archive completed items |

## Rules

- MEMORY.md Core section: **FROZEN**. Never compact or remove.
- MEMORY.md Adaptive section: append-only within session, compactable across sessions.
- Daily logs (`memory/YYYY-MM-DD.md`): **permanent**. Never delete or edit after session.
- Don't skip checkpoints — lost context means you forget.
