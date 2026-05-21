# TopStar 영어학원 숙제 체크리스트

네이버 카페 숙제 게시글을 수집해 모바일 체크리스트 웹앱(`public/index.html`)으로 만들고 GitHub Pages로 배포합니다.

## 핵심 포인트

- `그래그래그레이스` 작성 + 숙제 신호 제목(예: `~~반 숙제`, `Champ // ...`) 글만 사용
- 반별 최신 숙제 게시글 `2개`씩 노출 (`CLASS_POST_LIMIT`)
- 체크 상태는 각 기기 `localStorage`에 저장
- 정적 사이트라 GitHub Pages 배포 가능
- 수집은 `HTTP API(cookie 세션)` 우선, 실패 시 `Playwright` 폴백
- 반 버튼 클릭 시 필터만 변경하고, 데이터는 자동 갱신 주기(기본 10분)로 반영
- 수집/렌더링은 `npm run sync` 한 번으로 생성
- `npm run build`는 생성 후 `homework.json` 구조/최소 게시글 수를 검증
- GitHub Actions 배포를 기본으로 사용하되, 네이버가 GitHub-hosted runner 로그인을 막는 경우 로컬 Mac 게시 경로를 사용
- 앱 아이콘은 `assets/topstar-logo.png`를 사용

## 설치된 skills.sh 스킬

1. `github/awesome-copilot@playwright-explore-website`
2. `github/awesome-copilot@playwright-automation-fill-in-form`
3. `github/awesome-copilot@playwright-generate-test`
4. GitHub Actions schedule

## 동작 구조

1. `src/naverCafeCollector.js`
- 네이버 카페 게시판/게시글 수집 (`HTTP API` 우선, 실패 시 브라우저 수집)

2. `src/checklistBuilder.js`
- 본문을 체크리스트 항목으로 파싱 + 게시글 날짜(`postDate`) 추출

3. `src/main.js`
- 작성자/제목 필터 + 반별 개수 제한 적용 후 `public/homework.json`, `public/index.html` 생성

4. `src/validateHomeworkData.js`
- 생성된 `homework.json`이 비어 있거나 필수 필드가 빠진 경우 배포 전 실패 처리

5. `src/refreshStorageState.js`
- 저장된 네이버 세션을 브라우저로 열어 주기적으로 다시 저장하고, Actions Secret 자동 갱신에 사용

6. `src/htmlTemplate.js`
- 모바일 우선 체크리스트 UI 렌더링

## 로컬 실행

1. 설치

```bash
npm install
npm run install-browser
```

2. 환경변수

```bash
cp .env.example .env
```

최소 필수값:
- `NAVER_CAFE_BOARD_URL`

권장값:
- `HOMEWORK_AUTHOR=그래그래그레이스`
- `CLASS_POST_LIMIT=2`
- `MAX_POSTS=80`
- `DETAIL_CONCURRENCY=4`
- `REFRESH_COOLDOWN_SECONDS=600`
- `QUIET_HOURS_START=0`
- `QUIET_HOURS_END=6`
- `TIME_ZONE=Asia/Seoul`
- `MIN_GENERATED_POSTS=1`
- `MIN_MATCHED_CLASSES=1`
- `MAX_GENERATED_AGE_MINUTES=30`
- `ALLOW_STALE_FALLBACK_DEPLOY=false`
- `NAVER_SESSION_REFRESH_HOUR=7`
- `REQUIRE_LOGIN=true`
- `LOCAL_AUTO_SYNC=false`

3. 로그인 세션 저장(권장)

```bash
npm run login
```

- 로그인 필수 카페에서는 이 단계가 사실상 필수입니다.
- `REQUIRE_LOGIN=true` 상태에서 세션이 없으면 `npm run sync`가 명확하게 실패하며 로그인 안내 메시지를 출력합니다.

4. 정적 페이지 생성

```bash
npm run sync
```

5. 생성 결과 검증

```bash
npm run validate
```

6. 확인

```bash
npm run serve
```

`npm run serve`는 로컬 미리보기용입니다. 기본값에서는 주기 수집을 실행하지 않으며, 운영용 상시 서버는 사용하지 않습니다.

## GitHub 운영

워크플로 파일: `.github/workflows/deploy-pages.yml`

