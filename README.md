# TopStar 영어학원 숙제 체크리스트

네이버 카페 숙제 게시글을 수집해 모바일 체크리스트 웹앱(`public/index.html`)으로 만들고 GitHub Pages로 배포합니다.

## 핵심 포인트

- 최근 `RECENT_DAYS`(기본 2)개의 **게시일**만 노출 (예: 3/5, 3/3)
- 체크 상태는 각 기기 `localStorage`에 저장
- 정적 사이트라 GitHub Pages 배포 가능
- 앱 열 때 1회 로드, 실행 중에는 상단 `새로고침` 버튼으로만 갱신
- 수집/렌더링은 `npm run sync` 한 번으로 생성

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
- 최근 2일 필터 적용 후 `public/homework.json`, `public/index.html` 생성

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
- `RECENT_DAYS=2`
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
- `com.jayoc.engband.server` (상시 웹서버)
- `com.jayoc.engband.sync` (30분 주기 동기화)

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

- 30분 주기 + 수동 실행 + `main` 푸시 시 배포
- `public/` 폴더를 GitHub Pages로 게시
- Repository `Settings > Pages`에서 Source를 `GitHub Actions`로 설정

### GitHub Secrets

- `NAVER_CAFE_BOARD_URL` (필수)
- `NAVER_ID` (선택)
- `NAVER_PASSWORD` (선택)
- `NAVER_STORAGE_STATE_JSON` (선택, 세션 JSON 문자열)

### GitHub Variables(선택)

- `RECENT_DAYS` (기본 `2`)
- `TIME_ZONE` (기본 `Asia/Seoul`)
- `MAX_POSTS`
- `PAGE_TITLE`

## 운영 시 주의

- 네이버 보안정책(2FA/캡차)로 GitHub-hosted runner 로그인 자동화가 실패할 수 있습니다.
- 이 경우 로컬/자체 러너에서 `npm run sync` 후 Pages 배포하는 방식이 안정적입니다.
- 아이디/비번은 저장소에 커밋하지 않습니다.
