# Homework Sync Agents

## Objective
네이버 카페 숙제 공지를 태블릿 체크리스트 HTML로 자동 변환/배포한다.

## Orchestrator
- `homework-orchestrator`
- 순서: 수집 -> 파싱 -> 퍼블리시 -> 스케줄 운영

## Sub-agents
1. `cafe-collector-agent`
- 책임: 네이버 로그인, 게시판 최신 글 추출
- 사용 스킬: `playwright-cli`, `playwright-explore-website`, `playwright-automation-fill-in-form`
- 산출물: raw post payload

2. `homework-parser-agent`
- 책임: 게시글 본문을 체크리스트 항목으로 변환
- 사용 스킬: local parser (`src/checklistBuilder.js`)
- 산출물: checklist-ready JSON

3. `html-publisher-agent`
- 책임: 체크리스트 JSON/HTML 생성 및 정적 페이지 반영
- 사용 스킬: `playwright-generate-test`, `webapp-testing`
- 산출물: `public/homework.json`, `public/index.html` (최근 `RECENT_DAYS`, 기본 2일만 노출)

4. `schedule-ops-agent`
- 책임: cron 기반 주기 실행, run state 관리
- 사용 스킬: `cron`
- 산출물: `.state/run-state.json`

## Credentials
- 기본 권장: `npm run login`으로 수동 로그인 세션(`.state/naver-storage-state.json`) 저장.
- 자동 로그인 필요 시에만 `NAVER_ID`, `NAVER_PASSWORD`를 `.env`에서 읽는다.
- 저장소 커밋 금지.
