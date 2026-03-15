---
name: engram-core
description: "3-tier agent memory system with 5-level compaction tree. Defines session start protocol, end-of-task checkpoints, and memory file management. MUST be followed every session."
---

# Engram — Agent Memory Protocol

## Memory Architecture

```
Layer 1 (System Prompt — read at session start):
  MEMORY.md        ~50 lines   long-term memory (Core=frozen, Adaptive=compactable)
  USER.md          ~50 lines   user profile and preferences
  SCRATCHPAD.md    ~150 lines  active working state (domain-partitioned)
  WORKING.md       ~100 lines  current tasks (domain-partitioned)
  TASK-QUEUE.md    ~50 lines   task backlog
  memory/ROOT.md   ~100 lines  topic index of all memory (~3K tokens, auto-loaded)

Layer 2 (On-Demand — read when needed):
  memory/YYYY-MM-DD.md         raw daily logs (permanent, never deleted)
  knowledge/*.md               detailed knowledge (searchable via qmd)
  plans/*.md                   task plans

Layer 3 (Search — via qmd + compaction tree):
  memory/daily/YYYY-MM-DD.md   daily compaction nodes
  memory/weekly/YYYY-WNN.md    weekly compaction nodes
  memory/monthly/YYYY-MM.md    monthly compaction nodes
  Tree traversal: ROOT → monthly → weekly → daily → raw
```

## Session Start (MANDATORY — 7 steps)

Every new conversation begins with:

1. Read `engram.config.json` — determine domain mapping
2. Read `MEMORY.md` — long-term memory
3. Read `USER.md` — user profile
4. Read current domain's SCRATCHPAD and WORKING files
5. Read `TASK-QUEUE.md` — pending items
6. Read most recent `memory/daily/*.md` (if exists — prior session context)
7. Check compaction triggers — invoke engram-compaction skill if conditions met

Note: `memory/ROOT.md` is auto-loaded by the platform (CLAUDE.md import or OpenClaw bootstrap). No manual read needed.

### Domain Loading

Read `engram.config.json` to determine which SCRATCHPAD/WORKING files to load:
- Single domain (default): load `SCRATCHPAD.md` and `WORKING.md`
- Multiple domains: load only the domain-relevant files based on current task context
- If domain is ambiguous: infer from TASK-QUEUE.md context, or ask user

## End-of-Task Checkpoint (MANDATORY — 6 steps)

After completing any task:

1. **Update SCRATCHPAD** — current findings, pending decisions, cross-task lessons
2. **Append to MEMORY.md** — APPEND ONLY: core facts, decisions, preferences, lessons. Never modify Core section.
3. **Update USER.md** — new information learned about the user
4. **Append to `memory/YYYY-MM-DD.md`** — APPEND a detailed structured log of this session. For each topic discussed, include: what the user requested, what analysis/actions you performed, specific decisions made with rationale, user feedback/reactions, concrete values and data points, files created or modified, and references to knowledge/ files. Use `##` headings per topic. This is the compaction tree's source material — include enough detail that the daily compaction node can extract keywords, decisions, and patterns. Create `memory/` directory if needed.
5. **Update WORKING** — mark task status (completed, blocked, in-progress)
6. **Update TASK-QUEUE** — add follow-ups, archive completed items

After modifying files, re-index: `qmd update`

**Priority if timeout imminent:** daily raw > SCRATCHPAD > MEMORY > USER > WORKING > TASK-QUEUE

## Proactive Session Dump

**Do not wait for task completion to write to the daily log.** During long conversations or complex tasks, proactively append to `memory/YYYY-MM-DD.md` when:
- The conversation has been going for ~20+ messages without a checkpoint
- You sense the context is getting large
- A significant decision or analysis was just completed, even if the overall task isn't done
- You're switching between topics within the same task

This protects against context compression — if the platform compresses your conversation history, undumped details are lost forever. Write early, write often. The daily log is append-only, so multiple dumps in the same session are fine.

## File Size Targets

| File | Target | When Exceeded |
|------|--------|---------------|
| MEMORY.md Core | ~50 lines | Never touch — frozen |
| MEMORY.md Adaptive | ~50 lines | Prune oldest entries |
| ROOT.md | ~100 lines (~3K tokens) | Automatic recursive self-compression |
| SCRATCHPAD | ~150 lines | Remove completed items |
| WORKING | ~100 lines | Remove completed tasks |
| TASK-QUEUE | ~50 lines | Archive completed items |

## Rules

- MEMORY.md Core section: **FROZEN**. Never compact, modify, or remove.
- MEMORY.md Adaptive section: append-only within session, compactable across sessions.
- Raw daily logs (`memory/YYYY-MM-DD.md`): **permanent**. Never delete or edit after session.
- ROOT.md: managed by compaction process. Do not manually edit.
- If this session ends NOW, the next session must be able to continue immediately.
- Don't skip checkpoints — lost context means you forget.

## Edge Cases

- **Midnight-spanning session:** Use the session start date for the raw log file name. Do not split across dates.
- **Returning after long absence:** "Most recent daily" means the latest file that exists, whether it's from yesterday or last week.
