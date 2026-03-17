#!/usr/bin/env node

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CWD = process.cwd();

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "-h") {
  console.log(`
  hipocampus — Drop-in memory harness for AI agents

  Usage:
    hipocampus init                          Initialize memory system in current directory
    hipocampus init --no-vector              Disable vector search (BM25 only)
    hipocampus init --no-search              Skip qmd entirely (use tree traversal only)
    hipocampus compact                       Run mechanical compaction (called automatically by hooks)

  Options:
    --no-vector        Disable vector search (saves ~2GB disk, no embedding models)
    --no-search        Skip qmd installation and search setup (compaction tree still works)
    --platform <name>  Override platform detection (claude-code, openclaw, codex, or gemini)
    --help, -h         Show this help
`);
  process.exit(0);
}

if (command === "compact") {
  // Delegate to compact.mjs
  const compactPath = join(__dirname, "compact.mjs");
  await import(compactPath);
  process.exit(0);
}

if (command !== "init") {
  console.error(`Unknown command: ${command}. Run 'hipocampus --help' for usage.`);
  process.exit(1);
}

const noVector = args.includes("--no-vector");
const noSearch = args.includes("--no-search");
const sharedMemory = args.includes("--shared-memory");
const platformIdx = args.indexOf("--platform");
const platformOverride = platformIdx !== -1 ? args[platformIdx + 1] : null;
if (platformOverride && !["claude-code", "openclaw", "codex", "gemini"].includes(platformOverride)) {
  console.error(`  ! Unknown platform: ${platformOverride}. Use "claude-code", "openclaw", "codex", or "gemini".`);
  process.exit(1);
}

console.log("\n  hipocampus — initializing memory system\n");

// ─── Step 1: Check qmd ───

let hasQmd = false;
if (noSearch) {
  console.log("  ~ search disabled (--no-search), skipping qmd");
} else {
  try {
    execSync("qmd --version", { stdio: "pipe" });
    hasQmd = true;
    console.log("  + qmd found");
  } catch {
    console.log("  ~ qmd not found, installing...");
    try {
      execSync("npm install -g @tobilu/qmd", { stdio: "inherit" });
      hasQmd = true;
      console.log("  + qmd installed");
    } catch {
      console.warn("  ! Could not install qmd. Memory system works without it (tree traversal only).");
    }
  }
}

// ─── Step 2: Create directories ───

const dirs = ["memory", "memory/daily", "memory/weekly", "memory/monthly", "knowledge", "plans"];
for (const dir of dirs) {
  const p = join(CWD, dir);
  if (!existsSync(p)) {
    mkdirSync(p, { recursive: true });
    console.log(`  + ${dir}/`);
  }
}

// ─── Platform detection (needed before template copying) ───

const agentsMd = join(CWD, "AGENTS.md");
const claudeMd = join(CWD, "CLAUDE.md");
const geminiMd = join(CWD, "GEMINI.md");
const openclawJson = join(CWD, "openclaw.json");

let platform;
if (platformOverride) {
  platform = platformOverride;
} else if (existsSync(openclawJson)) {
  platform = "openclaw";
} else if (existsSync(geminiMd)) {
  platform = "gemini";
} else if (existsSync(agentsMd)) {
  // AGENTS.md is used by both OpenClaw and Codex.
  // With openclaw.json absent, default to openclaw for backward compatibility.
  // Use --platform codex to override.
  platform = "openclaw";
} else {
  platform = "claude-code";
}
const isOpenClaw = platform === "openclaw";
const isCodex = platform === "codex";
const isGemini = platform === "gemini";
const isAgentsMdPlatform = isOpenClaw || isCodex; // platforms that use AGENTS.md

console.log(`  ~ platform: ${platform}`);
if (sharedMemory) console.log(`  ~ shared memory mode: MEMORY.md + USER.md shared across platforms`);

// ─── Step 3: Copy templates ───

function copyTemplate(filename, destName) {
  const dest = join(CWD, destName || filename);
  if (!existsSync(dest)) {
    copyFileSync(join(ROOT, "templates", filename), dest);
    console.log(`  + ${destName || filename}`);
  }
}

