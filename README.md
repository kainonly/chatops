# ChatOps

基于 Next.js 构建的定制化 AI 聊天应用，通过 Feishu 账号登录，连接内网 OpenClaw Gateway 实现流式对话。

## 前置要求

- Node.js 20+
- PostgreSQL 数据库
- 内网 OpenClaw Gateway（OpenAI 兼容协议）
- 飞书自建应用（用于 OAuth 登录）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入以下配置：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串，如 `postgresql://user:pass@localhost:5432/chatops` |
| `FEISHU_APP_ID` | 飞书自建应用的 App ID |
| `FEISHU_APP_SECRET` | 飞书自建应用的 App Secret |
| `OPENCLAW_API_URL` | OpenClaw Gateway 地址，如 `http://127.0.0.1:18789/v1` |
| `OPENCLAW_TOKEN` | OpenClaw Gateway 的 Bearer Token |
| `AUTH_SECRET` | NextAuth 签名密钥，可用 `openssl rand -base64 32` 生成 |

### 3. 初始化数据库

```bash
npx prisma migrate deploy
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)，使用飞书账号登录。

---

## 飞书应用配置

在[飞书开放平台](https://open.feishu.cn)创建自建应用后，需要：

1. 开启**网页应用**能力
2. 在「安全设置」中添加重定向 URL：
   ```
   http://localhost:3000/api/auth/callback/feishu
   ```
   生产环境替换为实际域名。
3. 开启以下权限：
   - `contact:user.base:readonly`（获取用户基本信息）

---

## 常用命令

```bash
# 开发
npm run dev

# 构建生产包
npm run build

# 启动生产服务
npm start

# 代码检查
npm run lint

# 数据库迁移（开发环境新建迁移）
npx prisma migrate dev

# 数据库迁移（生产环境应用迁移）
npx prisma migrate deploy

# 查看数据库（Prisma Studio）
npx prisma studio
```

---

## 项目结构

```
chatops/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # NextAuth 认证端点
│   │   ├── chat/                 # 聊天流式转发（→ OpenClaw Gateway）
│   │   └── conversations/        # 会话 & 消息 CRUD
│   ├── chat/[id]/                # 对话页面
│   ├── login/                    # 登录页
│   ├── lib/
│   │   ├── components/           # UI 组件
│   │   ├── chatProvider.ts       # OpenAI 兼容 Provider 工厂
│   │   ├── chatHistory.ts        # 历史消息加载
│   │   └── config.tsx            # 快捷提示 / 会话配置
│   └── page.tsx                  # 主页面
├── prisma/
│   ├── schema.prisma             # 数据模型
│   └── migrations/               # 迁移文件
├── auth.ts                       # NextAuth 配置（飞书 OAuth）
└── .env.example                  # 环境变量模板
```

---

## 架构说明

浏览器不直接访问 OpenClaw Gateway，所有请求经 Next.js API 路由中转，Bearer Token 只存在于服务端，避免 Token 泄露。

```
用户输入
  │
  ▼
飞书 OAuth 登录 → NextAuth（session）
  │
  ▼
浏览器 POST /api/chat
  { conversationId, messages, model }
  │
  ▼
/api/chat（服务端）
  ├─ 验证 session（未登录 → 401）
  ├─ 验证会话归属（不存在 → 404）
  ├─ 转发请求 → OpenClaw Gateway
  │    Authorization: Bearer TOKEN（仅服务端持有）
  │
  ▼
OpenClaw Gateway
  │  SSE 流式响应（text/event-stream）
  ▼
/api/chat 透传流 → 浏览器实时渲染
  │
  └─ 流结束后（异步）
       ├─ 保存 user & assistant 消息到 DB
       ├─ 更新 conversation.updatedAt
       └─ 首条消息：调用 Gateway 生成会话标题
```
