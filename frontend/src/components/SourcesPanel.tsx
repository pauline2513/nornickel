import { useState } from "react";
import { Collapse, Tag, Tooltip } from "antd";
import { ApartmentOutlined, FileTextOutlined, FileSearchOutlined } from "@ant-design/icons";
import type { Source, UsedNode } from "../types";
import { nodeLabelColors, nodeLabelRu } from "../theme";
import { SourceTextDrawer } from "./SourceTextDrawer";
import { SourceSummary } from "./SourceSummary";

export function SourcesPanel({ sources, usedNodes = [] }: { sources: Source[]; usedNodes?: UsedNode[] }) {
  const [openSource, setOpenSource] = useState<Source | null>(null);

  if (!sources.length && !usedNodes.length) return null;

  const nodesById = new Map(usedNodes.map((n) => [n.id, n]));
  const attachedIds = new Set(sources.flatMap((s) => s.used_node_ids ?? []));
  const unattachedNodes = usedNodes.filter((n) => !attachedIds.has(n.id));

  return (
    <>
      <Collapse
        ghost
        defaultActiveKey={["sources"]}
        className="meta-collapse"
        items={[
          {
            key: "sources",
            label: sources.length ? (
              <span className="meta-collapse-label">
                <FileTextOutlined /> Источники ({sources.length})
              </span>
            ) : (
              <span className="meta-collapse-label">
                <ApartmentOutlined /> Вершины графа, использованные в ответе ({usedNodes.length})
              </span>
            ),
            children: (
              <div className="source-list">
                {sources.map((s) => {
                  const nodes = (s.used_node_ids ?? [])
                    .map((id) => nodesById.get(id))
                    .filter((n): n is UsedNode => Boolean(n));
                  return (
                    <div className="source-card" key={s.uid}>
                      <div className="source-card-head">
                        <div className="source-title">
                          {s.link ? (
                            <a href={s.link} target="_blank" rel="noreferrer">
                              {s.title || s.uid}
                            </a>
                          ) : (
                            s.title || s.uid
                          )}
                        </div>
                        <button type="button" className="source-show-text" onClick={() => setOpenSource(s)}>
                          <FileSearchOutlined /> Текст источника
                        </button>
                      </div>
                      <div className="source-tags">
                        {s.source_type && <Tag className="source-tag-type">{s.source_type}</Tag>}
                        {(s.year ?? s.actualization_date) != null && (
                          <Tag className="source-tag-year">{s.year ?? s.actualization_date}</Tag>
                        )}
                        {s.country && <Tag className="source-tag-country">{s.country}</Tag>}
                        <Tag className="source-tag-count">вершин: {s.used_nodes_count}</Tag>
                      </div>
                      {s.summary && <SourceSummary text={s.summary} />}
                      {nodes.length > 0 && (
                        <div className="source-node-chips">
                          {nodes.map((n) => {
                            const colors = nodeLabelColors[n.label] ?? nodeLabelColors.Facility;
                            return (
                              <Tooltip key={n.id} title={n.text || n.name}>
                                <span
                                  className="node-chip"
                                  style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}
                                >
                                  {n.name}
                                  <small>{nodeLabelRu[n.label] ?? n.label}</small>
                                </span>
                              </Tooltip>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {unattachedNodes.length > 0 && (
                  <div className="source-card source-card-unattached">
                    <div className="source-title">Вершины без привязанного источника</div>
                    <div className="source-node-chips">
                      {unattachedNodes.map((n) => {
                        const colors = nodeLabelColors[n.label] ?? nodeLabelColors.Facility;
                        return (
                          <Tooltip key={n.id} title={n.text || n.name}>
                            <span
                              className="node-chip"
                              style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}
                            >
                              {n.name}
                              <small>{nodeLabelRu[n.label] ?? n.label}</small>
                            </span>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
      <SourceTextDrawer
        source={openSource}
        nodes={(openSource?.used_node_ids ?? [])
          .map((id) => nodesById.get(id))
          .filter((n): n is UsedNode => Boolean(n))}
        onClose={() => setOpenSource(null)}
      />
    </>
  );
}
