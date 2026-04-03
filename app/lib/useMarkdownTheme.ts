import { theme } from "antd";

// 根据 antd 主题返回对应的 Markdown CSS 类名
const useMarkdownTheme = () => {
  const tok = theme.useToken();
  // theme.id === 0 是 antd 亮色模式的内部约定
  return tok?.theme?.id === 0 ? "x-markdown-light" : "x-markdown-dark";
};

export default useMarkdownTheme;
