# Task: Apply patch and create PR to upstream

## Context
`welldoingk/hipocampus` is a fork of `kevin-hs-sohn/hipocampus`.
There is a patch file `changes.patch` in the current directory that contains 2 commits:

1. **docs: add comprehensive CLAUDE.md for AI assistant onboarding** — CLAUDE.md 파일 추가 (프로젝트 구조, 컨벤션, 아키텍처 문서)
2. **feat: add Codex and Gemini CLI platform support** — Codex/Gemini CLI 플랫폼 지원 추가
   - `skills/hipocampus-core-codex/SKILL.md` (새 파일)
   - `skills/hipocampus-core-gemini/SKILL.md` (새 파일)
   - `cli/init.mjs` 수정 (Codex/Gemini 플랫폼 감지 + init 로직)
   - `README.md` 수정 (Codex/Gemini 설치 가이드 추가)
   - `package.json` 수정 (keywords 추가)

## Steps

1. Make sure you're on the `main` branch and it's up to date:
   ```bash
   git checkout main
   git pull origin main
   ```

2. Create a new feature branch:
   ```bash
   git checkout -b feat/add-codex-gemini-support
   ```

3. Apply the patch:
   ```bash
   git am changes.patch
   ```
   If `git am` fails due to conflicts, try:
   ```bash
   git am --abort
   git apply --3way changes.patch
   git add -A
   git commit -m "docs: add CLAUDE.md and add Codex/Gemini CLI platform support"
   ```

4. Push to fork:
   ```bash
   git push -u origin feat/add-codex-gemini-support
   ```

5. Create PR to upstream (`kevin-hs-sohn/hipocampus`):
   ```bash
   gh pr create \
     --repo kevin-hs-sohn/hipocampus \
     --title "feat: add Codex and Gemini CLI platform support + CLAUDE.md" \
     --body "$(cat <<'EOF'
   ## Summary
   - Add CLAUDE.md for AI assistant onboarding (project structure, conventions, architecture docs)
   - Add Codex CLI platform support (`--platform codex`, `skills/hipocampus-core-codex/`)
   - Add Gemini CLI platform support (`--platform gemini`, `skills/hipocampus-core-gemini/`)
   - Update `cli/init.mjs` with platform detection and init logic for Codex/Gemini
   - Update README.md with installation guides for new platforms

   ## Changes
   - **New files:** `CLAUDE.md`, `skills/hipocampus-core-codex/SKILL.md`, `skills/hipocampus-core-gemini/SKILL.md`
   - **Modified:** `cli/init.mjs`, `README.md`, `package.json`

   ## Test plan
   - [ ] `npx hipocampus init --platform codex` works correctly
   - [ ] `npx hipocampus init --platform gemini` works correctly
   - [ ] Auto-detection works when `AGENTS.md` (Codex) or `GEMINI.md` (Gemini) exists
   - [ ] Existing platforms (Claude Code, OpenClaw) are unaffected
   EOF
   )"
   ```

6. After PR is created and reviewed, merge it:
   ```bash
   gh pr merge --repo kevin-hs-sohn/hipocampus --squash
   ```
