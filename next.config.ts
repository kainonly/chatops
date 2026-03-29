import type { NextConfig } from "next";

// 确保本地请求不走代理
process.env.no_proxy = (process.env.no_proxy || "") + ",127.0.0.1,localhost";
process.env.NO_PROXY = (process.env.NO_PROXY || "") + ",127.0.0.1,localhost";

const nextConfig: NextConfig = {
  transpilePackages: [
    "antd",
    "@ant-design/x",
    "@ant-design/x-sdk",
    "@ant-design/x-markdown",
    "@ant-design/icons",
  ],
};

export default nextConfig;
