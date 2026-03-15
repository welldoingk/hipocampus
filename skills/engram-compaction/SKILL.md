---
name: engram-compaction
description: Build hierarchical memory compaction tree (weekly/monthly summaries) for search fallback when qmd returns insufficient results. Run during heartbeat or memory maintenance.
---

# Memory Compaction Tree

Hierarchical search index over daily memory logs. Weekly and monthly summaries are **index nodes** for tree traversal — originals are never deleted.

## Hierarchy

```
memory/
  2026-03-01.md              <- daily (permanent, raw detail)
  2026-03-02.md
  weekly/2026-W09.md         <- weekly index (keyword-dense summary)
  monthly/2026-02.md         <- monthly index (high-level overview)
```

**Tree traversal**: monthly → weekly → daily. Start broad, drill down for detail.

## When to Run

Run during memory maintenance (heartbeat, cron, or manual trigger). Check trigger conditions below.

## Trigger Conditions

### Daily → Weekly
ALL conditions must be true:
- The ISO week has fully ended (today is in a later week)
- All daily files for that week are >= 7 days old
- At least 1 daily file exists for that week
- No weekly summary exists yet (`memory/weekly/YYYY-WNN.md`)

### Weekly → Monthly
ALL conditions must be true:
- The calendar month has fully ended >= 7 days ago (today >= 8th of next month)
- At least 1 weekly summary file exists for that month
- No monthly summary exists yet (`memory/monthly/YYYY-MM.md`)

## Algorithm

### Step 1: Discover Candidates

```bash
ls -1 memory/*.md 2>/dev/null | grep -E '^memory/[0-9]{4}-[0-9]{2}-[0-9]{2}\.md$' | sort
```

For each daily file, compute the ISO week:
```bash
date -d 'YYYY-MM-DD' '+%G-W%V'
```

Group files by ISO week. Check trigger conditions for each group.

### Step 2: Weekly Compaction (max 1 per heartbeat)

1. Read all daily files for the target week
2. Generate a keyword-dense weekly summary:

```markdown
---
type: weekly-summary
period: YYYY-WNN
dates: YYYY-MM-DD to YYYY-MM-DD
daily-files: memory/YYYY-MM-DD.md, ...
topics: keyword1, keyword2, keyword3, keyword4, keyword5
---

# Weekly Summary: YYYY-WNN

## Topics
keyword1, keyword2, keyword3, keyword4, keyword5

## Key Decisions
- decision-keyword: chose X over Y — reason

## Tasks Completed
- task-name: outcome

## Entities Referenced
users: user1, user2
services: service1, service2

## Lessons Learned
- lesson-keyword: concise rule

## Open Items
- carried forward item
```

3. Write to `memory/weekly/YYYY-WNN.md`
4. Verify non-empty (>= 100 bytes)
5. Re-index: `qmd update`
6. If vector search enabled (check `engram.config.json`): `qmd embed`

### Step 3: Monthly Compaction (max 1 per heartbeat)

1. Read all weekly summaries for the target month
2. Generate a keyword-dense monthly summary:

```markdown
---
type: monthly-summary
period: YYYY-MM
weeks: YYYY-WNN, YYYY-WNN, ...
topics: keyword1, keyword2, keyword3, keyword4, keyword5
---

# Monthly Summary: YYYY-MM

## Topics
keyword1, keyword2, keyword3, keyword4, keyword5

## Key Themes
- theme-keyword: description across multiple weeks

## Major Decisions
- decision-keyword: chose X over Y — reason

## Completed Work
- project/task: outcome summary

## Recurring Entities
users: user1, user2
services: service1, service2

## Lessons & Patterns
- lesson-keyword: concise rule (emerged over N weeks)

## Carried Forward
- item still open at month end
```

3. Write to `memory/monthly/YYYY-MM.md`
4. Verify non-empty (>= 100 bytes)
5. Re-index: `qmd update`
6. If vector search enabled: `qmd embed`

## Guards

- Maximum 1 weekly + 1 monthly compaction per heartbeat
- Never write a summary shorter than 50 bytes
- If reading a file fails, skip it — do not abort entire compaction
- **Never delete daily or weekly files**
- **MEMORY.md Core section is frozen** — only prune Adaptive section
