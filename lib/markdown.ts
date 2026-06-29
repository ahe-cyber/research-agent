// ── Shared Markdown renderer ───────────────────────────────────────────────

export function markdownToHtml(text: unknown) {
  const source = String(text || "").replace(/\r\n/g, "\n");
  const codeBlocks: string[] = [];
  const withCodeBlocks = source.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const index = codeBlocks.length;
    const cls = lang ? ` class="language-${escapeAttr(lang.trim())}"` : "";
    codeBlocks.push(`<pre class="pm-code-block"><code${cls}>${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`);
    return `\x00CB${index}\x00`;
  });

  const lines = withCodeBlocks.split("\n");
  let html = "";
  let paragraph: string[] = [];
  let listItems: { text: string; task?: boolean; checked?: boolean }[] = [];
  let listOrdered = false;

  function flushParagraph() {
    if (!paragraph.length) return;
    html += `<p>${paragraph.map(inlineFormat).join("<br>")}</p>`;
    paragraph = [];
  }

  function flushList() {
    if (!listItems.length) return;
    const tag = listOrdered ? "ol" : "ul";
    const cls = listItems.some((item) => item.task) ? ' class="pm-task-list"' : "";
    html += `<${tag}${cls}>${listItems.map((item) => {
      const checkbox = item.task
        ? `<input type="checkbox" disabled${item.checked ? " checked" : ""}> `
        : "";
      return `<li>${checkbox}${inlineFormat(item.text)}</li>`;
    }).join("")}</${tag}>`;
    listItems = [];
  }

  function flushAll() {
    flushParagraph();
    flushList();
  }

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();

    if (/^\x00CB\d+\x00$/.test(line)) {
      flushAll();
      html += codeBlocks[Number(line.match(/\d+/)?.[0] || 0)];
      continue;
    }

    if (isTableStart(lines, index)) {
      flushAll();
      const { tableHtml, nextIndex } = renderTable(lines, index);
      html += tableHtml;
      index = nextIndex - 1;
      continue;
    }

    if (line.startsWith(">")) {
      flushAll();
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      index -= 1;
      html += `<blockquote>${markdownToHtml(quoteLines.join("\n"))}</blockquote>`;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushAll();
      html += `<h${heading[1].length} class="pm-h${heading[1].length}">${inlineFormat(heading[2])}</h${heading[1].length}>`;
      continue;
    }

    if (/^[-*_]{3,}$/.test(line)) {
      flushAll();
      html += '<hr class="pm-hr">';
      continue;
    }

    const unordered = line.match(/^[-*+]\s+(\[[ xX]\]\s+)?(.+)$/);
    if (unordered) {
      flushParagraph();
      if (listItems.length && listOrdered) flushList();
      listOrdered = false;
      listItems.push({
        text: unordered[2],
        task: Boolean(unordered[1]),
        checked: /\[[xX]\]/.test(unordered[1] || "")
      });
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (listItems.length && !listOrdered) flushList();
      listOrdered = true;
      listItems.push({ text: ordered[1] });
      continue;
    }

    if (line === "") {
      flushAll();
      continue;
    }

    if (listItems.length) flushList();
    paragraph.push(raw.trimEnd());
  }

  flushAll();
  return html;
}

function isTableStart(lines: string[], index: number) {
  const header = lines[index]?.trim();
  const separator = lines[index + 1]?.trim();
  return Boolean(
    header?.includes("|") &&
    /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(separator || "")
  );
}

function renderTable(lines: string[], startIndex: number) {
  const header = splitTableRow(lines[startIndex]);
  const alignments = splitTableRow(lines[startIndex + 1]).map((cell) => {
    const trimmed = cell.trim();
    if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center";
    if (trimmed.endsWith(":")) return "right";
    return trimmed.startsWith(":") ? "left" : "";
  });

  let index = startIndex + 2;
  const rows: string[][] = [];
  while (index < lines.length && lines[index].trim().includes("|")) {
    rows.push(splitTableRow(lines[index]));
    index += 1;
  }

  const ths = header.map((cell, i) => tableCell("th", cell, alignments[i])).join("");
  const trs = rows.map((row) => `<tr>${header.map((_, i) => tableCell("td", row[i] || "", alignments[i])).join("")}</tr>`).join("");
  return {
    tableHtml: `<table class="pm-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`,
    nextIndex: index
  };
}

function splitTableRow(row: string) {
  return row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function tableCell(tag: "td" | "th", value: string, align = "") {
  const style = align ? ` style="text-align:${align}"` : "";
  return `<${tag}${style}>${inlineFormat(value)}</${tag}>`;
}

function inlineFormat(text: string) {
  const codeSpans: string[] = [];
  let out = escapeHtml(text).replace(/`([^`]+)`/g, (_, code) => {
    const index = codeSpans.length;
    codeSpans.push(`<code class="pm-code">${code}</code>`);
    return `\x00CS${index}\x00`;
  });

  out = out
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_, alt, url, title) => {
      const safe = safeUrl(url, { allowImages: true });
      if (!safe) return escapeHtml(alt || "");
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
      return `<img src="${escapeAttr(safe)}" alt="${escapeAttr(alt || "")}"${titleAttr}>`;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, (_, label, url, title) => {
      const safe = safeUrl(url);
      if (!safe) return label;
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
      return `<a href="${escapeAttr(safe)}" target="_blank" rel="noopener noreferrer"${titleAttr}>${label}</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>");

  return out.replace(/\x00CS(\d+)\x00/g, (_, index) => codeSpans[Number(index)] || "");
}

function safeUrl(value: string, { allowImages = false } = {}) {
  const trimmed = String(value || "").trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (allowImages && /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(trimmed)) return trimmed;
  if (/^[./#]/.test(trimmed)) return trimmed;
  return "";
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