if (isOpenClaw || isCodex || isGemini || sharedMemory) {
  copyTemplate("MEMORY.md");
  copyTemplate("USER.md");
}
if (isOpenClaw) {
  copyTemplate("HEARTBEAT.md");
}
copyTemplate("TASK-QUEUE.md");

// Create ROOT.md stub if it doesn't exist
const rootMdPath = join(CWD, "memory", "ROOT.md");
if (!existsSync(rootMdPath)) {
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(rootMdPath, `---
type: root
status: tentative
last-updated: ${today}
---

## Active Context (recent ~7 days)
<!-- Current work and priorities -->

## Recent Patterns
<!-- Cross-cutting insights -->

## Historical Summary
<!-- High-level timeline -->

## Topics Index
<!-- topic: keywords, references -->
`);
  console.log("  + memory/ROOT.md");
}

copyTemplate("SCRATCHPAD.md");
copyTemplate("WORKING.md");

// ─── Step 4: Install skills ───

// Platform-specific core skill + shared skills
let coreSkillSrc;
if (sharedMemory) {
  coreSkillSrc = "hipocampus-core-shared";
} else if (isCodex) {
  coreSkillSrc = "hipocampus-core-codex";
} else if (isGemini) {
  coreSkillSrc = "hipocampus-core-gemini";
} else {
  coreSkillSrc = isOpenClaw ? "hipocampus-core-oc" : "hipocampus-core-cc";
}
const sharedSkills = ["hipocampus-compaction", "hipocampus-search", "hipocampus-flush"];
const allSkillSources = [coreSkillSrc, ...sharedSkills];
// Installed as hipocampus-core (not hipocampus-core-cc/oc)
const allSkillDests = ["hipocampus-core", ...sharedSkills];

// Claude Code: .claude/skills/  |  OpenClaw/Codex/Gemini: skills/
const skillsBase = (isOpenClaw || isCodex || isGemini) ? join(CWD, "skills") : join(CWD, ".claude", "skills");

for (let i = 0; i < allSkillSources.length; i++) {
  const srcName = allSkillSources[i];
  const destName = allSkillDests[i];
  const destDir = join(skillsBase, destName);
  const destFile = join(destDir, "SKILL.md");
  const src = join(ROOT, "skills", srcName, "SKILL.md");
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
  // Always overwrite — ensures updates propagate on reinstall/upgrade
  if (existsSync(src)) {
    copyFileSync(src, destFile);
    console.log(`  + skill: ${destName}`);
  }
}

// Migration: remove skills from wrong location (.claude/skills on non-Claude Code platforms)
if (isOpenClaw || isCodex || isGemini) {
  const wrongBase = join(CWD, ".claude", "skills");
  for (const skill of allSkillDests) {
    const wrongDir = join(wrongBase, skill);
    if (existsSync(wrongDir)) {
      const { rmSync } = await import("node:fs");
      rmSync(wrongDir, { recursive: true });
      console.log(`  ~ migrated skill ${skill} from .claude/skills/ to skills/`);
    }
  }
}

// ─── Step 5: Create config ───

const configDest = join(CWD, "hipocampus.config.json");
if (!existsSync(configDest)) {
  const config = {
    platform,
    sharedMemory: sharedMemory || false,
    search: {
      vector: !noVector,
      embedModel: "auto",
    },
    compaction: {
      rootMaxTokens: 3000,
    },
  };

  writeFileSync(configDest, JSON.stringify(config, null, 2) + "\n");
  console.log("  + hipocampus.config.json");
}

// ─── Step 6: Register qmd collections ───

if (hasQmd) {
  console.log("\n  setting up search...\n");

  const tryExec = (cmd, label) => {
    try {
      execSync(cmd, { cwd: CWD, stdio: "pipe" });
      console.log(`  + ${label}`);
    } catch { /* collection may already exist */ }
  };

  tryExec("qmd collection add ./memory --name memory", "collection: memory");
  tryExec("qmd collection add ./knowledge --name knowledge", "collection: knowledge");

  try {
    execSync("qmd update", { cwd: CWD, stdio: "pipe" });
    console.log("  + search index updated");
  } catch { /* ignore */ }

  const cfg = JSON.parse(readFileSync(configDest, "utf8"));
  if (cfg.search?.vector !== false) {
    console.log("  ~ generating vector embeddings (first run downloads ~2GB of models)...");
    try {
      execSync("qmd embed", { cwd: CWD, stdio: "inherit" });
      console.log("  + embeddings generated");
    } catch {
      console.warn("  ! Vector embedding failed. Search will use BM25 only. Run 'qmd embed' later.");
    }
  }
}