- 15분 간격 체크(`07,22,37,52`분 실행, 00:00-06:00 KST 자동 수집 스킵, 스케줄 실행마다 0~240초 랜덤 지연) + 실제 수집은 10분 쿨다운 이후에만 수행 + 수동 실행 + `main` 푸시 시 배포
- 새 배포 실행이 시작되면 이전 Pages 실행은 취소되어 배포 큐가 오래 밀리지 않게 합니다.
- GitHub Actions 공식 액션은 Node 24 대응 버전으로 고정해 Node 20 deprecation 경고를 피합니다.
- `public/` 폴더를 GitHub Pages로 게시
- `[local-sync]` 커밋은 네이버 수집을 다시 실행하지 않고 커밋된 `docs/` 결과물을 그대로 Pages에 배포
- Repository `Settings > Pages`에서 Source를 `GitHub Actions`로 설정
- Pages 주소: `https://mlc-cpu.github.io/topstar_eng/`
- 짧은 주소: `https://is.gd/qDMgMU`
- 운영 상태는 배포된 `homework.json`의 `generatedAt`과 `public/run-state.json` 아티팩트를 기준으로 확인합니다.

### GitHub Secrets

- `NAVER_CAFE_BOARD_URL` (필수)
- `NAVER_ID` (선택)
- `NAVER_PASSWORD` (선택)
- `NAVER_COOKIE_HEADER` (선택, 로그인된 브라우저의 네이버 요청 `Cookie` 헤더)
- `NAVER_STORAGE_STATE_JSON` (선택, 세션 JSON 문자열)
- `GH_SECRET_UPDATE_TOKEN` (선택, 자동 세션 갱신용 PAT)

자동수집을 최대한 안정적으로 유지하려면:
- `NAVER_COOKIE_HEADER` 또는 `NAVER_STORAGE_STATE_JSON`을 우선 유지 (HTTP API 본문 수집에 사용)
- `NAVER_ID` + `NAVER_PASSWORD`는 보조 fallback으로 함께 설정
- 세션이 만료되면 GitHub Actions가 보조 계정 정보로 재로그인하고 새 세션을 다시 저장
- 매일 `NAVER_SESSION_REFRESH_HOUR`시 02분(KST 기본 07:02)에 저장된 세션을 사전 갱신하고, 성공하면 Secret을 다시 저장
- 생성된 `homework.json`이 비어 있거나 필수 필드가 깨지면 배포 전에 실패 처리
- 워크플로는 인증정보를 필요한 단계에만 주입하고, 실행 후 세션 파일을 즉시 삭제
- 2FA/캡차 등으로 자동 로그인이 막힐 때만 `npm run login`으로 새 세션을 만든 뒤 `NAVER_STORAGE_STATE_JSON`을 갱신
- GitHub-hosted runner 자동 로그인이 계속 막히면, 로컬 Mac 게시 모드(`scripts/local-sync-and-publish.sh`)를 사용합니다.
  이 모드는 이 Mac에 저장된 네이버 세션으로 `docs/`를 생성하고 `[local-sync]` 커밋을 푸시해 GitHub Pages만 배포하게 합니다.
- 수동 실행(`workflow_dispatch`), `main` 푸시, 스케줄 실행 모두 수집이 실패하면 기존 정적 파일을 재배포하지 않고 실패로 표시합니다.
  기존 Pages 배포본은 그대로 남지만, Actions가 실패 상태가 되어 문제를 바로 확인할 수 있습니다.
- 예외적으로 실패해도 기존 파일을 재배포해야 하는 운영 모드가 필요하면 `ALLOW_STALE_FALLBACK_DEPLOY=true`를 GitHub Variable로 설정합니다.

### 로컬 Mac 게시 모드

네이버가 GitHub-hosted runner의 로그인/쿠키를 반복해서 무효 처리하면 이 모드를 사용합니다.

```bash
npm run login
scripts/install-local-sync-launchd.sh
```

- `npm run login`으로 `.state/naver-storage-state.json`을 한 번 저장합니다.
- 설치 스크립트는 launchd 작업 `com.mullae.topstar-eng-local-sync`를 등록합니다.
- 기본 15분마다 실행되고, `npm run sync -- --scheduled`의 조용한 시간/쿨다운 정책을 그대로 따릅니다.
- 숙제 내용이나 정적 파일이 실제로 바뀌면 `docs/`만 커밋하고 `Update homework data [local-sync]` 메시지로 푸시합니다. `generatedAt`만 바뀐 결과는 배포 큐가 밀리지 않도록 버립니다.
- GitHub Actions는 `[local-sync]` 커밋을 감지하면 네이버 수집을 건너뛰고 `docs/`를 그대로 Pages에 배포합니다.
- 로그: `.logs/local-sync.log`, `.logs/launchd.out.log`, `.logs/launchd.err.log`
- 해제: `scripts/uninstall-local-sync-launchd.sh`

