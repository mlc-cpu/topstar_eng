# TopStar 영어학원 숙제 체크리스트

네이버 카페 숙제 게시글을 수집해 모바일 체크리스트 웹앱(`public/index.html`)으로 만들고 GitHub Pages로 배포합니다.

## 핵심 포인트

- `그래그래그레이스` 작성 + 숙제 신호 제목(예: `~~반 숙제`, `Champ // ...`) 글만 사용
- 반별 최신 숙제 게시글 `2개`씩 노출 (`CLASS_POST_LIMIT`)
- 체크 상태는 각 기기 `localStorage`에 저장
- 정적 사이트라 GitHub Pages 배포 가능
- 반 버튼 클릭 시 필터만 변경하고, 데이터는 자동 갱신 주기(기본 5분)로 반영
- 수집/렌더링은 `npm run sync` 한 번으로 생성
- 앱 아이콘은 `assets/topstar-logo.png`를 사용

## 설치된 skills.sh 스킬

1. `github/awesome-copilot@playwright-explore-website`
2. `github/awesome-copilot@playwright-automation-fill-in-form`
3. `github/awesome-copilot@playwright-generate-test`
4. `chaterm/terminal-skills@cron`

## 동작 구조

1. `src/naverCafeCollector.js`
- 네이버 카페 게시판/게시글 수집

2. `src/checklistBuilder.js`
- 본문을 체크리스트 항목으로 파싱 + 게시글 날짜(`postDate`) 추출

3. `src/main.js`
- 작성자/제목 필터 + 반별 개수 제한 적용 후 `public/homework.json`, `public/index.html` 생성

4. `src/htmlTemplate.js`
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
- `REFRESH_COOLDOWN_SECONDS=300`
- `QUIET_HOURS_START=0`
- `QUIET_HOURS_END=6`
- `TIME_ZONE=Asia/Seoul`
- `REQUIRE_LOGIN=true`

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

5. 확인

```bash
npm run serve
```

## SSH 원격 상시 운영 (권장)

대상 서버: `jayoc@192.168.1.100`

1. 원격 설치 + 상시 실행 잡 등록

```bash
npm run remote:setup
```

- 원격에서 `npm ci`, `playwright chromium` 설치
- `launchd` 잡 등록:
- `com.jayoc.topstar_eng.server` (상시 웹서버)
- `com.jayoc.topstar_eng.sync` (1시간 주기 동기화, 00:00-06:00 자동 수집 스킵)

2. 원격 상태 확인

```bash
npm run remote:status
```

3. 원격 수동 동기화

```bash
npm run remote:sync
```

4. 태블릿 접속 주소

`http://192.168.1.100:4173`

### 로그인 필수 카페 주의

- 현재 카페는 로그인 세션이 없으면 `sync`가 실패하도록 설정되어 있습니다 (`REQUIRE_LOGIN=true`).
- 원격에서 세션을 만들려면 아래 중 하나가 필요합니다.
- 원격 서버에서 브라우저로 `npm run login` 1회 수행
- 또는 원격 `.env`에 `NAVER_ID`, `NAVER_PASSWORD` 설정 후 자동 로그인 사용

## GitHub Pages 배포

워크플로 파일: `.github/workflows/deploy-pages.yml`

- 5분 주기(00:00-06:00 KST 자동 수집 스킵, 스케줄 실행마다 0~240초 랜덤 지연) + 수동 실행 + `main` 푸시 시 배포
- `public/` 폴더를 GitHub Pages로 게시
- Repository `Settings > Pages`에서 Source를 `GitHub Actions`로 설정
- Pages 주소: `https://mlc-cpu.github.io/topstar_eng/`
- 짧은 주소: `https://is.gd/qDMgMU`

### GitHub Secrets

- `NAVER_CAFE_BOARD_URL` (필수)
- `NAVER_ID` (선택)
- `NAVER_PASSWORD` (선택)
- `NAVER_STORAGE_STATE_JSON` (선택, 세션 JSON 문자열)

자동수집을 최대한 안정적으로 유지하려면:
- `NAVER_STORAGE_STATE_JSON`을 우선 유지 (캡차 통과 세션 기준으로 먼저 수집 시도)
- `NAVER_ID` + `NAVER_PASSWORD`는 보조 fallback으로 함께 설정

### GitHub Variables(선택)

- `HOMEWORK_AUTHOR` (기본 `그래그래그레이스`)
- `CLASS_POST_LIMIT` (기본 `2`)
- `TIME_ZONE` (기본 `Asia/Seoul`)
- `MAX_POSTS`
- `DETAIL_CONCURRENCY` (기본 `4`)
- `REFRESH_COOLDOWN_SECONDS` (기본 `300`)
- `QUIET_HOURS_START` (기본 `0`)
- `QUIET_HOURS_END` (기본 `6`)
- `SCHEDULE_JITTER_MAX_SECONDS` (기본 `240`, 최대 `240`)
- `PAGE_TITLE`

## 운영 시 주의

- 네이버 보안정책(2FA/캡차)로 GitHub-hosted runner 로그인 자동화가 실패할 수 있습니다.
- 이 경우 로컬/자체 러너에서 `npm run sync` 후 Pages 배포하는 방식이 안정적입니다.
- 아이디/비번은 저장소에 커밋하지 않습니다.
