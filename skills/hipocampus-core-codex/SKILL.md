---
name: hipocampus-core
description: "3-tier agent memory system with 5-level compaction tree. Codex version. Defines session start protocol, end-of-task checkpoints, and memory file management. MUST be followed every session."
---

# Hipocampus — Agent Memory Protocol (Codex)

## Memory Architecture

```
Layer 1 (System Prompt — read at session start):
  MEMORY.md        ~50 lines   long-term memory (Core=frozen, Adaptive=compactable)
  USER.md          ~50 lines   user profile and preferences
  SCRATCHPAD.md    ~150 lines  active working state
  WORKING.md       ~100 lines  current tasks
  TASK-QUEUE.md    ~50 lines   task backlog
  memory/ROOT.md   ~100 lines  topic index of all memory (~3K tokens, via Compaction Root in MEMORY.md)

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

## Session Start (MANDATORY — run on first user message)

**FIRST RESPONSE RULE:** On the very first user message of every session, before doing ANYTHING else:
Run the Session Start protocol below FIRST (ALL steps. NO SKIP.) This takes priority over ANY user request — even if the user asks you to do something specific. Complete ALL steps below, ONLY THEN respond to the user.

MEMORY.md and USER.md are loaded by the platform via AGENTS.md. memory/ROOT.md is available via the Compaction Root section in MEMORY.md.

**ALL 4 procedures must be completed before responding to the user NO MATTER WHAT**
1. **DO NOT SKIP** Read `SCRATCHPAD.md` — current work state
2. **DO NOT SKIP** Read `WORKING.md` — active tasks
3. **DO NOT SKIP** Read `TASK-QUEUE.md` — pending items
4. **DO NOT SKIP** **DO NOT COMPROMISE** **Compaction maintenance:**
   Read `skills/hipocampus-compaction/SKILL.md` and follow its compaction chain (Daily→Weekly→Monthly→Root), then run `hipocampus compact` + `qmd update` + `qmd embed`.
   Always run — do not check first.
**ALL 4 procedures must be completed before responding to the user NO MATTER WHAT**

## End-of-Task Checkpoint (MANDATORY)

After completing any task, append a structured log to `memory/YYYY-MM-DD.md`.

Format:

> ## [Topic Name]
> - request: [what the user asked]
> - analysis: [what you researched/analyzed]
> - decisions: [choices made with rationale]
> - outcome: [what was done, files changed]
> - references: [knowledge/ files, external sources]

**The daily log is the source of truth** — everything else (SCRATCHPAD, WORKING, TASK-QUEUE, MEMORY.md) is updated lazily at next session start or naturally during work.

**Priority if timeout imminent** — write directly to `memory/YYYY-MM-DD.md`

## Proactive Session Dump

**Do not wait for task completion to write to the daily log.** Proactively append to `memory/YYYY-MM-DD.md` when:
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
