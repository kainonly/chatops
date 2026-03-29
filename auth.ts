import NextAuth from "next-auth";
import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers";
import { prisma } from "./app/lib/db";

interface FeishuProfile {
  union_id: string;
  open_id: string;
  name: string;
  email?: string;
  avatar_url?: string;
}

function FeishuProvider(
  options: OAuthUserConfig<FeishuProfile>
): OAuthConfig<FeishuProfile> {
  return {
    id: "feishu",
    name: "飞书",
    type: "oauth",
    authorization: {
      url: "https://open.feishu.cn/open-apis/authen/v1/authorize",
      params: {
        scope: "contact:user.base:readonly",
        app_id: options.clientId,
      },
    },
    token: "https://open.feishu.cn/open-apis/authen/v2/oauth/token",
    userinfo: {
      url: "https://open.feishu.cn/open-apis/authen/v1/user_info",
      async request({ tokens, provider }) {
        const res = await fetch(provider.userinfo!.url as string, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const data = await res.json();
        return data.data;
      },
    },
    profile(profile) {
      return {
        id: profile.union_id,
        name: profile.name,
        email: profile.email ?? null,
        image: profile.avatar_url ?? null,
      };
    },
    checks: ["state"],
    ...options,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    FeishuProvider({
      clientId: process.env.FEISHU_APP_ID!,
      clientSecret: process.env.FEISHU_APP_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        const feishuProfile = profile as FeishuProfile;
        if (!feishuProfile.union_id) return token;
        // 首次登录自动创建或更新用户
        const user = await prisma.user.upsert({
          where: { feishuUnionId: feishuProfile.union_id },
          update: {
            name: feishuProfile.name,
            email: feishuProfile.email ?? null,
            avatarUrl: feishuProfile.avatar_url ?? null,
          },
          create: {
            feishuUnionId: feishuProfile.union_id,
            name: feishuProfile.name,
            email: feishuProfile.email ?? null,
            avatarUrl: feishuProfile.avatar_url ?? null,
          },
        });
        token.userId = user.id;
      } else if (token.userId) {
        // 校验 DB 中用户仍存在（如数据库重置后 token 失效）
        const exists = await prisma.user.findUnique({
          where: { id: token.userId as string },
          select: { id: true },
        });
        if (!exists) delete token.userId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
