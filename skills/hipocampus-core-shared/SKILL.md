---
name: hipocampus-core
description: "3-tier agent memory system with 5-level compaction tree. Shared memory mode — MEMORY.md and USER.md are file-based and shared across Claude Code and OpenClaw. MUST be followed every session."
---

# Hipocampus — Agent Memory Protocol (Shared Memory Mode)

> **Shared Memory Mode** — `hipocampus.config.json` has `"sharedMemory": true`.
> Long-term memory is stored in **files** (`MEMORY.md`, `USER.md`), not platform auto memory.
> This makes memory portable across Claude Code and OpenClaw on the same project.

## Memory Architecture

```
Layer 1 (Hot — always loaded):
  MEMORY.md        ~100 lines  long-term memory (Core=frozen, Adaptive=compactable)
                               shared between Claude Code and OpenClaw via file
  USER.md          ~50 lines   user profile and preferences (file-based, shared)
  SCRATCHPAD.md    ~150 lines  active working state
  WORKING.md       ~100 lines  current tasks
  TASK-QUEUE.md    ~50 lines   task backlog
  memory/ROOT.md   ~100 lines  topic index of all memory (~3K tokens)

  Claude Code: all loaded via @import in CLAUDE.md
  OpenClaw:    MEMORY.md/USER.md bootstrapped; SCRATCHPAD/WORKING/TASK-QUEUE read manually

Layer 2 (Warm — read on demand):
  memory/YYYY-MM-DD.md         raw daily logs (permanent, never deleted)
  knowledge/*.md               detailed knowledge (searchable via qmd)
  plans/*.md                   task plans

Layer 3 (Cold — search + compaction tree):
  memory/daily/YYYY-MM-DD.md   daily compaction nodes
  memory/weekly/YYYY-WNN.md    weekly compaction nodes
  memory/monthly/YYYY-MM.md    monthly compaction nodes
  Tree traversal: ROOT → monthly → weekly → daily → raw
```

## Session Start (MANDATORY — run on first user message)

**FIRST RESPONSE RULE:** On the very first user message of every session, before doing ANYTHING else:
Run ALL steps below FIRST. This takes priority over ANY user request.

**Claude Code** — MEMORY.md, USER.md, SCRATCHPAD.md, WORKING.md, TASK-QUEUE.md, memory/ROOT.md are auto-loaded via @import in CLAUDE.md. No manual read needed. Skip to step 1.

**OpenClaw** — MEMORY.md, USER.md, memory/ROOT.md (via Compaction Root section) are auto-loaded by the platform.

**ALL 4 procedures must be completed before responding to the user NO MATTER WHAT**
1. **DO NOT SKIP** Read `SCRATCHPAD.md` — current work state *(OpenClaw only; Claude Code: auto-loaded)*
2. **DO NOT SKIP** Read `WORKING.md` — active tasks *(OpenClaw only; Claude Code: auto-loaded)*
3. **DO NOT SKIP** Read `TASK-QUEUE.md` — pending items *(OpenClaw only; Claude Code: auto-loaded)*
4. **DO NOT SKIP** **DO NOT COMPROMISE** **Compaction maintenance (subagent):**
   Dispatch a subagent to run hipocampus-compaction skill USING SUBAGENTS (chain: Daily→Weekly→Monthly→Root), then run `hipocampus compact` + `qmd update` + `qmd embed`.
   Always run — do not check first, the subagent handles it.
**ALL 4 procedures must be completed before responding to the user NO MATTER WHAT**

Note (OpenClaw only): HEARTBEAT.md also handles needs-summarization at every heartbeat (~30 min).

## End-of-Task Checkpoint (MANDATORY)

After completing any task, **dispatch a subagent** to:

**1. Append a structured log to `memory/YYYY-MM-DD.md`:**

> ## [Topic Name]
> - request: [what the user asked]
> - analysis: [what you researched/analyzed]
> - decisions: [choices made with rationale]
> - outcome: [what was done, files changed]
> - references: [knowledge/ files, external sources]

**2. Append new facts/lessons to `MEMORY.md` (Adaptive section) — APPEND ONLY:**

> - [YYYY-MM-DD] [concise fact, decision, or lesson worth remembering across sessions]

**3. Update `USER.md` if new user preferences or profile info was learned:**

> Update the relevant section with the new info.

**The subagent needs the task summary + any new facts you provide** — it has no access to the conversation.

**Priority if timeout imminent** — write directly to `memory/YYYY-MM-DD.md` and `MEMORY.md`.

## Proactive Session Dump

**Do not wait for task completion.** Proactively dispatch a subagent to flush when:
- ~20+ messages without a checkpoint
- Context is getting large
- Significant decision just completed (even if overall task isn't done)
- Switching between topics

Dispatch subagent with: daily log append + MEMORY.md append (if anything worth persisting).
Daily log is append-only — multiple dumps in the same session are safe.

## MEMORY.md Structure

```markdown
# Memory

## Core
<!-- FROZEN. Never modify, compact, or remove. Foundational facts. -->
- [permanent facts about the project, user, environment]

## Adaptive
<!-- Append-only within session. Compactable across sessions when >50 lines. -->
- [YYYY-MM-DD] [fact / decision / lesson]
```

**Core section: FROZEN.** Never edit, compact, or delete.
**Adaptive section: append-only.** New entries go at the bottom. Compaction prunes oldest entries when >50 lines.

## File Size Targets

| File | Target | When Exceeded |
|------|--------|---------------|
| MEMORY.md Core | ~50 lines | Never touch — frozen |
| MEMORY.md Adaptive | ~50 lines | Prune oldest entries |
| USER.md | ~50 lines | Consolidate redundant info |
| ROOT.md | ~100 lines (~3K tokens) | Automatic recursive self-compression |
| SCRATCHPAD | ~150 lines | Remove completed items |
| WORKING | ~100 lines | Remove completed tasks |
| TASK-QUEUE | ~50 lines | Archive completed items |

## Rules

- **MEMORY.md is shared** — both Claude Code and OpenClaw sessions read and write it. Never overwrite; always append to Adaptive section.
- **USER.md is shared** — same rule. Update, don't overwrite.
- MEMORY.md Core section: **FROZEN**. Never compact, modify, or remove.
- Raw daily logs (`memory/YYYY-MM-DD.md`): **permanent**. Never delete or edit after session.
- ROOT.md: managed by compaction process. Do not manually edit.
- All memory writes via subagent — never pollute main session with memory operations.
- If this session ends NOW, the next session must be able to continue immediately.
- Don't skip checkpoints — lost context means you forget.

## Edge Cases

- **Midnight-spanning session:** Use the session start date for the raw log file name.
- **Returning after long absence:** "Most recent daily" means the latest file that exists.
- **Conflict between platforms:** If two sessions (CC + OC) ran concurrently, MEMORY.md may have interleaved entries — this is fine, both are valid appends.