// ─── Step 7: Protocol injection ───

const PROTOCOL_BLOCK_OC = `
## Hipocampus — Memory Protocol

This project uses hipocampus 3-tier memory. Follow \`skills/hipocampus-core/SKILL.md\`.
**All memory write operations MUST be dispatched to subagents** to keep the main session context clean.

### FIRST RESPONSE RULE — MANDATORY
**On the very first user message of every session**, before doing ANYTHING else:
Run the Session Start protocol below FIRST (ALL steps. NO SKIP.) This takes priority over ANY user request — even if the user asks you to do something specific. Complete ALL steps below, ONLY THEN respond to the user.

### Session Start (run on first user message, every step required.)
**ALL 4 procedures must be completed before responding to the user NO MATTER WHAT**
1. **DO NOT SKIP** Read \`SCRATCHPAD.md\` — current work state
2. **DO NOT SKIP** Read \`WORKING.md\` — active tasks
3. **DO NOT SKIP** Read \`TASK-QUEUE.md\` — pending items
4. **DO NOT SKIP** **DO NOT COMPROMISE** **Compaction maintenance (subagent):** Dispatch a subagent to run hipocampus-compaction skill USING SUBAGENTS (chain: Daily→Weekly→Monthly→Root), then run \`hipocampus compact\` + \`qmd update\` + \`qmd embed\`. Always run — do not check first, the subagent handles it.
**ALL 4 procedures must be completed before responding to the user NO MATTER WHAT**

Note: MEMORY.md, USER.md, memory/ROOT.md (via Compaction Root section) are auto-loaded by the platform.

### End-of-Task Checkpoint (mandatory — subagent)
After completing any task, **dispatch a subagent** to append a structured log to \`memory/YYYY-MM-DD.md\`.
Compose the log with ## headings per topic: what was requested, analysis, decisions with rationale, outcomes, files changed.
**The subagent only needs to do one thing: append to the daily log.** Everything else (SCRATCHPAD, WORKING, TASK-QUEUE, MEMORY.md) is updated lazily at next session start or by the agent naturally during work.
**You must provide the task summary to the subagent** — it has no access to the conversation.

### Rules
- **Never skip Session Start** — every session begins with it, no exceptions
- **Never skip checkpoints** — every task completion MUST append to daily log via subagent
- **All memory writes via subagent** — never pollute main session with memory operations
- MEMORY.md Core section: never modify or delete
- memory/*.md (raw): permanent, never delete
- Search: see \`skills/hipocampus-search/SKILL.md\`
- If this session ends NOW, the next session must be able to continue immediately
`;

const PROTOCOL_BLOCK_CC = `
## Hipocampus — Memory Protocol

This project uses hipocampus 3-tier memory. Follow \`.claude/skills/hipocampus-core/SKILL.md\`.
**All memory write operations MUST be dispatched to subagents** to keep the main session context clean.

### FIRST RESPONSE RULE — MANDATORY
**On the very first user message of every session**, before doing ANYTHING else:
Run the Session Start protocol below FIRST (ALL steps. NO SKIP.) This takes priority over ANY user request — even if the user asks you to do something specific. Complete ALL steps below, ONLY THEN respond to the user.

### Session Start (run on first user message.)
SCRATCHPAD.md, WORKING.md, TASK-QUEUE.md, memory/ROOT.md are auto-loaded via @import below — no manual read needed.
**This procedure must be completed before responding to the user NO MATTER WHAT**
1. **DO NOT SKIP** **DO NOT COMPROMISE** **Compaction maintenance (subagent):** Dispatch a subagent to run hipocampus-compaction skill USING SUBAGENTS (chain: Daily→Weekly→Monthly→Root), then run \`hipocampus compact\` + \`qmd update\` + \`qmd embed\`. Always run — do not check first, the subagent handles it.
**This procedure must be completed before responding to the user NO MATTER WHAT**

### End-of-Task Checkpoint (mandatory — subagent)
After completing any task, **dispatch a subagent** to append a structured log to \`memory/YYYY-MM-DD.md\`.
Compose the log with ## headings per topic: what was requested, analysis, decisions with rationale, outcomes, files changed.
**The subagent only needs to do one thing: append to the daily log.** Everything else (SCRATCHPAD, WORKING, TASK-QUEUE) is updated lazily at next session start or by the agent naturally during work.
**You must provide the task summary to the subagent** — it has no access to the conversation.

### Rules
- **Never skip Session Start** — every session begins with it, no exceptions
- **Never skip checkpoints** — every task completion MUST append to daily log via subagent
- **All memory writes via subagent** — never pollute main session with memory operations
- memory/*.md (raw): permanent, never delete
- Search: see \`.claude/skills/hipocampus-search/SKILL.md\`
- If this session ends NOW, the next session must be able to continue immediately
`;

