"use client";

import React, { useEffect, useRef } from "react";
import { Chart } from "@antv/g2";

interface G2ChartProps {
  config: string;
}

const G2Chart: React.FC<G2ChartProps> = ({ config }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedConfigRef = useRef<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (renderedConfigRef.current === config) return;

    let spec: Record<string, unknown>;
    try {
      spec = JSON.parse(config);
    } catch {
      return;
    }

    renderedConfigRef.current = config;

    const chart = new Chart({ container: containerRef.current, autoFit: true });
    chart.options(spec);
    chart.render();

    return () => {
      renderedConfigRef.current = null;
      chart.destroy();
    };
  }, [config]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: 360, margin: "12px 0" }}
    />
  );
};

export default React.memo(G2Chart);
