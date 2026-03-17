# hipocampus

AI 에이전트를 위한 드롭인 메모리 하네스. 인프라 불필요 — 파일만으로 동작합니다.

3계층 메모리 아키텍처와 5단계 압축 트리, 자동 로드되는 ROOT.md 토픽 인덱스, [qmd](https://github.com/tobi/qmd)를 통한 선택적 하이브리드 검색을 제공합니다. 명령어 하나로 설정 완료, [Claude Code](https://claude.ai/code), [OpenClaw](https://github.com/openclaw), [Codex](https://github.com/openai/codex), [Gemini CLI](https://github.com/google-gemini/gemini-cli)에서 즉시 사용 가능합니다.

## 빠른 시작

```bash
npx hipocampus init
```

프로젝트에 전체 메모리 구조를 생성합니다:

```
MEMORY.md              # 장기 메모리 (OpenClaw/Codex/Gemini — Claude Code는 플랫폼 자동 메모리 사용)
USER.md                # 사용자 프로필 (OpenClaw/Codex/Gemini — Claude Code는 플랫폼 자동 메모리 사용)
SCRATCHPAD.md          # 현재 작업 상태
WORKING.md             # 진행 중인 작업
TASK-QUEUE.md          # 작업 대기열 (대기 항목만)
memory/                # ROOT.md + 일일 로그 + 5단계 압축 트리
knowledge/             # 검색 가능한 지식 베이스
plans/                 # 작업 계획
hipocampus.config.json     # 설정
.claude/skills/        # 에이전트 스킬 (hipocampus-core, hipocampus-compaction, hipocampus-search)
```

추가로 수행하는 작업:
- [qmd](https://github.com/tobi/qmd) 설치를 통한 하이브리드 검색 (`--no-search`로 건너뛰기 가능)
- CLAUDE.md (Claude Code), AGENTS.md (OpenClaw/Codex), GEMINI.md (Gemini CLI)에 메모리 프로토콜 주입
- 자동 메모리 보존을 위한 사전 압축 훅 등록
- ROOT.md를 에이전트 시스템 프롬프트에 자동 로드
- 메모리 파일을 `.gitignore`에 추가

### 옵션

```bash
# 벡터 검색 비활성화 (BM25만, 디스크 ~2GB 절약)
npx hipocampus init --no-vector

# qmd 완전 건너뛰기 (압축 트리 + 수동 파일 읽기만)
npx hipocampus init --no-search

# 플랫폼 감지 수동 지정 (기본값: 자동 감지)
npx hipocampus init --platform claude-code
npx hipocampus init --platform openclaw
npx hipocampus init --platform codex
npx hipocampus init --platform gemini
```

## 무엇을 얻는가

Claude Code, OpenClaw, Codex, 또는 Gemini CLI 프로젝트에 hipocampus를 설치하면 에이전트가 **세션 간 영구 메모리**를 갖게 됩니다. 무엇을 작업했는지, 어떤 결정을 내렸는지, 어떤 교훈을 얻었는지 기억하며 — 모든 것을 컨텍스트에 로드하지 않고도 자신이 무엇을 알고 있는지 파악합니다.

효과는 전체 대화 기록을 모든 API 호출에 주입하는 것과 유사하지만, 토큰 비용은 극히 일부(100K+ 대신 ~3K 토큰)에 불과합니다.

### 대형 컨텍스트 윈도우를 쓰면 되지 않나?

최신 모델은 200K~1M 토큰 컨텍스트 윈도우를 지원합니다. 이론적으로 모든 과거 기록을 컨텍스트에 넣을 수 있지만, 두 가지 문제가 발생합니다:

1. **어텐션이 저하됩니다.** 컨텍스트가 많을수록 모델이 중요한 것에 집중하는 능력이 떨어집니다. 3주 전의 중요한 세부사항이 노이즈에 묻힙니다. 모든 것을 "보지만" 아무것에도 집중하지 못합니다.
2. **토큰 비용이 선형으로 증가합니다.** 모든 API 호출이 전체 컨텍스트 비용을 지불합니다. 호출마다 500K 토큰의 기록이 주입되면 일상 사용에 비용이 감당할 수 없게 됩니다 — 대부분의 컨텍스트는 현재 작업과 무관합니다.

Hipocampus는 ~3K 토큰으로 동일한 인식을 제공합니다: ROOT.md가 에이전트에게 무엇을 알고 있는지 알려주고, 에이전트는 필요할 때 구체적인 세부사항을 요청합니다.

Hipocampus 없이 에이전트가 자신이 무엇을 아는지 모르면 탐색합니다. 관련 컨텍스트를 찾기 위해 파일을 하나씩 읽으며 — 읽은 모든 파일은 세션이 끝날 때까지 세션 컨텍스트에 남습니다. 10개 파일을 읽고 버리면 30K+ 토큰의 낭비이며, 이후 세션의 모든 API 호출에서 비용을 지불합니다.

더 심각한 것은, 에이전트가 이미 답을 가지고 있다는 것을 모르면 처음부터 다시 조사합니다. 2주 전에 데이터베이스 마이그레이션 전략을 논의하고 결정을 내리고 근거를 문서화했지만 — 에이전트는 그 지식이 존재하는지 모르기 때문에 20분과 수천 토큰을 들여 같은 질문을 재조사합니다.

ROOT.md는 두 문제를 모두 해결합니다. ~3K 토큰으로 에이전트는 무엇을 알고 무엇을 모르는지 정확히 파악합니다 — 그래서 필요한 특정 파일을 검색하거나, 메모리를 건너뛰고 정말 새로운 것만 조사합니다. **진짜 절약은 "hipocampus vs 전체 기록 덤프"가 아닙니다 — 컨텍스트를 오염시키는 맹목적 탐색 대신 대상 검색, 이미 해결한 문제의 중복 조사 대신 즉시 회상입니다.**

## 문제

AI 에이전트는 세션 간에 모든 것을 잊습니다. 기존 솔루션은 각각 문제의 일부만 해결합니다:

**작업 상태 파일 (SCRATCHPAD.md, WORKING.md)** 은 현재 무엇이 일어나고 있는지에 대한 인식을 제공합니다 — 활성 작업, 보류 중인 결정, 최근 컨텍스트. 하지만 현재에 국한됩니다. 3주 전의 결정이나 수개월에 걸쳐 나타난 패턴을 에이전트에게 알려줄 수 없습니다.

**장기 메모리 (MEMORY.md / 플랫폼 자동 메모리)** 는 세션 간에 사실과 교훈을 유지합니다. 하지만 시스템 프롬프트 공간은 유한합니다 — 50줄 메모리는 첫 주에는 작동합니다. 한 달이 지나면 수백 개의 결정과 인사이트를 담을 수 없습니다. 무엇을 유지하고 무엇을 잃을지 선택해야 합니다. 더 심각한 것은 에이전트가 무엇을 잊었는지 모른다는 것입니다.

**RAG (벡터 검색, BM25)** 는 저장 문제를 해결합니다 — 수천 개의 파일을 인덱싱하고 검색합니다. 하지만 검색에는 **무엇을 검색할지 아는 것**이 필요합니다. 사용자가 "세션 타임아웃을 어떻게 처리해야 하나?"라고 물을 때, 에이전트는 3주 전에 정확히 이 문제를 논의했는지 알지 못합니다. 지식이 존재한다는 인식 없이는 외부 검색이나 추측으로 기본 설정됩니다. **모른다는 것을 모르는 것은 검색할 수 없습니다.**

### 각 요소가 할 수 있는 것과 없는 것

| 기능 | 작업 상태 | 장기 메모리 | RAG | 압축 트리 |
|---|---|---|---|---|
| 현재 작업 인식 | O | X | X | X |
| 세션 간 사실 유지 | X | O (오버플로 전까지) | O (인덱싱된 경우) | O (ROOT.md) |
| 수개월에 걸친 확장 | X | X (오버플로) | O | O (자체 압축) |
| 아는 것을 앎 | 현재만 | 맞는 것만 | X — 쿼리 필요 | **O — ROOT.md 인덱스** |
| 특정 과거 세부사항 검색 | X | X (정리된 경우) | **O — 시맨틱 검색** | O (트리 순회) |
| 검색할 줄 몰랐던 것 발견 | X | X | X | **O — 트리 브라우징** |

**단일 메커니즘으로는 충분하지 않습니다.** 작업 상태는 현재를, 장기 메모리는 핵심 사실을, RAG는 검색할 것을 알 때의 검색을, 압축 트리는 인식과 브라우징을 담당합니다. Hipocampus는 네 가지를 모두 결합합니다.

## 아키텍처 — 3계층 메모리

Hipocampus는 CPU 캐시 계층 구조처럼 메모리를 3계층으로 구성합니다:

### 계층 1 — 핫 (항상 로드, ~500줄)

모든 API 호출에 주입됩니다. 에이전트의 "워킹 메모리" — 지금 알아야 할 것.

| 파일 | 목적 | 이유 |
|------|---------|---------------|
| **SCRATCHPAD.md** | 활성 작업 상태 — 현재 발견사항, 보류 결정, 교차 작업 교훈 | 없으면 에이전트가 세션 중 진행 상황을 놓침 |
| **WORKING.md** | 진행 중인 작업 — 상태, 차단 요인, 다음 단계 | 없으면 에이전트가 어떤 작업이 활성인지 모름 |
| **TASK-QUEUE.md** | 대기 중인 작업 백로그 | 없으면 이전 세션의 후속 작업이 유실됨 |
| **memory/ROOT.md** | 압축 트리 루트 — 모든 누적 기록의 압축 인덱스 (~100줄) | **핵심 혁신.** 에이전트에게 전체 과거의 인식을 ~3K 토큰으로 제공. 전체 기록 주입과 동일하지만 50배 저렴 |
| **MEMORY.md** | 장기 사실, 규칙, 교훈 (OpenClaw/Codex/Gemini — Claude Code는 플랫폼 자동 메모리 사용) | 모든 상호작용에 적용되는 핵심 사실 |
| **USER.md** | 사용자 프로필, 선호 (OpenClaw/Codex/Gemini) | 세션 간 개인화 |

**ROOT.md는 특별한 주목이 필요합니다.** 모든 과거 대화와 작업을 4개 섹션으로 압축한 ~100줄의 기능적 인덱스입니다:

```markdown
## Active Context (최근 ~7일)
- hipocampus 오픈소스: 스펙 최종화, ROOT.md 포맷 리팩토링
- 법률 조사: 민법 제750조 브리프 → knowledge/legal-750.md

## Recent Patterns
- 압축 설계: 기능적 섹션이 시간순보다 O(1) 조회에 우수

## Historical Summary
- 2026-01~02: 초기 3계층 설계, clawy.pro K8s 런칭
- 2026-03: hipocampus 오픈소스, qmd 통합

## Topics Index
- hipocampus: 압축 트리, ROOT.md, 스킬 → spec/
- legal: 민법 제750조, 불법행위 책임 → knowledge/legal-750.md
- clawy.pro: K8s 인프라, 프로비저닝, 80봇 배포
```

에이전트는 **Topics Index**를 한 눈에 확인하여 결정합니다: 메모리 검색, 외부 검색, 또는 일반 지식으로 답변. O(1) 조회 — 파일 읽기 불필요. "모른다는 것을 모르는 것은 검색할 수 없다" 문제를 해결합니다.

### 계층 2 — 웜 (요청 시 읽기)

세부사항이 필요할 때 에이전트가 읽는 상세 기록. 기본적으로 로드되지 않음 — 계층 1이 관련 지식의 존재를 알릴 때 접근.

| 경로 | 목적 | 이유 |
|------|---------|---------------|
| `memory/YYYY-MM-DD.md` | 원시 일일 로그 — 구조화된 세션 기록 | 영구 진실의 원천. 모든 결정, 분석, 결과가 여기 기록됨. 압축 트리의 원료 |
| `knowledge/*.md` | 큐레이션된 지식 베이스 | 계층 1에 넣기엔 크지만 일일 로그에만 있기엔 너무 중요한 심층 문서 |
| `plans/*.md` | 작업 계획 및 실행 기록 | 여러 세션에 걸친 다단계 작업 |

### 계층 3 — 콜드 (검색 + 압축 트리)

수개월의 기록에서 정보를 찾기 위한 두 가지 검색 메커니즘:

**RAG (qmd)** — 최적 용도: 찾고자 하는 것을 알 때의 구체적 검색. "DB 마이그레이션 결정이 뭐였지?" → 시맨틱 검색이 찾음. 대규모 코퍼스에서 정밀 회수에 탁월.

**압축 트리** — 최적 용도: 무엇이 존재하는지 확실하지 않을 때의 브라우징과 발견. 트리는 계층적 드릴다운을 제공: ROOT.md → 월별 → 주별 → 일별 → 원시. RAG가 놓칠 때도 키워드 대신 기간별 브라우징이 가능.

```
압축 체인: 원시 → 일별 → 주별 → 월별 → 루트

memory/
├── ROOT.md                         # 루트 노드 — 계층 1, 자동 로드
├── 2026-03-15.md                   # 원시 일일 로그 — 영구
├── daily/2026-03-15.md             # 일별 압축 노드
├── weekly/2026-W11.md              # 주별 인덱스 노드
└── monthly/2026-03.md              # 월별 인덱스 노드
```

| RAG가 트리보다 나은 점 | 트리가 RAG보다 나은 점 |
|---|---|
| 시맨틱 유사성 검색 ("X와 관련된 것 찾기") | 쿼리 없는 인식 (ROOT.md가 어떤 주제가 존재하는지 앎) |
| 교차 주제 검색 (관련 없는 로그 간 연결 발견) | 시간 기반 브라우징 (1월에 무슨 일이 있었지?) |
| 대규모 코퍼스에서 빠른 조회 (수천 파일) | 계층적 드릴다운 (월 → 주 → 일 → 원시) |
| | 오프라인 작동 (임베딩 모델 불필요) |

결합하면: ROOT.md가 에이전트에게 무엇을 아는지 알려줌 → 에이전트가 검색을 결정 → RAG가 특정 문서를 찾음 → 또는 트리 순회로 기간을 브라우징.

### 스마트 압축 임계값

임계값 이하에서는 소스 파일이 그대로 복사/연결됩니다 — 정보 손실 없음. 임계값 이상에서는 LLM이 키워드 밀도 높은 요약을 생성합니다.

| 단계 | 임계값 | 이하 | 이상 |
|-------|-----------|-------|-------|
| 원시 → 일별 | ~200줄 | 그대로 복사 | LLM 키워드 밀도 높은 요약 |
| 일별 → 주별 | ~300줄 합산 | 일별 연결 | LLM 키워드 밀도 높은 요약 |
| 주별 → 월별 | ~500줄 합산 | 주별 연결 | LLM 키워드 밀도 높은 요약 |
| 월별 → 루트 | 항상 | 재귀적 재압축 | — |

### hipocampus 비교

| | 임시 MEMORY.md | OpenViking | **Hipocampus** |
|---|---|---|---|
| 설정 | 수동 | Python 서버 + 임베딩 모델 + 설정 | **`npx hipocampus init`** |
| 인프라 | 없음 | 서버 + DB | **없음 — 파일만** |
| 검색 | 없음 | 벡터 + 디렉토리 재귀 | **BM25 + 벡터 하이브리드 (qmd)** |
| 메모리 구조 | 비구조적 | 파일시스템 패러다임 | **3계층 (핫/웜/콜드)** |
| 에이전트 통합 | DIY | 플러그인 API | **드롭인 스킬** |
| 비용 최적화 | 없음 | L0/L1/L2 계층 로딩 | **프롬프트 캐시 친화적** |
| 아는 것을 앎 | 맞는 것만 (~50줄) | X (검색 필요) | **ROOT.md (~3K 토큰)** |
| 수개월 확장 | X — 오버플로 | O | **O — 자체 압축 트리** |

## 작동 방식

Hipocampus는 4가지 실행 메커니즘을 갖추고 있으며 — 모두 `npx hipocampus init`으로 자동 설정됩니다. 설치 후 수동 개입이 필요 없습니다.

**핵심 원칙: 모든 메모리 쓰기 작업은 서브에이전트로 디스패치됩니다.** 메인 세션 컨텍스트를 깨끗하게 유지합니다 — 메모리 관리가 사용자와의 대화를 오염시키지 않습니다.

### 1. 세션 프로토콜 (에이전트 구동)

hipocampus-core 스킬이 세션 시작과 매 작업 후에 수행할 내용을 에이전트에게 지시합니다. init 중 CLAUDE.md (Claude Code), AGENTS.md (OpenClaw/Codex), GEMINI.md (Gemini CLI)에 주입되어 에이전트가 자동으로 따릅니다.

**세션 시작 (FIRST RESPONSE RULE — 첫 사용자 메시지 전에 실행):**

```
1. hipocampus.config.json 읽기 → 플랫폼 결정
2. OpenClaw/Codex/Gemini: MEMORY.md 읽기 (장기 메모리)
3. OpenClaw/Codex/Gemini: USER.md 읽기 (사용자 프로필)
4. Claude Code 레거시: MEMORY.md 존재 시 읽기 (마이그레이션 지원)
5. SCRATCHPAD.md 읽기 — 현재 작업 상태
6. WORKING.md 읽기 — 활성 작업
7. TASK-QUEUE.md 읽기 — 대기 항목
8. 가장 최근 memory/daily/*.md 읽기 (이전 세션 컨텍스트)
9. 압축 유지보수 (서브에이전트): needs-summarization 파일 스캔 → LLM 요약 → hipocampus compact → qmd 재인덱싱
```

ROOT.md는 플랫폼이 자동 로드 — 수동 읽기 불필요.

**작업 완료 체크포인트 (서브에이전트 경유):**

작업 완료 후, 에이전트가 작업 요약을 작성하고 서브에이전트에 디스패치:

```
1. SCRATCHPAD 업데이트 — 발견사항, 결정, 교훈
2. OpenClaw/Codex/Gemini: MEMORY.md에 추가 — 추가 전용, Core 섹션 수정 금지
   Claude Code: 사실/교훈을 플랫폼 메모리에 저장 (자동 메모리가 네이티브 처리)
3. OpenClaw/Codex/Gemini: USER.md 업데이트 — 새로 알게 된 사용자 정보
4. memory/YYYY-MM-DD.md에 구조화된 로그 추가 (아래 참조)
5. WORKING 업데이트 — 완료된 작업 제거
6. TASK-QUEUE 업데이트 — 완료된 작업 제거, 후속 작업 추가
7. qmd update 실행
```

서브에이전트는 대화에 접근할 수 없으므로 에이전트가 작업 요약을 제공합니다. 완료된 작업은 WORKING과 TASK-QUEUE에서 제거됩니다 — 일일 로그가 영구 완료 기록입니다.

### 2. 구조화된 일일 로그 (압축 트리의 원료)

체크포인트의 4단계가 가장 중요합니다. 에이전트가 **구조화된 세션 덤프**를 작성합니다 — 원시 트랜스크립트가 아니라 논의된 각 주제의 큐레이션된 기록:

```markdown
## 투자 포트폴리오 구성
- request: 사용자가 중장기 포트폴리오 제안 요청
- analysis: 16개 종목 조사, Attention Economy 테마
- decision: 50% Core (AAPL, MSFT, ...) + 25% Growth + 20% Korea + 5% Cash
- user feedback: 한국 비중 확대 원함 → 다음 세션에서 조정
- references: knowledge/investment-research.md 생성
- tool calls: alpha-vantage 16회, fmp 4회

## Auth 미들웨어 리팩토링
- request: 컴플라이언스를 위한 세션 토큰 저장 검토
- work done: 현재 미들웨어 감사, 비준수 패턴 3개 식별
- decision: httpOnly 쿠키 + SameSite=Strict으로 마이그레이션
- pending: 마이그레이션 스크립트 필요, DB 스키마 변경 대기 중
```

이 형식은 일별 압축 노드가 키워드, 결정, 패턴을 추출할 수 있을 만큼 충분한 세부사항을 포함합니다 — 전체 압축 트리를 구성하는 원료입니다.

### 3. 사전 플러시 (에이전트 구동, 컨텍스트 손실 방지)

Claude Code와 OpenClaw 모두 대화 컨텍스트가 너무 길어지면 자동으로 압축합니다. 압축 전에 에이전트가 일일 로그에 쓰지 않았다면 그 세부사항은 **영원히 손실**됩니다.

hipocampus-core 스킬은 에이전트에게 최근 작업 요약과 함께 서브에이전트를 디스패치하여 사전에 플러시하도록 지시합니다:

- 체크포인트 없이 ~20 메시지마다
- 대화가 길어질 때
- 중요한 결정이나 분석이 방금 완료되었을 때
- 같은 작업 내에서 주제를 전환할 때

```
세션 진행 중
  → 작업 A 완료 → 서브에이전트: 체크포인트 → 일일 로그 추가
  → 작업 B 완료 → 서브에이전트: 체크포인트 → 일일 로그 추가
  → 작업 C 진행 중, 긴 대화...
    → ~20 메시지 → 서브에이전트: 사전 플러시 → 일일 로그 추가
    → 중요한 결정 → 서브에이전트: 사전 플러시 → 일일 로그 추가
  → 컨텍스트 윈도우 가득 참 → 사전 압축 훅 실행 (아래 참조)
```

일일 로그는 추가 전용이므로 같은 세션 내 여러 플러시도 안전합니다. 모든 쓰기는 서브에이전트를 통해 메인 세션을 깨끗하게 유지합니다.

### 4. 사전 압축 + LLM 압축 (플랫폼별)

PreCompact 훅은 `type: "command"`만 지원합니다 (에이전트 훅 없음). 기계적 압축은 자동 실행; LLM 처리는 세션 시작, 하트비트, 또는 수동 `/hipocampus-flush`로 지연됩니다.

**양쪽 플랫폼 — PreCompact 훅 (기계적만):**

```
컨텍스트 가득 참
  → PreCompact 훅 실행
  → hipocampus compact --stdin (커맨드 훅):
      1. 세션 트랜스크립트를 memory/.session-transcript-YYYY-MM-DD.jsonl에 백업
      2. 기계적 압축 (그대로/연결, needs-summarization 표시)
      3. ROOT.md 타임스탬프 업데이트 + MEMORY.md에 동기화 (OpenClaw)
      4. qmd update + qmd embed
  → 컨텍스트 압축 진행
```

**LLM 압축 (needs-summarization 처리):**

```
Claude Code:
  → 세션 시작 9단계: needs-summarization 확인 → hipocampus-compaction 스킬
  → 수동: /hipocampus-flush (플러시 + 전체 압축 + qmd 재인덱싱)

OpenClaw:
  → 하트비트마다 (~30분): HEARTBEAT.md가 needs-summarization 확인
  → 세션 시작 9단계: Claude Code와 동일
  → 수동: /hipocampus-flush
```

| 플랫폼 | 기계적 압축 | LLM 압축 | 수동 |
|----------|----------------------|----------------|--------|
| Claude Code | PreCompact 커맨드 훅 | 세션 시작 + `/hipocampus-flush` | `/hipocampus-flush` |
| OpenClaw | PreCompact 커맨드 훅 | HEARTBEAT.md + 세션 시작 | `/hipocampus-flush` |

### ROOT.md 자동 로딩

ROOT.md는 매 세션 시작 시 에이전트 컨텍스트에 있어야 합니다. 각 플랫폼의 메커니즘:

| 플랫폼 | 메커니즘 | init이 등록 |
|----------|-----------|-------------------|
| Claude Code | CLAUDE.md에 `@memory/ROOT.md` import | 자동 |
| OpenClaw | MEMORY.md에 `## Compaction Root` 섹션으로 임베드 (`hipocampus compact`가 자동 동기화) | 자동 |
| Codex | MEMORY.md에 `## Compaction Root` 섹션으로 임베드 (`hipocampus compact`가 자동 동기화) | 자동 |
| Gemini CLI | MEMORY.md에 `## Compaction Root` 섹션으로 임베드 (`hipocampus compact`가 자동 동기화) | 자동 |

OpenClaw, Codex, Gemini CLI는 고정된 파일 세트를 부트스트랩합니다 — ROOT.md를 부트스트랩 목록에 추가할 수 없습니다. 대신 hipocampus가 ROOT 콘텐츠를 항상 로드되는 MEMORY.md의 섹션으로 임베드합니다. `hipocampus compact` 명령이 이 섹션을 `memory/ROOT.md`와 동기화 상태로 유지합니다.

### 실행 요약

| 메커니즘 | 하는 일 | 시기 | 서브에이전트 | 비용 |
|-----------|-------------|------|----------|------|
| 세션 시작 (읽기) | SCRATCHPAD, WORKING, TASK-QUEUE, 최근 일일 로드 | 첫 사용자 메시지 | X (메인 세션) | 읽기 전용 |
| 세션 시작 (압축) | needs-summarization 파일 처리 | 첫 사용자 메시지 | **O** | LLM (파일 존재 시) |
| 작업 완료 체크포인트 | 모든 메모리 파일 + 일일 로그 업데이트 | 매 작업 완료 | **O** | LLM |
| 사전 플러시 | 컨텍스트를 일일 로그에 덤프 | ~20 메시지마다 | **O** | LLM |
| 사전 압축 훅 | 기계적 압축 + qmd 재인덱싱 | 컨텍스트 압축 전 | X (커맨드 훅) | LLM 없음 |
| TaskCompleted 훅 (CC) | 기계적 압축 | 매 작업 후 | X (커맨드 훅) | LLM 없음 |
| 하트비트 (OpenClaw) | needs-summarization 처리 | ~30분마다 | 격리 세션 | LLM (파일 존재 시) |
| `/hipocampus-flush` | 수동: 세션 → 일일 원시 + 압축 | 요청 시 | **O** | LLM |
| ROOT.md 자동 로드 | 시스템 프롬프트에 토픽 인덱스 | 매 세션 시작 | X (플랫폼) | ~3K 토큰 |

모든 것은 `npx hipocampus init`으로 설정됩니다. 사용자가 메모리 관리에 대해 생각할 필요가 없습니다.

## init 후 파일 레이아웃

```
project/
├── MEMORY.md                        (OpenClaw/Codex/Gemini)
├── USER.md                          (OpenClaw/Codex/Gemini)
├── SCRATCHPAD.md
├── WORKING.md
├── TASK-QUEUE.md
├── HEARTBEAT.md                     (OpenClaw 전용 — 하트비트 압축 체크리스트)
├── memory/
│   ├── ROOT.md                      # 전체 메모리 토픽 인덱스 (계층 1, 자동 로드)
│   ├── (원시 로그: YYYY-MM-DD.md)    # 영구 구조화된 세션 기록
│   ├── daily/                       # 일별 압축 노드
│   ├── weekly/                      # 주별 인덱스 노드
│   └── monthly/                     # 월별 인덱스 노드
├── knowledge/
├── plans/
├── .claude/
│   ├── skills/
│   │   ├── hipocampus-core/SKILL.md
│   │   ├── hipocampus-compaction/SKILL.md
│   │   └── hipocampus-search/SKILL.md
│   └── settings.json                # PreCompact 훅 (Claude Code)
└── hipocampus.config.json
```

## 설정

`hipocampus.config.json` (`npx hipocampus init`이 생성):

```json
{
  "platform": "claude-code",
  "search": {
    "vector": true,
    "embedModel": "auto"
  },
  "compaction": {
    "rootMaxTokens": 3000
  }
}
```

| 필드 | 타입 | 기본값 | 설명 |
|-------|------|---------|-------------|
| `platform` | string | 자동 감지 | `"claude-code"`, `"openclaw"`, `"codex"`, 또는 `"gemini"` — 메모리 파일 동작 결정 |
| `search.vector` | boolean | `true` | 벡터 임베딩 활성화 (디스크 ~2GB) |
| `search.embedModel` | string | `"auto"` | `"auto"`: embeddinggemma-300M, `"qwen3"`: CJK 최적화 |
| `compaction.rootMaxTokens` | number | `3000` | ROOT.md 최대 토큰 예산 (~100줄) |

### 검색

qmd는 선택사항입니다. init 시 `--no-search`로 완전히 건너뛸 수 있습니다. qmd 없이도 압축 트리는 직접 파일 읽기로 작동합니다 (ROOT.md → monthly/ → weekly/ → daily/ → 원시).

| 설정 | 기본값 | 설명 |
|---------|---------|-------------|
| `vector` | `true` | 로컬 GGUF 모델을 통한 벡터 검색 (~2GB). BM25 전용은 `false` |
| `embedModel` | `"auto"` | `"auto"`: embeddinggemma-300M, `"qwen3"`: CJK 최적화 |

## 스킬

Hipocampus는 4개의 에이전트 스킬을 `.claude/skills/`에 설치합니다:

- **hipocampus-core** — 세션 시작 프로토콜 + 작업 완료 체크포인트, 모든 메모리 쓰기는 서브에이전트 경유. 플랫폼 조건부 (Claude Code는 플랫폼 자동 메모리; OpenClaw은 MEMORY.md/USER.md 사용). 구조화된 일일 로그 형식, 사전 플러시 규칙, 압축 트리거 확인을 정의. 메모리를 작동하게 하는 핵심 규율.
- **hipocampus-compaction** — 5단계 압축 트리 구축 (일별/주별/월별/루트). 스마트 임계값: 임계값 이하 복사/연결, 이상 LLM 키워드 밀도 높은 요약. Fixed/tentative 생명주기 관리. 기계적 압축이 남긴 `needs-summarization` 노드 처리.
- **hipocampus-search** — 검색 가이드: ROOT.md Topics Index로 "이것에 대해 아는가?" 판단, 하이브리드 vs BM25 선택, 쿼리 구성 규칙, 압축 트리 폴백 순회, qmd 없이 작동하기 위한 안내.
- **hipocampus-flush** (`/hipocampus-flush`) — 서브에이전트를 통한 수동 메모리 플러시: 현재 세션 컨텍스트를 일일 원시 로그에 덤프 + 기계적 압축. 요청 시 세션 상태를 영구화. 이후 전체 LLM 압축은 hipocampus-compaction 실행.

## 작업 생명주기

```
TASK-QUEUE (백로그)             → 작업 선택
  ↓
WORKING (진행 중)              → 능동적 작업
  ↓
작업 완료                       → 서브에이전트 체크포인트:
  ├── 일일 로그 (영구)          ← 상세 구조화된 기록
  ├── WORKING                  ← 작업 제거
  ├── TASK-QUEUE               ← 작업 제거, 후속 작업 추가
  ├── SCRATCHPAD               ← 교훈, 결정 업데이트
  └── MEMORY.md                ← 핵심 사실 추가 (OpenClaw) / 플랫폼 메모리 (Claude Code)
```

TASK-QUEUE는 백로그 전용 — 완료된 작업은 제거되며 보관되지 않습니다. 일일 로그 (`memory/YYYY-MM-DD.md`)가 모든 완료 작업의 영구 기록입니다. 이렇게 TASK-QUEUE를 작고 앞으로의 일에 집중하도록 유지합니다.

## 스펙

메모리 시스템은 [`spec/`](./spec/)에 공식 명세되어 있습니다:

- [layers.md](./spec/layers.md) — 3계층 아키텍처, ROOT.md 근거, fixed/tentative 노드 개념
- [file-formats.md](./spec/file-formats.md) — ROOT.md와 압축 노드를 포함한 각 파일의 정확한 형식
- [compaction.md](./spec/compaction.md) — 5단계 압축 트리 알고리즘, 스마트 임계값, 생명주기
- [checkpoint.md](./spec/checkpoint.md) — 세션 시작 + 작업 완료 체크포인트 프로토콜 (플랫폼 조건부)

## 멀티 개발자 프로젝트

`npx hipocampus init`은 메모리 파일을 `.gitignore`에 자동 추가합니다 — 개인 메모리는 커밋해서는 안 됩니다.

**커밋할 것:** `hipocampus.config.json`과 `.claude/skills/` — 공유 프로젝트 메모리 구조를 정의합니다. 모든 팀원이 동일한 스킬 문서를 받습니다.

**커밋하지 말 것:** 나머지 모든 것 (MEMORY.md, USER.md 존재 시, SCRATCHPAD, WORKING, TASK-QUEUE, memory/, knowledge/, plans/)은 개인 컨텍스트입니다. 각 개발자가 `npx hipocampus init`을 실행하여 자신만의 메모리를 설정합니다.

## 라이선스

MIT