const hasHipocampus = (text) => text.toLowerCase().includes("hipocampus");

const PROTOCOL_BLOCK_CC_SHARED = `
## Hipocampus — Memory Protocol (Shared Memory Mode)

This project uses hipocampus 3-tier memory in **shared memory mode** — \`MEMORY.md\` and \`USER.md\` are files shared between Claude Code and OpenClaw sessions.
Follow \`.claude/skills/hipocampus-core/SKILL.md\`.
**All memory write operations MUST be dispatched to subagents** to keep the main session context clean.

### FIRST RESPONSE RULE — MANDATORY
**On the very first user message of every session**, before doing ANYTHING else:
Run the Session Start protocol below FIRST. This takes priority over ANY user request.

### Session Start (run on first user message.)
MEMORY.md, USER.md, SCRATCHPAD.md, WORKING.md, TASK-QUEUE.md, memory/ROOT.md are auto-loaded via @import below — no manual read needed.
**This procedure must be completed before responding to the user NO MATTER WHAT**
1. **DO NOT SKIP** **DO NOT COMPROMISE** **Compaction maintenance (subagent):** Dispatch a subagent to run hipocampus-compaction skill USING SUBAGENTS (chain: Daily→Weekly→Monthly→Root), then run \`hipocampus compact\` + \`qmd update\` + \`qmd embed\`. Always run — do not check first, the subagent handles it.
**This procedure must be completed before responding to the user NO MATTER WHAT**

### End-of-Task Checkpoint (mandatory — subagent)
After completing any task, **dispatch a subagent** to:
1. Append structured log to \`memory/YYYY-MM-DD.md\` (## headings: request, analysis, decisions, outcome, references)
2. **APPEND** new facts/lessons to \`MEMORY.md\` Adaptive section — NEVER overwrite
3. Update \`USER.md\` if new user preferences were learned
**You must provide the task summary + new facts to the subagent** — it has no access to the conversation.

### Rules
- **Never skip Session Start** — every session begins with it, no exceptions
- **Never skip checkpoints** — every task completion MUST write to daily log + MEMORY.md via subagent
- **All memory writes via subagent** — never pollute main session with memory operations
- **MEMORY.md is shared** — OpenClaw sessions also write it. Always APPEND to Adaptive section, never overwrite
- MEMORY.md Core section: never modify or delete
- memory/*.md (raw): permanent, never delete
- Search: see \`.claude/skills/hipocampus-search/SKILL.md\`
- If this session ends NOW, the next session must be able to continue immediately
`;

