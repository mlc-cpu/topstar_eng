function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderHomeworkHtml({ pageTitle }) {
  const title = escapeHtml(pageTitle);

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${title}</title>
    <meta name="theme-color" content="#0f172a" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="${title}" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="icon" href="./icon.png" type="image/png" />
    <link rel="shortcut icon" href="./icon.png" type="image/png" />
    <link rel="icon" href="./icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="./icon.png" />
    <style>
      :root {
        --bg-top: #102a43;
        --bg-bottom: #0b1526;
        --card: #ffffff;
        --line: #d6deef;
        --text: #102240;
        --muted: #5e6e87;
        --accent: #1f7aff;
        --accent-soft: #dbe9ff;
        --danger: #c22f2f;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
      }

      body {
        min-height: 100vh;
        font-family: "Pretendard", "Noto Sans KR", sans-serif;
        color: var(--text);
        background:
          radial-gradient(90rem 40rem at 10% -20%, #1f4f8a 0%, transparent 42%),
          radial-gradient(90rem 40rem at 100% -10%, #164e63 0%, transparent 38%),
          linear-gradient(170deg, var(--bg-top) 0%, var(--bg-bottom) 72%);
      }

      main {
        max-width: 520px;
        margin: 0 auto;
        min-height: 100vh;
        padding: calc(env(safe-area-inset-top) + 14px) 14px calc(env(safe-area-inset-bottom) + 22px);
      }

      .hero {
        position: sticky;
        top: 0;
        z-index: 5;
        background: linear-gradient(180deg, rgba(11, 21, 38, 0.96), rgba(11, 21, 38, 0.76));
        backdrop-filter: blur(8px);
        border: 1px solid rgba(210, 225, 255, 0.2);
        border-radius: 18px;
        padding: 14px;
        color: #f3f7ff;
      }

      h1 {
        margin: 0;
        font-size: 1.2rem;
        letter-spacing: -0.01em;
      }

      .meta {
        margin-top: 8px;
        font-size: 0.8rem;
        color: #d5e4ff;
        line-height: 1.4;
      }

      .class-control {
        margin-top: 8px;
        display: flex;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 2px;
      }

      .class-option.active {
        border-color: #b6ceff;
        background: #e6efff;
        color: #083c8c;
        font-weight: 700;
      }

      button {
        border: 0;
        border-radius: 10px;
        padding: 8px 12px;
        font-size: 0.84rem;
        background: rgba(255, 255, 255, 0.16);
        color: #ffffff;
        cursor: pointer;
      }

      button:disabled {
        opacity: 0.65;
        cursor: default;
      }

      button.class-option {
        min-height: 24px;
        border-radius: 999px;
        border: 1px solid rgba(210, 225, 255, 0.35);
        padding: 2px 8px;
        font-size: 0.76rem;
        line-height: 1.1;
        background: rgba(255, 255, 255, 0.12);
        color: #eef4ff;
      }

      .list {
        margin-top: 12px;
        display: grid;
        gap: 7px;
      }

      .post {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 11px;
        box-shadow: 0 10px 20px rgba(5, 15, 30, 0.12);
      }

      .post-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
      }

      .post-title {
        margin: 0;
        font-size: 0.98rem;
        line-height: 1.35;
        letter-spacing: -0.01em;
      }

      .post-title a {
        color: var(--text);
        text-decoration: none;
      }

      .post-date {
        flex-shrink: 0;
        font-size: 0.74rem;
        font-weight: 700;
        color: #0a3d91;
        background: var(--accent-soft);
        border: 1px solid #b6ceff;
        border-radius: 999px;
        padding: 4px 9px;
      }

      .progress-row {
        margin-top: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }

      .progress-text {
        font-size: 0.78rem;
        color: var(--muted);
      }

      .bar {
        flex: 1;
        height: 7px;
        border-radius: 999px;
        background: #ebf1ff;
        overflow: hidden;
      }

      .bar-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #4aa3ff, #2f64ff);
        transition: width 180ms ease;
      }

      .items {
        margin: 8px 0 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 5px;
      }

      .item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 8px;
        border-radius: 12px;
        background: #f9fbff;
        border: 1px solid #e4ebfb;
      }

      .item input {
        width: 24px;
        height: 24px;
        margin: 0;
        margin-top: 1px;
        accent-color: var(--accent);
        flex-shrink: 0;
      }

      .item-text {
        font-size: 0.9rem;
        line-height: 1.3;
      }

      .item.done .item-text {
        color: #7a879b;
        text-decoration: line-through;
      }

      .empty,
      .error {
        margin-top: 14px;
        border-radius: 14px;
        padding: 14px;
        font-size: 0.9rem;
      }

      .empty {
        background: #f4f7ff;
        border: 1px dashed #c5d5f9;
        color: #4f6280;
      }

      .error {
        background: #fff1f1;
        border: 1px solid #f4c5c5;
        color: var(--danger);
      }

      @media (min-width: 640px) {
        main {
          padding-top: 18px;
        }

        h1 {
          font-size: 1.35rem;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <h1>${title}</h1>
        <div class="meta" id="status">데이터 로딩 중...</div>
        <div class="class-control" id="class-options" aria-label="반 선택"></div>
      </section>

      <section class="list" id="content"></section>
    </main>

    <script>
      const STORAGE_PREFIX = "homework-check:";
      const DEFAULT_CLASS_KEY = "homework-default-class";
      const DEFAULT_CLASS = "Ace";
      const CLASS_ORDER = ["Ace", "Star", "Top", "Peak", "Champion", "Radiant"];
      const CLASS_SET = new Set(CLASS_ORDER);
      const CLASS_LABEL_MAP = {
        Ace: "Ace",
        Star: "Star",
        Top: "Top",
        Peak: "Peak",
        Champion: "Champion",
        Radiant: "Radiant",
      };
      const CLASS_ALIAS_MAP = {
        ace: "Ace",
        star: "Star",
        top: "Top",
        peak: "Peak",
        champ: "Champion",
        champion: "Champion",
        radiant: "Radiant",
      };
      let cachedData = null;
      let knownClasses = [...CLASS_ORDER];

      function key(postId, itemId) {
        return STORAGE_PREFIX + postId + ":" + itemId;
      }

      function getChecked(postId, itemId) {
        return localStorage.getItem(key(postId, itemId)) === "1";
      }

      function setChecked(postId, itemId, checked) {
        const storageKey = key(postId, itemId);
        if (checked) {
          localStorage.setItem(storageKey, "1");
        } else {
          localStorage.removeItem(storageKey);
        }
      }

      function normalizeClassText(value) {
        return String(value ?? "")
          .replaceAll("☆", " ")
          .replaceAll("★", " ")
          .replace(/\s+/g, " ")
          .trim();
      }

      function canonicalizeClassName(value) {
        const cleaned = normalizeClassText(value);
        if (!cleaned) {
          return "";
        }

        const token = cleaned.toLowerCase().replace(/\s+/g, "");
        return CLASS_ALIAS_MAP[token] || cleaned;
      }

      function getClassLabel(className) {
        return CLASS_LABEL_MAP[className] || className;
      }

      function getDefaultClass() {
        const stored = localStorage.getItem(DEFAULT_CLASS_KEY) || "";
        const normalized = canonicalizeClassName(stored);
        if (normalized) {
          if (stored !== normalized) {
            localStorage.setItem(DEFAULT_CLASS_KEY, normalized);
          }
          return normalized;
        }

        localStorage.setItem(DEFAULT_CLASS_KEY, DEFAULT_CLASS);
        return DEFAULT_CLASS;
      }

      function setDefaultClass(className) {
        const normalized = canonicalizeClassName(className) || DEFAULT_CLASS;
        localStorage.setItem(DEFAULT_CLASS_KEY, normalized);
      }

      function extractClassName(post) {
        const explicitClass = canonicalizeClassName(post.className || post.classLabel || post.class);
        if (explicitClass) {
          return explicitClass;
        }

        const titleText = String(post.title || "").trim();
        if (!titleText) {
          return "기타";
        }

        const homeworkMatch = titleText.match(/^(.+?)\s*반\s*숙제/i);
        if (homeworkMatch?.[1]) {
          const className = canonicalizeClassName(homeworkMatch[1]);
          if (className) {
            return className;
          }
        }

        for (const separator of ["//", "|", "｜"]) {
          const separatorIndex = titleText.indexOf(separator);
          if (separatorIndex > -1) {
            const className = canonicalizeClassName(titleText.slice(0, separatorIndex));
            if (className) {
              return className;
            }
          }
        }

        return canonicalizeClassName(titleText);
      }

      function collectClassNames(posts) {
        const seen = new Set(CLASS_ORDER);
        const posted = new Set();
        for (const post of posts) {
          const className = extractClassName(post);
          if (className) {
            seen.add(className);
            posted.add(className);
          }
        }
        return {
          all: Array.from(seen),
          inPosts: Array.from(posted),
        };
      }

      function prioritizePosts(posts) {
        const defaultClass = getDefaultClass();
        if (!defaultClass) {
          return [...posts];
        }

        const preferred = [];
        const others = [];
        for (const post of posts) {
          if (extractClassName(post) === defaultClass) {
            preferred.push(post);
          } else {
            others.push(post);
          }
        }
        return preferred.concat(others);
      }

      async function chooseDefaultClass(className) {
        setDefaultClass(className);
        const refreshResult = await requestRefreshFromServer();
        await render({ useCache: false, refreshResult });
      }

      function createClassOptionButton(option, defaultClass) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "class-option";
        button.textContent = option.label;
        if (option.value === defaultClass) {
          button.classList.add("active");
        }
        button.addEventListener("click", () => {
          chooseDefaultClass(option.value).catch(() => undefined);
        });
        return button;
      }

      function renderClassOptions() {
        const classOptionsEl = document.getElementById("class-options");
        const defaultClass = getDefaultClass();
        classOptionsEl.innerHTML = "";

        const classSequence = [...CLASS_ORDER].concat(
          knownClasses.filter((className) => !CLASS_SET.has(className))
        );

        for (const className of classSequence) {
          classOptionsEl.appendChild(
            createClassOptionButton(
              { label: getClassLabel(className), value: className },
              defaultClass
            )
          );
        }
      }

      async function requestRefreshFromServer() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        try {
          const response = await fetch("./api/refresh", {
            method: "POST",
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) {
            return null;
          }

          const payload = await response.json().catch(() => null);
          return payload && typeof payload === "object" ? payload : null;
        } catch {
          return null;
        } finally {
          clearTimeout(timeout);
        }
      }

      function renderPost(post) {
        const article = document.createElement("article");
        article.className = "post";

        const head = document.createElement("div");
        head.className = "post-head";

        const title = document.createElement("h2");
        title.className = "post-title";

        const link = document.createElement("a");
        link.href = post.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = post.title || "숙제 공지";
        title.appendChild(link);

        const date = document.createElement("div");
        date.className = "post-date";
        date.textContent = post.postDate || post.publishedAt || "날짜 미확인";

        head.appendChild(title);
        head.appendChild(date);

        const progressRow = document.createElement("div");
        progressRow.className = "progress-row";

        const progressText = document.createElement("div");
        progressText.className = "progress-text";

        const bar = document.createElement("div");
        bar.className = "bar";
        const barFill = document.createElement("div");
        barFill.className = "bar-fill";
        bar.appendChild(barFill);

        progressRow.appendChild(progressText);
        progressRow.appendChild(bar);

        const list = document.createElement("ul");
        list.className = "items";

        function refreshProgress() {
          const all = (post.items || []).length;
          const done = list.querySelectorAll('input[type="checkbox"]:checked').length;
          const ratio = all === 0 ? 0 : Math.round((done / all) * 100);
          progressText.textContent = "완료 " + done + " / " + all;
          barFill.style.width = ratio + "%";
        }

        for (const item of post.items || []) {
          const li = document.createElement("li");
          li.className = "item";

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = getChecked(post.postId, item.id);
          if (checkbox.checked) {
            li.classList.add("done");
          }

          const text = document.createElement("label");
          text.className = "item-text";
          text.textContent = item.text;

          checkbox.addEventListener("change", () => {
            setChecked(post.postId, item.id, checkbox.checked);
            li.classList.toggle("done", checkbox.checked);
            refreshProgress();
          });

          li.appendChild(checkbox);
          li.appendChild(text);
          list.appendChild(li);
        }

        article.appendChild(head);
        article.appendChild(progressRow);
        article.appendChild(list);
        refreshProgress();

        return article;
      }

      async function loadData() {
        const response = await fetch("./homework.json?t=" + Date.now(), { cache: "no-store" });
        if (!response.ok) {
          throw new Error("homework.json 응답 실패: " + response.status);
        }

        return response.json();
      }

      function renderEmpty(contentEl) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "숙제 공지가 없습니다.";
        contentEl.appendChild(empty);
      }

      function buildStatusText(generatedAt, refreshResult) {
        const base = "업데이트 " + generatedAt;
        if (!refreshResult || typeof refreshResult !== "object") {
          return base;
        }

        if (refreshResult.status === "refreshed") {
          return "새 수집 완료 · " + base;
        }

        if (refreshResult.status === "cooldown_skip") {
          return "최근 5분 내 수집 데이터 · " + base;
        }

        if (refreshResult.status === "quiet_hours_skip") {
          return "야간 자동수집 제외 시간 · " + base;
        }

        return base;
      }

      async function render({ useCache = false, refreshResult = null } = {}) {
        const statusEl = document.getElementById("status");
        const contentEl = document.getElementById("content");

        try {
          const data = useCache && cachedData ? cachedData : await loadData();
          cachedData = data;
          contentEl.innerHTML = "";

          const posts = Array.isArray(data.posts) ? data.posts : [];
          const classCollection = collectClassNames(posts);
          knownClasses = classCollection.all;
          renderClassOptions();

          const orderedPosts = prioritizePosts(posts);
          if (orderedPosts.length < 1) {
            renderEmpty(contentEl);
          } else {
            for (const post of orderedPosts) {
              contentEl.appendChild(renderPost(post));
            }
          }

          const generatedAt = data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "알 수 없음";
          statusEl.textContent = buildStatusText(generatedAt, refreshResult);
        } catch (error) {
          knownClasses = [...CLASS_ORDER];
          renderClassOptions();
          contentEl.innerHTML = "";
          const block = document.createElement("div");
          block.className = "error";
          block.textContent = "데이터를 가져오지 못했습니다: " + error.message;
          contentEl.appendChild(block);
          statusEl.textContent = "업데이트 실패";
        }
      }

      if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
          navigator.serviceWorker.register("./sw.js").catch(() => undefined);
        });
      }

      render({ useCache: false });
    </script>
  </body>
</html>`;
}
