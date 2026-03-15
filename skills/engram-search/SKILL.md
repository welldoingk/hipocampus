---
name: engram-search
description: Search memory and knowledge using qmd (BM25 + optional vector hybrid search). Use before external lookups for past context, decisions, credentials, and patterns.
---

# Engram Search — via qmd

## Quick Reference

| Action | Command |
|--------|---------|
| Hybrid search (best quality) | `qmd query "keyword1 keyword2"` |
| Keyword search (fast) | `qmd search "keyword1 keyword2"` |
| Vector search only | `qmd vsearch "semantic query"` |
| Search files only | `qmd search "query" --files` |
| Get file | `qmd get "path/to/file.md"` |
| Multi-get | `qmd multi-get "knowledge/*.md"` |
| Re-index | `qmd update` |
| Update embeddings | `qmd embed` |

## Which Search to Use

Check `engram.config.json`:

- **`search.vector: true`** (default) → use `qmd query` for best results (BM25 + vector + rerank)
- **`search.vector: false`** → use `qmd search` for BM25 keyword search

## BM25 Query Construction

When using `qmd search` (BM25 mode), queries must be **keywords**, not natural language.

### Rules
1. Use **2-4 specific keywords** — more precise = better results
2. **No natural language** — strip filler words (how, what, the, is, to, a)
3. **Try variations** — if first query misses, use synonyms or related terms
4. Use `--files` first to find relevant files, then `get` to read them

### Examples

| Bad (natural language) | Good (keywords) |
|------------------------|-----------------|
| "How do I configure the database?" | "database config" |
| "What is the API key for stripe?" | "stripe key" |
| "Show me the deployment process" | "deploy process" |
| "What did we decide about caching?" | "caching decision" |

## Search Pattern

```bash
# 1. Find relevant files
qmd search "topic" --files

# 2. Read the most relevant file
qmd get "knowledge/relevant-file.md"

# 3. If not found, try synonyms
qmd search "alternative keyword"
```

## Compaction Tree Fallback

When qmd search returns no useful results, use the compaction tree:

1. `ls memory/monthly/*.md` — scan topics/keywords to find relevant month
2. Read that month's summary → identify relevant weeks
3. Read `memory/weekly/YYYY-WNN.md` — narrow to the right week
4. Read original `memory/YYYY-MM-DD.md` files — full detail

Always try qmd search first. Tree traversal is the fallback.

## When to Search

- **Before any external lookup** — check local knowledge first
- **Resuming work** — search for task context, past progress
- **Credentials/configs** — search before asking user
- **Past decisions** — search daily logs and knowledge files
- **Domain patterns** — search lessons and knowledge/

## After Modifying Files

Always re-index after changing memory or knowledge files:

```bash
qmd update
```

If vector search is enabled, also update embeddings periodically:

```bash
qmd embed
```