// Codex uses AGENTS.md (like OpenClaw) but without subagent support
const PROTOCOL_BLOCK_CODEX = `
## Hipocampus — Memory Protocol

This project uses hipocampus 3-tier memory. Follow \`skills/hipocampus-core/SKILL.md\`.

### FIRST RESPONSE RULE — MANDATORY
**On the very first user message of every session**, before doing ANYTHING else:
Run the Session Start protocol below FIRST (ALL steps. NO SKIP.) This takes priority over ANY user request — even if the user asks you to do something specific. Complete ALL steps below, ONLY THEN respond to the user.

### Session Start (run on first user message, every step required.)
**ALL 4 procedures must be completed before responding to the user NO MATTER WHAT**
1. **DO NOT SKIP** Read \`SCRATCHPAD.md\` — current work state
2. **DO NOT SKIP** Read \`WORKING.md\` — active tasks
3. **DO NOT SKIP** Read \`TASK-QUEUE.md\` — pending items
4. **DO NOT SKIP** **DO NOT COMPROMISE** **Compaction maintenance:** Read \`skills/hipocampus-compaction/SKILL.md\` and follow its compaction chain (Daily→Weekly→Monthly→Root), then run \`hipocampus compact\` + \`qmd update\` + \`qmd embed\`. Always run — do not check first.
**ALL 4 procedures must be completed before responding to the user NO MATTER WHAT**

Note: MEMORY.md, USER.md, memory/ROOT.md (via Compaction Root section) are auto-loaded by the platform.

### End-of-Task Checkpoint (mandatory)
After completing any task, append a structured log to \`memory/YYYY-MM-DD.md\`.
Compose the log with ## headings per topic: what was requested, analysis, decisions with rationale, outcomes, files changed.
**The daily log is the source of truth.** Everything else (SCRATCHPAD, WORKING, TASK-QUEUE, MEMORY.md) is updated lazily at next session start or naturally during work.

### Rules
- **Never skip Session Start** — every session begins with it, no exceptions
- **Never skip checkpoints** — every task completion MUST append to daily log
- MEMORY.md Core section: never modify or delete
- memory/*.md (raw): permanent, never delete
- Search: see \`skills/hipocampus-search/SKILL.md\`
- If this session ends NOW, the next session must be able to continue immediately
`;

// Gemini CLI uses GEMINI.md
const PROTOCOL_BLOCK_GEMINI = `
## Hipocampus — Memory Protocol

This project uses hipocampus 3-tier memory. Follow \`skills/hipocampus-core/SKILL.md\`.

### FIRST RESPONSE RULE — MANDATORY
**On the very first user message of every session**, before doing ANYTHING else:
Run the Session Start protocol below FIRST (ALL steps. NO SKIP.) This takes priority over ANY user request — even if the user asks you to do something specific. Complete ALL steps below, ONLY THEN respond to the user.

### Session Start (run on first user message, every step required.)
**ALL 4 procedures must be completed before responding to the user NO MATTER WHAT**
1. **DO NOT SKIP** Read \`SCRATCHPAD.md\` — current work state
2. **DO NOT SKIP** Read \`WORKING.md\` — active tasks
3. **DO NOT SKIP** Read \`TASK-QUEUE.md\` — pending items
4. **DO NOT SKIP** **DO NOT COMPROMISE** **Compaction maintenance:** Read \`skills/hipocampus-compaction/SKILL.md\` and follow its compaction chain (Daily→Weekly→Monthly→Root), then run \`hipocampus compact\` + \`qmd update\` + \`qmd embed\`. Always run — do not check first.
**ALL 4 procedures must be completed before responding to the user NO MATTER WHAT**

Note: MEMORY.md, USER.md, memory/ROOT.md (via Compaction Root section) are loaded from project files.

### End-of-Task Checkpoint (mandatory)
After completing any task, append a structured log to \`memory/YYYY-MM-DD.md\`.
Compose the log with ## headings per topic: what was requested, analysis, decisions with rationale, outcomes, files changed.
**The daily log is the source of truth.** Everything else (SCRATCHPAD, WORKING, TASK-QUEUE, MEMORY.md) is updated lazily at next session start or naturally during work.

### Rules
- **Never skip Session Start** — every session begins with it, no exceptions
- **Never skip checkpoints** — every task completion MUST append to daily log
- MEMORY.md Core section: never modify or delete
- memory/*.md (raw): permanent, never delete
- Search: see \`skills/hipocampus-search/SKILL.md\`
- If this session ends NOW, the next session must be able to continue immediately
`;

