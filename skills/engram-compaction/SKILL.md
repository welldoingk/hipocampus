---
name: engram-compaction
description: "Build 5-level compaction tree (daily/weekly/monthly/root) with smart thresholds and fixed/tentative lifecycle. Run at session start when triggers are met, or via external scheduler."
---

# Memory Compaction Tree

5-level hierarchical index over raw memory logs. Compaction nodes are **search indices** — originals are never deleted.

## Hierarchy

```
memory/
  ROOT.md                      <- root node (topic index, ~3K tokens, Layer 1)
  2026-03-15.md                <- raw daily log (permanent, append-only)
  daily/2026-03-15.md          <- daily compaction node
  weekly/2026-W11.md           <- weekly compaction node
  monthly/2026-03.md           <- monthly compaction node
```

**Compaction chain:** Raw → Daily → Weekly → Monthly → Root

**Tree traversal (search):** Root → Monthly → Weekly → Daily → Raw

## Fixed vs Tentative Nodes

Every compaction node has a status:
- **tentative** — period is still ongoing, regenerated when new data arrives
- **fixed** — period ended, never updated again

```yaml
# Indicated in YAML frontmatter
---
type: weekly
status: tentative
period: 2026-W11
---
```

**Key: tentative nodes are created immediately — ROOT.md is usable from day one.**

## When to Run

Called from engram-core Session Start step 7, or directly by an external scheduler (e.g., OpenClaw heartbeat). Check trigger conditions below.

## Trigger Conditions

| Level | Tentative Create/Update | Fixed Transition |
|-------|------------------------|-----------------|
| Raw → Daily | On each new raw addition | Date changes |
| Daily → Weekly | On daily add/change | ISO week ended + 7 days elapsed |
| Weekly → Monthly | On weekly add/change | Month ended + 7 days elapsed |
| Monthly → Root | On monthly add/change | Never (root accumulates forever) |

## Smart Thresholds

Below threshold: copy/concat verbatim (no information loss).
Above threshold: generate LLM keyword-dense summary.

| Level | Threshold | Above | Below |
|-------|-----------|-------|-------|
| Raw → Daily | ~200 lines | LLM keyword-dense summary | Copy raw verbatim |
| Daily → Weekly | ~300 lines combined | LLM keyword-dense summary | Concat dailies |
| Weekly → Monthly | ~500 lines combined | LLM keyword-dense summary | Concat weeklies |
| Monthly → Root | Always | Recursive recompaction | (N/A) |

## Algorithm

### Step 1: Discover Candidates

Scan `memory/` for raw files. Group by date, ISO week, and month. Check each group against trigger conditions.

### Step 2: Daily Compaction (max 1 per cycle)

For each date where raw exists and daily needs create/update:

1. Read raw file `memory/YYYY-MM-DD.md`
2. Count lines — compare against ~200 line threshold
3. Below threshold: copy raw verbatim to `memory/daily/YYYY-MM-DD.md`
4. Above threshold: generate keyword-dense summary
5. Write with frontmatter:

```markdown
---
type: daily
status: tentative
period: YYYY-MM-DD
source-files: [memory/YYYY-MM-DD.md]
topics: [keyword1, keyword2, keyword3]
---

## Topics
## Key Decisions
## Tasks Completed
## Lessons Learned
## Open Items
```

6. If date has changed (raw is from a past date): set `status: fixed`

### Step 3: Weekly Compaction (max 1 per cycle)

For each ISO week where dailies exist and weekly needs create/update:

1. Read all daily compaction files for that week
2. Count combined lines — compare against ~300 line threshold
3. Below threshold: concat all dailies
4. Above threshold: generate keyword-dense weekly summary
5. Write to `memory/weekly/YYYY-WNN.md` with frontmatter
6. If ISO week ended + 7 days elapsed: set `status: fixed`

### Step 4: Monthly Compaction (max 1 per cycle)

For each month where weeklies exist and monthly needs create/update:

1. Read all weekly compaction files for that month
2. Count combined lines — compare against ~500 line threshold
3. Below threshold: concat all weeklies
4. Above threshold: generate keyword-dense monthly summary
5. Write to `memory/monthly/YYYY-MM.md` with frontmatter
6. If month ended + 7 days elapsed: set `status: fixed`

### Step 5: Root Compaction

When any monthly node is created or updated:

1. Read existing `memory/ROOT.md` (if exists)
2. Read the new/updated monthly node
3. Recursive compaction: `root = recompact(existing_root + monthly_changes)`
   - **Active Context**: replace with current week's highlights — what's in progress, immediate priorities
   - **Recent Patterns**: update with newly emerged cross-cutting insights
   - **Historical Summary**: append/compress older context — merge periods, keep brief summaries
   - **Topics Index**: merge new topics, update existing entries with new sub-keywords and references
4. Write to `memory/ROOT.md`
5. If root exceeds size cap (`compaction.rootMaxTokens` in config, default 3000 tokens / ~100 lines): self-compress — compress Historical Summary first, keep Active Context and Topics Index intact

```markdown
---
type: root
status: tentative
last-updated: YYYY-MM-DD
---

## Active Context (recent ~7 days)
- topic: current state, what's happening now

## Recent Patterns
- pattern: cross-cutting insight that emerged recently

## Historical Summary
- YYYY-MM~MM: high-level summary of that period
- YYYY-MM: key events

## Topics Index
- topic-keyword: sub-keywords, references → knowledge/file.md
- topic-keyword: sub-keywords
```

### Step 6: Re-index

After writing any compaction files:

```bash
qmd update
```

If vector search is enabled (`search.vector: true` in `engram.config.json`):

```bash
qmd embed
```

## Guards

- Raw files: **never delete** (permanent leaf nodes)
- Max 1 daily + 1 weekly + 1 monthly + 1 root per compaction cycle
- No empty summaries (minimum 50 bytes)
- Skip failed file reads — never abort entire compaction
- qmd update failure: warning only, not fatal
- Root self-compresses when exceeding size cap (shrink older topics first)
- Keyword-dense format only — no prose, no narrative. Optimized for BM25 recall.

## Edge Cases

- **Empty days:** No daily compaction node is generated for days without raw logs. Weekly naturally skips those days.
- **First day:** Create the full tentative tree immediately (daily → weekly → monthly → root). ROOT.md is usable from day one.
- **Lifecycle example:**
  - Day 1: raw created → daily(tentative) → weekly(tentative) → monthly(tentative) → ROOT
  - Day 2: daily(tentative) updated, weekly(tentative) updated, monthly(tentative) updated, ROOT updated
  - Week ends + 7 days: weekly → fixed, new weekly(tentative) starts
  - Month ends + 7 days: monthly → fixed, new monthly(tentative) starts
