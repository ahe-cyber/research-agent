// ── Shared Markdown renderer ───────────────────────────────────────────────

export function markdownToHtml(text) {
  // 1. Extract fenced code blocks so inner text is never further processed
  const codeBlocks = [];
  let out = String(text || "").replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const i = codeBlocks.length;
    const cls = lang ? ` class="language-${escapeAttr(lang.trim())}"` : "";
    codeBlocks.push(`<pre class="pm-code-block"><code${cls}>${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`);
    return `\x00CB${i}\x00`;
  });

  // 2. Process line-by-line for block elements
  const lines = out.split("\n");
  let html = "";
  let paraLines = [];
  let listItems = [];
  let listOrdered = false;

  function flushPara() {
    if (!paraLines.length) return;
    html += `<p>${paraLines.map(inlineFormat).join(" ")}</p>`;
    paraLines = [];
  }

  function flushList() {
    if (!listItems.length) return;
    const tag = listOrdered ? "ol" : "ul";
    html += `<${tag}>${listItems.map((li) => `<li>${inlineFormat(li)}</li>`).join("")}</${tag}>`;
    listItems = [];
  }

  for (const line of lines) {
    const t = line.trim();

    if (/^\x00CB\d+\x00$/.test(t)) {
      flushPara();
      flushList();
      html += codeBlocks[parseInt(t.match(/\d+/)[0], 10)];
      continue;
    }

    const hm = t.match(/^(#{1,6})\s+(.+)$/);
    if (hm) {
      flushPara();
      flushList();
      html += `<h${hm[1].length} class="pm-h${hm[1].length}">${inlineFormat(hm[2])}</h${hm[1].length}>`;
      continue;
    }

    if (/^[-*_]{3,}$/.test(t)) {
      flushPara();
      flushList();
      html += '<hr class="pm-hr">';
      continue;
    }

    const ulm = t.match(/^[-*+]\s+(.+)$/);
    if (ulm) {
      flushPara();
      if (listItems.length && listOrdered) flushList();
      listOrdered = false;
      listItems.push(ulm[1]);
      continue;
    }

    const olm = t.match(/^\d+\.\s+(.+)$/);
    if (olm) {
      flushPara();
      if (listItems.length && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(olm[1]);
      continue;
    }

    if (t === "") {
      flushPara();
      flushList();
      continue;
    }

    if (listItems.length) flushList();
    paraLines.push(t);
  }

  flushPara();
  flushList();

  return html;
}

function inlineFormat(text) {
  return text
    .replace(/`([^`]+)`/g, (_, c) => `<code class="pm-code">${escapeHtml(c)}</code>`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s) {
  return s.replace(/"/g, "&quot;");
}
