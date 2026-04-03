const APPROVAL_ID_PATTERN = String.raw`[A-Za-z0-9][A-Za-z0-9._:-]*`;
const APPROVAL_DECISION_PATTERN = String.raw`(allow-once|allow-always|always|deny)`;
export const APPROVAL_ACTIONS_MARKER = "[[APPROVAL_ACTIONS]]";

export const APPROVE_COMMAND_RE = new RegExp(
  String.raw`^\/approve(?:@[^\s]+)?\s+(${APPROVAL_ID_PATTERN})\s+${APPROVAL_DECISION_PATTERN}\b`,
  "i",
);

export function isApprovalCommand(value: string): boolean {
  return APPROVE_COMMAND_RE.test(value.trim());
}

export function containsApprovalPrompt(value: string): boolean {
  APPROVAL_COMMAND_GLOBAL_RE.lastIndex = 0;
  return APPROVAL_COMMAND_GLOBAL_RE.test(value);
}

const APPROVAL_COMMAND_GLOBAL_RE = new RegExp(
  String.raw`\/approve(?:@[^\s]+)?\s+(${APPROVAL_ID_PATTERN})\s+(allow-once|allow-always|always|deny)\b`,
  "gi",
);
const APPROVAL_COMMAND_INLINE_RE = new RegExp(
  "`?\\/approve(?:@[^\\s]+)?\\s+(" +
    APPROVAL_ID_PATTERN +
    ")\\s+(?:allow-once|allow-always|always|deny)\\b`?",
  "gi",
);

export const APPROVAL_ACK_RE = /^✅ 审批已提交：/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractApprovalContent(content: string) {
  const matches = Array.from(content.matchAll(APPROVAL_COMMAND_GLOBAL_RE));
  if (matches.length === 0) return null;

  const requestId = matches[0]?.[1];
  if (!requestId) return null;

  const sanitized = content
    .replace(APPROVAL_COMMAND_INLINE_RE, APPROVAL_ACTIONS_MARKER)
    .replace(
      new RegExp(
        String.raw`(?:^[ \t>*-]*\/approve(?:@[^\s]+)?\s+${APPROVAL_ID_PATTERN}\s+(?:allow-once|allow-always|always|deny)\b.*$\n?)+`,
        "gim",
      ),
      `${APPROVAL_ACTIONS_MARKER}\n`,
    )
    .replace(
      new RegExp(
        String.raw`(?:${escapeRegExp(APPROVAL_ACTIONS_MARKER)}(?:\s|或|\/)*){2,}`,
        "g",
      ),
      `${APPROVAL_ACTIONS_MARKER}\n`,
    )
    .replace(
      /^\s*请直接回复这条命令之一：\s*$/gim,
      "",
    )
    .replace(
      /^\s*请直接回复这条命令：\s*$/gim,
      "",
    )
    .replace(/^\s*请回复其一：\s*$/gm, "")
    .replace(/^\s*或：\s*$/gm, "")
    .replace(/^\s*或\s*$/gm, "")
    .replace(/^\s*如果你希望这类命令后面都直接跑，也可以用：\s*$/gm, "")
    .replace(/^\s*如果你想后面这类命令都直接跑，也可以：\s*$/gm, "")
    .replace(/^\s*如果你想把这类命令在这个执行环境里长期放行，也可以：\s*$/gm, "")
    .replace(/^\s*如果你想把这个环境里这类命令长期放行，也可以：\s*$/gm, "")
    .replace(/^\s*或者如果你想在这个环境里长期放行这类命令：\s*$/gm, "")
    .replace(/^\s*或者长期放行这类命令：\s*$/gm, "")
    .replace(/^\s*只放行这一次也可以：\s*$/gm, "")
    .replace(/^\s*如果你要继续长期放行，也可以：\s*$/gm, "")
    .replace(/^\s*本次允许：\s*$/gm, "")
    .replace(/^\s*总是允许：\s*$/gm, "")
    .replace(/^\s*拒绝：\s*$/gm, "")
    .replace(
      new RegExp(String.raw`\n?${escapeRegExp(APPROVAL_ACTIONS_MARKER)}\n?将要执行的命令是：`, "g"),
      `\n${APPROVAL_ACTIONS_MARKER}\n\n将要执行的命令是：`,
    )
    .replace(
      new RegExp(
        String.raw`(?:\n\s*)?${escapeRegExp(APPROVAL_ACTIONS_MARKER)}(?:\n\s*或\s*)+(?:\n\s*)?${escapeRegExp(APPROVAL_ACTIONS_MARKER)}`,
        "g",
      ),
      `\n${APPROVAL_ACTIONS_MARKER}`,
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const commandPreview =
    sanitized.match(/```(?:\w+)?\n([\s\S]*?)```/)?.[1]?.trim() ?? null;

  return {
    requestId,
    content: sanitized,
    commandPreview,
  };
}
