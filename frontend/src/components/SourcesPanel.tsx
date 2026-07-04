import { Collapse, Tag } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import type { Source } from "../types";

export function SourcesPanel({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;

  return (
    <Collapse
      ghost
      defaultActiveKey={["sources"]}
      className="meta-collapse"
      items={[
        {
          key: "sources",
          label: (
            <span className="meta-collapse-label">
              <FileTextOutlined /> Источники ({sources.length})
            </span>
          ),
          children: (
            <div className="source-list">
              {sources.map((s) => (
                <div className="source-card" key={s.uid}>
                  <div className="source-title">{s.title || s.uid}</div>
                  <div className="source-tags">
                    {s.source_type && <Tag className="source-tag-type">{s.source_type}</Tag>}
                    {s.year != null && <Tag className="source-tag-year">{s.year}</Tag>}
                    {s.country && <Tag className="source-tag-country">{s.country}</Tag>}
                    <Tag className="source-tag-count">вершин: {s.used_nodes_count}</Tag>
                  </div>
                  {s.summary && <div className="source-summary">{s.summary}</div>}
                </div>
              ))}
            </div>
          ),
        },
      ]}
    />
  );
}
