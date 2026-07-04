import { useLayoutEffect, useRef, useState } from "react";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function SourceSummary({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    setOverflowing(el.scrollHeight - el.clientHeight > 1);
  }, [text, expanded]);

  return (
    <div className="source-summary-wrap">
      <div
        ref={ref}
        className={`source-summary markdown-body ${expanded ? "" : "source-summary-clamped"}`}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
      {(overflowing || expanded) && (
        <button type="button" className="source-summary-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Свернуть" : "Показать полностью"}
          {expanded ? <UpOutlined /> : <DownOutlined />}
        </button>
      )}
    </div>
  );
}