// Helper: inject Compaction Root section into MEMORY.md for platforms that can't auto-load ROOT.md
function injectCompactionRoot() {
  const memoryMd = join(CWD, "MEMORY.md");
  if (existsSync(memoryMd)) {
    const memContent = readFileSync(memoryMd, "utf8");
    if (!memContent.includes("Compaction Root")) {
      appendFileSync(memoryMd, `
## Compaction Root
<!-- This section serves as the ROOT.md index for platforms that can't auto-load separate files. -->
<!-- Updated automatically by hipocampus compact. See memory/ROOT.md for the full version. -->

### Active Context (recent ~7 days)
<!-- Current work and priorities -->

### Recent Patterns
<!-- Cross-cutting insights -->

### Topics Index
<!-- topic: keywords, references -->
`);
      console.log("  + added Compaction Root section to MEMORY.md");
    }
  }
}

// Helper: inject protocol into an AGENTS.md file (used by OpenClaw and Codex)
function injectAgentsMdProtocol(protocolBlock) {
  if (existsSync(agentsMd)) {
    const content = readFileSync(agentsMd, "utf8");
    if (!hasHipocampus(content)) {
      const newContent = protocolBlock.trimStart() + "\n" + content;
      writeFileSync(agentsMd, newContent);
      console.log("  + added hipocampus protocol (top) to AGENTS.md");
    }
  } else {
    writeFileSync(agentsMd, protocolBlock.trimStart());
    console.log("  + created AGENTS.md with hipocampus protocol");
  }
}

if (isOpenClaw) {
  // ── OpenClaw path ──
  injectAgentsMdProtocol(PROTOCOL_BLOCK_OC);
  injectCompactionRoot();
} else if (isCodex) {
  // ── Codex path ──
  // Codex uses AGENTS.md like OpenClaw, but with its own protocol block
  injectAgentsMdProtocol(PROTOCOL_BLOCK_CODEX);
  injectCompactionRoot();
} else if (isGemini) {
  // ── Gemini CLI path ──
  // Protocol block goes at the TOP of GEMINI.md
  if (existsSync(geminiMd)) {
    const content = readFileSync(geminiMd, "utf8");
    if (!hasHipocampus(content)) {
      const newContent = PROTOCOL_BLOCK_GEMINI.trimStart() + "\n" + content;
      writeFileSync(geminiMd, newContent);
      console.log("  + added hipocampus protocol (top) to GEMINI.md");
    }
  } else {
    writeFileSync(geminiMd, PROTOCOL_BLOCK_GEMINI.trimStart());
    console.log("  + created GEMINI.md with hipocampus protocol");
  }
  injectCompactionRoot();
} else {
  // ── Claude Code path ──
  // Protocol block goes at the TOP of CLAUDE.md (highest priority)
  // @imports go after protocol block but before existing content

  const chosenProtocol = sharedMemory ? PROTOCOL_BLOCK_CC_SHARED : PROTOCOL_BLOCK_CC;

  // @imports: platform auto-loads these at session start (no agent read needed)
  const importLines = ["@memory/ROOT.md", "@SCRATCHPAD.md", "@WORKING.md", "@TASK-QUEUE.md"];
  if (sharedMemory) {
    // In shared memory mode, MEMORY.md and USER.md are also file-based → @import them
    importLines.unshift("@MEMORY.md", "@USER.md");
  }
  const importBlock = importLines.join("\n") + "\n";

  if (existsSync(claudeMd)) {
    const content = readFileSync(claudeMd, "utf8");
    if (!hasHipocampus(content)) {
      const newContent = chosenProtocol.trimStart() + "\n" + importBlock + "\n" + content;
      writeFileSync(claudeMd, newContent);
      console.log("  + added hipocampus protocol (top) and @imports to CLAUDE.md");
    }
  } else {
    writeFileSync(claudeMd, chosenProtocol.trimStart() + "\n" + importBlock);
    console.log("  + created CLAUDE.md with hipocampus protocol and @imports");
  }

  // In shared memory mode, also inject Compaction Root into MEMORY.md
  if (sharedMemory) {
    injectCompactionRoot();
  }
}

// ─── Step 8: .gitignore ───

const gitignorePath = join(CWD, ".gitignore");
const HIPOCAMPUS_GITIGNORE = `
# hipocampus - personal memory (don't commit)
MEMORY.md
USER.md
SCRATCHPAD*.md
WORKING*.md
TASK-QUEUE.md
memory/
knowledge/
plans/
`;

