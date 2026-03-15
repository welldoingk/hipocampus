# File Formats

## Layer 1 Files

### MEMORY.md

Long-term memory with two sections: Core (frozen) and Adaptive (compactable).

```markdown
# MEMORY.md — Long-Term Memory

APPEND ONLY — add new entries at the end of each section. Never rewrite existing entries.

## Core (Static) — DO NOT compact or remove

These entries survive every compaction cycle. Only update when facts change.

### Identity & Config
(User name, timezone, language, role, accounts, credentials received — last 4 chars only)

### Rules & Preferences
(User decisions, chosen approaches, communication preferences — "user prefers X over Y because Z")

## Adaptive (Dynamic) — Subject to compaction

These entries evolve per session. During heartbeat consolidation, summarize or prune oldest entries first.

### Lessons Learned
(Mistakes made, patterns discovered, things that worked/didn't — prevent repeating errors)

### Active Context
(Ongoing projects, recurring topics, things to follow up on, recent key decisions)
```

**Rules:**
- Core section is FROZEN — never modify, compact, or remove
- Adaptive section: append-only within a session, compactable across sessions
- Target size: ~50 lines total
- When over limit: consolidate oldest Adaptive entries, move detail to `knowledge/`

### USER.md

User profile built up over conversations.

```markdown
# User

## Profile
- Name: (user's name)
- Timezone: (observe from message times or ask)
- Language: (observe from conversation)
- Role/Occupation: (learn from context)

## Communication Style
(observe and note: formal/informal, verbose/concise, language preferences)

## Expertise & Interests
(learn from conversations: technical depth, domain knowledge, hobbies)

## Active Projects
(track ongoing work the user mentions)

## Preferences
(record explicit preferences: "user prefers X over Y")

## Important Notes
(critical context that affects how you assist this user)
```

### SCRATCHPAD.md

Active working state. Cleared/rotated frequently.

```markdown
# SCRATCHPAD

Warm context for all active tasks. Update after every task. Keep under ~150 lines.

## Global
### Cross-Task Lessons
(none yet)
### Pending Decisions
(none)
```

### WORKING.md

Current task tracking.

```markdown
# WORKING.md — Active Tasks

Hot context: 2-5 currently active tasks. Update after every task.

(no active tasks)
```

### TASK-QUEUE.md

Task backlog.

```markdown
# Task Queue

## Queued Tasks
(no tasks queued)

## Completed
(none)
```

## Layer 3 Files — Compaction Summaries

### Weekly Summary

```markdown
---
type: weekly-summary
period: YYYY-WNN
dates: YYYY-MM-DD to YYYY-MM-DD
daily-files: memory/YYYY-MM-DD.md, memory/YYYY-MM-DD.md, ...
topics: keyword1, keyword2, keyword3, keyword4, keyword5
---

# Weekly Summary: YYYY-WNN

## Topics
keyword1, keyword2, keyword3, keyword4, keyword5

## Key Decisions
- decision-keyword: chose X over Y — reason
- decision-keyword: chose A over B — reason

## Tasks Completed
- task-name: outcome
- task-name: outcome

## Entities Referenced
users: user1, user2
services: service1, service2
files: file1.md, file2.md
errors: error-type1, error-type2

## Lessons Learned
- lesson-keyword: concise rule
- lesson-keyword: concise rule

## Open Items
- carried forward item
```

### Monthly Summary

```markdown
---
type: monthly-summary
period: YYYY-MM
weeks: YYYY-WNN, YYYY-WNN, YYYY-WNN, YYYY-WNN
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
patterns: pattern1, pattern2

## Lessons & Patterns
- lesson-keyword: concise rule (emerged over N weeks)

## Carried Forward
- item still open at month end
```

**Format rules for summaries:**
- Use keyword-dense structured format, not narrative prose
- Repeat important keywords in multiple sections for BM25 recall
- Include frontmatter with topics for quick scanning
- Minimum 50 bytes per summary (even sparse periods deserve summaries)
