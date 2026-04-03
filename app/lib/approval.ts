const APPROVAL_ID_PATTERN = String.raw`[A-Za-z0-9][A-Za-z0-9._:-]*`;
const APPROVAL_DECISION_PATTERN = String.raw`(allow-once|allow-always|always|deny)`;

const APPROVAL_COMMAND_SOURCE = String.raw`\/approve(?:@[^\s]+)?\s+(${APPROVAL_ID_PATTERN})\s+${APPROVAL_DECISION_PATTERN}\b`;
const APPROVAL_INLINE_COMMAND_RE = new RegExp(
  "`?\\/approve(?:@[^\\s]+)?\\s+(" +
    APPROVAL_ID_PATTERN +
    ")\\s+(?:allow-once|allow-always|always|deny)\\b`?",
  "gi",
);
const APPROVAL_COMMAND_BLOCK_RE = new RegExp(
  String.raw`(?:^[ \t>*-]*\/approve(?:@[^\s]+)?\s+${APPROVAL_ID_PATTERN}\s+(?:allow-once|allow-always|always|deny)\b.*$\n?)+`,
  "gim",
);

const APPROVAL_PROMPT_LINE_PATTERNS = [
  /^\s*请直接回复这条命令之一：\s*$/gim,
  /^\s*请直接回复这条命令：\s*$/gim,
  /^\s*请回复其一：\s*$/gm,
  /^\s*或：\s*$/gm,
  /^\s*或\s*$/gm,
  /^\s*如果你希望这类命令后面都直接跑，也可以用：\s*$/gm,
  /^\s*如果你想后面这类命令都直接跑，也可以：\s*$/gm,
  /^\s*如果你想把这类命令在这个执行环境里长期放行，也可以：\s*$/gm,
  /^\s*如果你想把这个环境里这类命令长期放行，也可以：\s*$/gm,
  /^\s*或者如果你想在这个环境里长期放行这类命令：\s*$/gm,
  /^\s*或者长期放行这类命令：\s*$/gm,
  /^\s*只放行这一次也可以：\s*$/gm,
  /^\s*如果你要继续长期放行，也可以：\s*$/gm,
  /^\s*本次允许：\s*$/gm,
  /^\s*总是允许：\s*$/gm,
  /^\s*拒绝：\s*$/gm,
];

const APPROVAL_ACTIONS_MARKER = "[[APPROVAL_ACTIONS]]";

export const APPROVE_COMMAND_RE = new RegExp(`^${APPROVAL_COMMAND_SOURCE}`, "i");

const APPROVAL_COMMAND_GLOBAL_RE = new RegExp(APPROVAL_COMMAND_SOURCE, "gi");
const ADJACENT_APPROVAL_MARKERS_RE = new RegExp(
  String.raw`(?:${escapeRegExp(APPROVAL_ACTIONS_MARKER)}(?:\s|或|\/)*){2,}`,
  "g",
);
const MARKER_BEFORE_COMMAND_LABEL_RE = new RegExp(
  String.raw`\n?${escapeRegExp(APPROVAL_ACTIONS_MARKER)}\n?将要执行的命令是：`,
  "g",
);
const MARKER_OR_MARKER_RE = new RegExp(
  String.raw`(?:\n\s*)?${escapeRegExp(APPROVAL_ACTIONS_MARKER)}(?:\n\s*或\s*)+(?:\n\s*)?${escapeRegExp(APPROVAL_ACTIONS_MARKER)}`,
  "g",
);

export const APPROVAL_ACK_RE = /^✅ 审批已提交：/;

export function isApprovalCommand(value: string): boolean {
  return APPROVE_COMMAND_RE.test(value.trim());
}

export function containsApprovalPrompt(value: string): boolean {
  APPROVAL_COMMAND_GLOBAL_RE.lastIndex = 0;
  return APPROVAL_COMMAND_GLOBAL_RE.test(value);
}

export function extractApprovalContent(content: string) {
  const requestId = extractApprovalRequestId(content);
  if (!requestId) return null;

  return {
    requestId,
    content: sanitizeApprovalContent(content),
  };
}

function extractApprovalRequestId(content: string): string | null {
  APPROVAL_COMMAND_GLOBAL_RE.lastIndex = 0;
  const match = APPROVAL_COMMAND_GLOBAL_RE.exec(content);
  return match?.[1] ?? null;
}

function sanitizeApprovalContent(content: string): string {
  let sanitized = content
    .replace(APPROVAL_INLINE_COMMAND_RE, APPROVAL_ACTIONS_MARKER)
    .replace(APPROVAL_COMMAND_BLOCK_RE, `${APPROVAL_ACTIONS_MARKER}\n`)
    .replace(ADJACENT_APPROVAL_MARKERS_RE, `${APPROVAL_ACTIONS_MARKER}\n`);

  for (const pattern of APPROVAL_PROMPT_LINE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  return sanitized
    .replace(
      MARKER_BEFORE_COMMAND_LABEL_RE,
      `\n${APPROVAL_ACTIONS_MARKER}\n\n将要执行的命令是：`,
    )
    .replace(MARKER_OR_MARKER_RE, `\n${APPROVAL_ACTIONS_MARKER}`)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
