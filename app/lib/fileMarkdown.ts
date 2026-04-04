const DOWNLOADABLE_FILE_EXTENSIONS = new Set([
  ".csv",
  ".doc",
  ".docx",
  ".java",
  ".js",
  ".json",
  ".md",
  ".pdf",
  ".ppt",
  ".pptx",
  ".py",
  ".txt",
  ".xls",
  ".xlsx",
  ".zip",
]);

// 匹配 JSON 写在同一行的错误格式：```file {...}
const FILE_BLOCK_INLINE_JSON_RE = /^```file (\{[^\n`]+\})\s*$/gm;
const FILE_BLOCK_RE = /```file\b/;
const STANDALONE_FILE_URL_LINE_RE = /^([ \t]*)(https?:\/\/\S+|\/api\/files\/\S+)([ \t]*)$/gm;
const MARKDOWN_FILE_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/api\/files\/[^)\s]+)\)/g;

function decodeFileName(rawName: string): string {
  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

function stripTrailingPunctuation(url: string): { cleanUrl: string; trailing: string } {
  const match = url.match(/([),.;!?]+)$/);
  if (!match) return { cleanUrl: url, trailing: "" };

  const trailing = match[1];
  return {
    cleanUrl: url.slice(0, -trailing.length),
    trailing,
  };
}

function getFileNameFromUrl(url: string): string | null {
  try {
    if (url.startsWith("/")) {
      const pathname = url.split("?")[0] ?? "";
      const basename = pathname.split("/").pop();
      return basename ? decodeFileName(basename) : null;
    }

    const parsed = new URL(url);
    const basename = parsed.pathname.split("/").pop();
    return basename ? decodeFileName(basename) : null;
  } catch {
    return null;
  }
}

function isDownloadableFileUrl(url: string): boolean {
  const filename = getFileNameFromUrl(url);
  if (!filename) return false;

  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex < 0) return false;

  return DOWNLOADABLE_FILE_EXTENSIONS.has(filename.slice(dotIndex).toLowerCase());
}

function toFileBlock(url: string, name: string): string {
  return `\`\`\`file\n${JSON.stringify({ url, name })}\n\`\`\``;
}

export function normalizeFileMarkdown(content: string): string {
  if (!content) return content;

  // 修复 AI 把 JSON 写在同一行的格式：```file {...} → ```file\n{...}\n```
  content = content.replace(FILE_BLOCK_INLINE_JSON_RE, (_, json) => `\`\`\`file\n${json}\n\`\`\``);

  // 清除 file 块结束后紧跟的孤立 ``` （AI 有时会多输出一个关闭标记）
  content = content.replace(/(```file[\s\S]*?```)\n```[ \t]*(?=\n|$)/g, "$1");

  if (FILE_BLOCK_RE.test(content)) return content;

  let normalized = content.replace(
    MARKDOWN_FILE_LINK_RE,
    (fullMatch, label: string, rawUrl: string) => {
      const { cleanUrl, trailing } = stripTrailingPunctuation(rawUrl);
      if (!isDownloadableFileUrl(cleanUrl)) return fullMatch;

      return `${toFileBlock(cleanUrl, label.trim() || getFileNameFromUrl(cleanUrl) || "下载文件")}${trailing}`;
    },
  );

  normalized = normalized.replace(
    STANDALONE_FILE_URL_LINE_RE,
    (fullMatch, leadingWhitespace: string, rawUrl: string, trailingWhitespace: string) => {
      const { cleanUrl, trailing } = stripTrailingPunctuation(rawUrl);
      if (!isDownloadableFileUrl(cleanUrl)) return fullMatch;

      const filename = getFileNameFromUrl(cleanUrl);
      if (!filename) return fullMatch;

      return `${leadingWhitespace}${toFileBlock(cleanUrl, filename)}${trailing}${trailingWhitespace}`;
    },
  );

  return normalized;
}