세션 만료 자동 갱신(권장):
- `GH_SECRET_UPDATE_TOKEN`을 설정하면, 워크플로가 실행 중 생성/갱신된 `.state/naver-storage-state.json`을
  `NAVER_STORAGE_STATE_JSON` Secret으로 자동 덮어씁니다.
- 워크플로는 먼저 기본 `github.token`으로 갱신을 시도합니다.
- 권한 부족으로 실패하면 `GH_SECRET_UPDATE_TOKEN`(해당 저장소의 Actions Secret 쓰기 권한 포함)을 설정하면 됩니다.

### 수동 운영

- 즉시 갱신: GitHub Actions의 `Build and Deploy Homework Page` 워크플로에서 `Run workflow`
- 설정 변경: Repository `Settings > Secrets and variables > Actions`에서 Secret/Variable 수정
- 배포 확인: `Actions` 탭의 최신 실행 로그와 Pages 주소의 `homework.json` 확인

### GitHub Variables(선택)

- `HOMEWORK_AUTHOR` (기본 `그래그래그레이스`)
- `CLASS_POST_LIMIT` (기본 `2`)
- `TIME_ZONE` (기본 `Asia/Seoul`)
- `MAX_POSTS`
- `DETAIL_CONCURRENCY` (기본 `4`)
- `REFRESH_COOLDOWN_SECONDS` (기본 `600`)
- `QUIET_HOURS_START` (기본 `0`)
- `QUIET_HOURS_END` (기본 `6`)
- `SCHEDULE_JITTER_MAX_SECONDS` (기본 `240`, 최대 `240`)
- `PAGE_TITLE`
- `MIN_GENERATED_POSTS` (기본 `1`)
- `MIN_MATCHED_CLASSES` (기본 `1`)
- `MAX_GENERATED_AGE_MINUTES` (기본 `30`)
- `ALLOW_STALE_FALLBACK_DEPLOY` (기본 `false`)
- `LOCAL_PUBLISH_MODE` (로컬 Mac 게시 모드 사용 시 `true`; GitHub-hosted 스케줄 수집은 스킵)
- `NAVER_SESSION_REFRESH_HOUR` (기본 `7`, KST 기준)

## 운영 시 주의

- 네이버 보안정책(2FA/캡차)로 GitHub-hosted runner 로그인 자동화가 실패할 수 있습니다.
- 이 경우에만 로컬에서 `npm run login`으로 새 세션을 만든 뒤 `NAVER_STORAGE_STATE_JSON` Secret을 갱신하면 됩니다.
- 아이디/비번은 저장소에 커밋하지 않습니다.

## 이어서 작업할 때

- 이 저장소는 현재 Git 커밋, GitHub Actions 워크플로, GitHub Secrets 기준으로 이어서 작업할 수 있게 정리되어 있습니다.
- Codex에서 이 폴더만 다시 열어도 대부분의 운영 상태를 복원할 수 있습니다.
- 체크 상태는 서버가 아니라 각 기기 브라우저의 `localStorage`에 저장되므로 기기끼리 공유되지 않습니다.

재개할 때 먼저 확인할 것:
- `git status -sb`
- `gh run list --workflow 'Build and Deploy Homework Page' --repo mlc-cpu/topstar_eng --limit 10`
- `curl -sSL 'https://mlc-cpu.github.io/topstar_eng/homework.json' | jq '{generatedAt, refreshCooldownSeconds: .source.refreshCooldownSeconds, postCount: (.posts|length)}'`

현재 운영 기준:
- GitHub Actions는 15분 간격으로 상태를 체크하고, 실제 수집은 10분 쿨다운이 지난 경우에만 수행합니다.
- GitHub-hosted runner 수집이 네이버 인증에서 막히면 로컬 Mac 게시 모드가 우선 운영 경로입니다.
- `LOCAL_PUBLISH_MODE=true`이면 GitHub-hosted 스케줄 수집은 실패 로그를 만들지 않고 스킵합니다.
- 세션은 `NAVER_STORAGE_STATE_JSON` 또는 로컬 `.state/naver-storage-state.json`으로 유지합니다.
- UI 상태 문구는 마지막 업데이트 경과 시간과 자동 업데이트 대기 상태를 함께 표시합니다.
