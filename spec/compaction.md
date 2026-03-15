# Compaction Tree

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

## Trigger Conditions

### Daily → Weekly

ALL conditions must be true:
- The ISO week has fully ended (today is in a later week)
- All daily files for that week are >= 7 days old
- At least 1 daily file exists for that week
- No weekly summary exists yet for that week (`memory/weekly/YYYY-WNN.md`)

### Weekly → Monthly

ALL conditions must be true:
- The calendar month has fully ended >= 7 days ago (today is at least the 8th of the next month)
- At least 1 weekly summary file exists for that month
- No monthly summary exists yet (`memory/monthly/YYYY-MM.md`)

## Algorithm

### Step 1: Discover Candidates

List all daily files and compute their ISO weeks:

```bash
ls -1 memory/*.md 2>/dev/null | grep -E '^memory/[0-9]{4}-[0-9]{2}-[0-9]{2}\.md$' | sort
```

For each daily file, compute the ISO week:
```bash
date -d 'YYYY-MM-DD' '+%G-W%V'   # Linux
date -jf '%Y-%m-%d' 'YYYY-MM-DD' '+%G-W%V'   # macOS
```

Group files by ISO week. Check trigger conditions for each group.

### Step 2: Weekly Compaction (max 1 per heartbeat)

1. Read all daily files for the target week
2. Generate a keyword-dense weekly summary (see file-formats.md for template)
3. Write to `memory/weekly/YYYY-WNN.md`
4. Verify the written file is non-empty (>= 100 bytes)
5. Re-index search: `qmd update`
6. If vector search enabled: `qmd embed`

Daily files are **kept** — they are the source of truth for drill-down.

### Step 3: Monthly Compaction (max 1 per heartbeat)

1. List weekly files for the target month
2. Read all weekly summaries whose period falls within the target month
3. Generate a keyword-dense monthly summary (see file-formats.md for template)
4. Write to `memory/monthly/YYYY-MM.md`
5. Verify the written file is non-empty (>= 100 bytes)
6. Re-index search: `qmd update`
7. If vector search enabled: `qmd embed`

Weekly files are **kept** — they are mid-level index nodes.

## Guards

- Maximum 1 weekly compaction + 1 monthly compaction per heartbeat cycle
- Never write a summary shorter than 50 bytes
- If reading a daily/weekly file fails, skip it and log the error — do not abort the entire compaction
- **Never delete daily or weekly files** — they are permanent
- **MEMORY.md Core section is frozen** — when consolidating MEMORY.md, only prune/summarize entries in the Adaptive section

## ISO Week Reference

```bash
# Get ISO week for a date (Linux)
date -d '2026-03-01' '+%G-W%V'
# Output: 2026-W09

# Get current ISO week
date '+%G-W%V'
```

Note: `%G` is the ISO year (may differ from calendar year at year boundaries), `%V` is the ISO week number (01-53).

## Tree Traversal for Search

When qmd search returns insufficient results, use the compaction tree:

1. `ls memory/monthly/*.md` — scan topics/keywords to find relevant month
2. Read that month's file → identify relevant weeks
3. `ls memory/weekly/*.md` — read the relevant weekly summary
4. Read the original daily files for that week → extract full detail

This is a fallback — always try qmd search first.
