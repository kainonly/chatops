"use client";

import React, { useEffect, useId, useRef, useState } from "react";

export default function Mermaid({ children }: { children: string }) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "default" });
        const { svg: result } = await mermaid.render(`m${id}`, children.trim());
        if (!cancelled) setSvg(result);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }
    render();
    return () => { cancelled = true; };
  }, [children, id]);

  if (error) return <pre style={{ color: "#ff4d4f", fontSize: 12 }}>{error}</pre>;
  if (!svg) return null;

  return (
    <div
      ref={ref}
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ overflowX: "auto", margin: "8px 0" }}
    />
  );
}
