# Session & Checkpoint Protocol

## Session Start (Mandatory)

Every new conversation MUST begin by loading context:

1. **Read MEMORY.md** — long-term memory (Core + Adaptive sections)
2. **Read USER.md** — user profile, preferences, communication style
3. **Read domain-matched SCRATCHPAD** — active work state
   - Check `engram.config.json` domains to determine which file(s) to load
   - Single domain: `SCRATCHPAD.md`
   - Multi-domain: load the domain-relevant file (e.g., `SCRATCHPAD-WEB.md`)
4. **Read domain-matched WORKING** — current tasks (same domain logic)
5. **Read today's daily log** — `memory/YYYY-MM-DD.md` (if exists)
6. **Read yesterday's daily log** — (if exists, for continuity)
7. **Check TASK-QUEUE.md** — pending items from previous sessions

## End-of-Task Checkpoint (Mandatory, 6 Steps)

After completing any meaningful task, persist context:

### Step 1: Update SCRATCHPAD
- Current findings, pending decisions, cross-task lessons
- Move stale entries to daily log if approaching ~150 lines

### Step 2: Update MEMORY.md
- **APPEND ONLY** to end of relevant section
- Core facts, key decisions, user preferences, lessons learned
- Never modify Core section entries
- If over ~50 lines: consolidate oldest Adaptive entries

### Step 3: Update USER.md
- Any new information learned about the user
- Preferences, expertise, communication patterns
- Only update sections where new info was learned

### Step 4: Create/Update Daily Log
- Write to `memory/YYYY-MM-DD.md`
- Detailed record: what was discussed, decided, accomplished
- Include context that wouldn't fit in MEMORY.md's ~50 line limit
- These are permanent raw records — be thorough

### Step 5: Update WORKING
- Mark task status: completed, blocked, in-progress
- Remove completed tasks (or move to Completed section)
- Add newly discovered sub-tasks

### Step 6: Update TASK-QUEUE
- Add follow-up items discovered during the task
- Archive completed items to Completed section
- Re-prioritize if new information changes priorities

## After File Modifications

Always re-index search after modifying memory or knowledge files:
```bash
qmd update
```

## Domain Partitioning

When `engram.config.json` has multiple domains:

```json
{
  "domains": {
    "web": { "scratchpad": "SCRATCHPAD-WEB.md", "working": "WORKING-WEB.md" },
    "backend": { "scratchpad": "SCRATCHPAD-BACKEND.md", "working": "WORKING-BACKEND.md" }
  }
}
```

- Agent determines current domain from task context
- Loads only the relevant SCRATCHPAD and WORKING files
- MEMORY.md, USER.md, and TASK-QUEUE.md are always global (never split)
- This saves tokens by not loading irrelevant domain state

## Rules

- MEMORY.md Core section: **FROZEN**. Never compact or remove.
- MEMORY.md Adaptive section: append-only within session, compactable across sessions.
- Daily logs (`memory/YYYY-MM-DD.md`): **permanent**. Never edit after the session ends.
- Don't skip checkpoints — lost context means the agent forgets.
- Keep Layer 1 files within their size targets to avoid prompt truncation.