if (existsSync(gitignorePath)) {
  const gi = readFileSync(gitignorePath, "utf8");
  if (!gi.includes("hipocampus")) {
    appendFileSync(gitignorePath, HIPOCAMPUS_GITIGNORE);
    console.log("  + added hipocampus entries to .gitignore");
  }
} else {
  writeFileSync(gitignorePath, HIPOCAMPUS_GITIGNORE.trimStart());
  console.log("  + created .gitignore with hipocampus entries");
}

// ─── Step 9: Register pre-compaction hook ───

// PreCompact only supports type: "command" hooks (not agent/prompt/http).
// Mechanical compaction runs here; LLM pass (needs-summarization, flush) is handled by:
//   - Claude Code: Session Start step 9 + /hipocampus-flush manual command
//   - OpenClaw: HEARTBEAT.md + Session Start step 9

const hipocampusBin = join(ROOT, "cli", "init.mjs");
const compactCmd = `node "${hipocampusBin}" compact --stdin`;

if (platform === "claude-code") {
  // Claude Code: register PreCompact command hook in .claude/settings.json
  const settingsDir = join(CWD, ".claude");
  const settingsPath = join(settingsDir, "settings.json");
  let settings = {};

  if (existsSync(settingsPath)) {
    try { settings = JSON.parse(readFileSync(settingsPath, "utf8")); } catch { /* fresh start */ }
  }

  if (!settings.hooks?.PreCompact) {
    if (!existsSync(settingsDir)) mkdirSync(settingsDir, { recursive: true });

    settings.hooks = settings.hooks || {};
    settings.hooks.PreCompact = [
      {
        matcher: "",
        hooks: [
          {
            type: "command",
            command: compactCmd,
            timeout: 30000,
          },
        ],
      },
    ];

    // Also register TaskCompleted hook for mechanical compaction after each task
    if (!settings.hooks.TaskCompleted) {
      settings.hooks.TaskCompleted = [
        {
          matcher: "",
          hooks: [
            {
              type: "command",
              command: `node "${hipocampusBin}" compact`,
              timeout: 30000,
            },
          ],
        },
      ];
    }

    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    console.log("  + registered PreCompact + TaskCompleted hooks (mechanical compaction)");
  }
} else if (isOpenClaw) {
  // OpenClaw: compaction is handled by two mechanisms:
  //   1. HEARTBEAT.md — LLM pass: needs-summarization processing + qmd reindex (every heartbeat)
  //   2. hipocampus compact — mechanical compaction: called manually or by session:compact:before hook
  //
  // HEARTBEAT.md is already copied in Step 3.
  // Register mechanical compact in openclaw.json for session:compact:before if possible.
  if (existsSync(openclawJson)) {
    try {
      const oc = JSON.parse(readFileSync(openclawJson, "utf8"));
      if (!oc.hooks?.internal?.entries?.["hipocampus-compact"]) {
        oc.hooks = oc.hooks || {};
        oc.hooks.internal = oc.hooks.internal || { enabled: true, entries: {} };
        oc.hooks.internal.entries = oc.hooks.internal.entries || {};
        oc.hooks.internal.entries["hipocampus-compact"] = {
          enabled: true,
          env: { HIPOCAMPUS_BIN: hipocampusBin },
        };
        writeFileSync(openclawJson, JSON.stringify(oc, null, 2) + "\n");
        console.log("  + registered hipocampus-compact hook entry in openclaw.json");
      }
    } catch { /* openclaw.json not parseable */ }
  }
  console.log("  + HEARTBEAT.md includes hipocampus compaction maintenance tasks");
} else {
  // Codex / Gemini: no native hook system — compaction runs via session start protocol
  console.log(`  ~ ${platform} has no native hook system — compaction runs at session start and via manual 'hipocampus compact'`);
}

// ─── Done ───

if (isOpenClaw || isCodex || isGemini) {
  console.log(`
  done! Your agent now has structured memory.

  Next steps:
    1. Fill in USER.md with your profile
    2. Start a conversation — the agent will follow the memory protocol
    3. Memory builds up automatically over sessions
`);
} else {
  console.log(`
  done! Your agent now has structured memory.

  Next steps:
    1. Your profile is managed by the platform's auto memory
    2. Start a conversation — the agent will follow the memory protocol
    3. Memory builds up automatically over sessions
`);
}
