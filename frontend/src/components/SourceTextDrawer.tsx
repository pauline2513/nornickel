import { useEffect, useState } from "react";
import { Alert, Drawer, Spin, Tag, Tooltip } from "antd";
import { LinkOutlined } from "@ant-design/icons";
import { fetchSourceText } from "../api/chat";
import type { Source, UsedNode } from "../types";
import { nodeLabelColors, nodeLabelRu } from "../theme";

type Segment =
  | { kind: "text"; value: string }
  | { kind: "mark"; node: UsedNode; value: string };

function buildSegments(text: string, nodes: UsedNode[]): Segment[] {
  const spans = nodes
    .filter(
      (n): n is UsedNode & { start: number; end: number } =>
        typeof n.start === "number" &&
        typeof n.end === "number" &&
        n.end > n.start &&
        n.start >= 0 &&
        n.end <= text.length,
    )
    .sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;

  for (const node of spans) {
    if (node.start < cursor) continue;
    if (node.start > cursor) {
      segments.push({ kind: "text", value: text.slice(cursor, node.start) });
    }
    segments.push({ kind: "mark", node, value: text.slice(node.start, node.end) });
    cursor = node.end;
  }
  if (cursor < text.length) {
    segments.push({ kind: "text", value: text.slice(cursor) });
  }
  return segments;
}

function markId(nodeId: string) {
  return `source-mark-${nodeId}`;
}

interface Props {
  source: Source | null;
  nodes: UsedNode[];
  onClose: () => void;
}

export function SourceTextDrawer({ source, nodes, onClose }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!source) return;
    let active = true;
    setText(null);
    setError(null);
    setLoading(true);

    fetchSourceText(source.uid)
      .then((data) => {
        if (active) setText(data.text);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Не удалось загрузить текст источника.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [source]);

  const withFragment = nodes.filter((n) => typeof n.start === "number" && typeof n.end === "number");
  const withoutFragment = nodes.filter((n) => !(typeof n.start === "number" && typeof n.end === "number"));
  const segments = text ? buildSegments(text, nodes) : [];

  function focusNode(nodeId: string) {
    setActiveNodeId(nodeId);
    document.getElementById(markId(nodeId))?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setActiveNodeId((current) => (current === nodeId ? null : current)), 2200);
  }

  return (
    <Drawer
      className="source-text-drawer"
      open={Boolean(source)}
      onClose={onClose}
      size="min(720px, 100vw)"
      title={source?.title ?? ""}
      destroyOnHidden
    >
      {source && (
        <>
          <div className="source-drawer-tags">
            {source.source_type && <Tag className="source-tag-type">{source.source_type}</Tag>}
            {(source.year ?? source.actualization_date) != null && (
              <Tag className="source-tag-year">{source.year ?? source.actualization_date}</Tag>
            )}
            {source.country && <Tag className="source-tag-country">{source.country}</Tag>}
            {source.link && (
              <a href={source.link} target="_blank" rel="noreferrer" className="source-drawer-link">
                <LinkOutlined /> Открыть источник
              </a>
            )}
          </div>

          {nodes.length > 0 && (
            <div className="source-drawer-legend">
              {nodes.map((n) => {
                const colors = nodeLabelColors[n.label] ?? nodeLabelColors.Facility;
                const clickable = withFragment.includes(n);
                return (
                  <Tooltip key={n.id} title={n.text || n.name}>
                    <button
                      type="button"
                      className="node-chip node-chip-button"
                      disabled={!clickable}
                      style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}
                      onClick={() => clickable && focusNode(n.id)}
                    >
                      {n.name}
                      <small>{nodeLabelRu[n.label] ?? n.label}</small>
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          )}

          {loading && (
            <div className="source-drawer-loading">
              <Spin />
            </div>
          )}
          {error && <Alert type="error" message={error} showIcon />}
          {!loading && !error && text && (
            <div className="source-drawer-text">
              {segments.map((segment, index) => {
                if (segment.kind === "text") {
                  return <span key={index}>{segment.value}</span>;
                }
                const colors = nodeLabelColors[segment.node.label] ?? nodeLabelColors.Facility;
                const active = activeNodeId === segment.node.id;
                return (
                  <Tooltip key={index} title={`${segment.node.name} · ${nodeLabelRu[segment.node.label] ?? segment.node.label}`}>
                    <mark
                      id={markId(segment.node.id)}
                      className={`source-drawer-mark ${active ? "source-drawer-mark-active" : ""}`}
                      style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
                    >
                      {segment.value}
                    </mark>
                  </Tooltip>
                );
              })}
            </div>
          )}
          {withoutFragment.length > 0 && !loading && (
            <div className="source-drawer-note">
              Без точного фрагмента текста: {withoutFragment.map((n) => n.name).join(", ")}
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
