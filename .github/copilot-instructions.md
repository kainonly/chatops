# ChatOps — Copilot Instructions

## Next.js 版本警告

**当前使用 Next.js 16**，与训练数据中的 Next.js 版本存在 breaking changes。写代码前必须读 `node_modules/next/dist/docs/` 中的相关指南，遵循 deprecation 提示。

## 项目概览

- **框架：** Next.js 16 + React 19 + TypeScript
- **UI：** Ant Design X（AI 对话专用组件库）
- **数据库：** PostgreSQL + Prisma（adapter: @prisma/adapter-pg）
- **认证：** NextAuth v5（飞书 OAuth）
- **AI 网关：** OpenClaw Gateway（OpenAI 兼容协议，内网）

## 敏感信息规范

**所有敏感配置必须通过环境变量读取，禁止硬编码。** 包括但不限于：

- API Token / Secret Key
- 数据库连接字符串
- OAuth App ID / Secret
- 任何密码或邮箱

新增配置项时，同步更新 `.env.example`，不得将实际值写入任何提交文件。

## 关键文件

| 文件 | 职责 |
|------|------|
| `app/page.tsx` | 主页面，状态编排（useXChat / useXConversations） |
| `app/api/chat/route.ts` | 聊天 API，转发请求至 OpenClaw Gateway，SSE 流式输出 |
| `app/lib/chatProvider.ts` | OpenAI 兼容 Provider 工厂 |
| `app/lib/chatHistory.ts` | 历史消息加载 |
| `app/lib/config.tsx` | 快捷提示 / 会话配置 |
| `app/lib/context.ts` | ChatContext，跨组件共享状态 |
| `auth.ts` | NextAuth 配置（飞书 OAuth provider） |
| `prisma/schema.prisma` | 数据模型（User / Conversation / Message） |

## 架构原则

- 浏览器**不直接**访问 OpenClaw Gateway，所有 AI 请求经 `/api/chat` 服务端中转
- Bearer Token 仅存在于服务端，前端不可见
- 认证基于飞书 `union_id`，非邮密登录

## 代码规范

- 组件用 TypeScript，props 类型显式声明
- API 路由需验证 session，未登录返回 401
- 数据库操作走 Prisma client（`app/lib/db.ts`），不直接拼 SQL
- 环境变量用 `process.env.VAR!` 断言非空，不做运行时兜底
