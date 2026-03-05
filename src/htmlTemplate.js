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
    <link rel="icon" href="./icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="./icon.svg" />
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

      .toolbar {
        margin-top: 10px;
        display: flex;
        justify-content: flex-end;
      }

      button {
        border: 0;
        border-radius: 10px;
        padding: 8px 12px;
        font-size: 0.84rem;
        background: rgba(255, 255, 255, 0.16);
        color: #ffffff;
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
        <div class="toolbar">
          <button id="refresh">새로고침</button>
        </div>
      </section>

      <section class="list" id="content"></section>
    </main>

    <script>
      const STORAGE_PREFIX = "homework-check:";

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

      async function render() {
        const statusEl = document.getElementById("status");
        const contentEl = document.getElementById("content");

        try {
          const data = await loadData();
          contentEl.innerHTML = "";

          const posts = Array.isArray(data.posts) ? data.posts : [];
          if (posts.length < 1) {
            renderEmpty(contentEl);
          } else {
            for (const post of posts) {
              contentEl.appendChild(renderPost(post));
            }
          }

          const generatedAt = data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "알 수 없음";
          statusEl.textContent = "업데이트 " + generatedAt;
        } catch (error) {
          contentEl.innerHTML = "";
          const block = document.createElement("div");
          block.className = "error";
          block.textContent = "데이터를 가져오지 못했습니다: " + error.message;
          contentEl.appendChild(block);
          statusEl.textContent = "업데이트 실패";
        }
      }

      document.getElementById("refresh").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const oldText = button.textContent;
        button.disabled = true;
        button.textContent = "새로고침 중...";
        try {
          await render();
        } finally {
          button.textContent = oldText;
          button.disabled = false;
        }
      });

      if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
          navigator.serviceWorker.register("./sw.js").catch(() => undefined);
        });
      }

      render();
    </script>
  </body>
</html>`;
}
