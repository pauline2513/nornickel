import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import {
  AimOutlined,
  DownloadOutlined,
  LinkOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import { Alert, Button, Empty, Input, Spin, Tag, Tooltip } from "antd";
import { fetchGraph } from "../api/graph";
import type { GraphNode, GraphRelationship, GraphResponse, GraphSource } from "../types";
import { nodeLabelColors, palette } from "../theme";

const { Search } = Input;

const LABEL_RU: Record<string, string> = {
  Material: "Материалы",
  Process: "Процессы",
  Equipment: "Оборудование",
  Property: "Свойства",
  Experiment: "Эксперименты",
  Expert: "Эксперты",
  Facility: "Объекты",
};

const LABEL_ORDER = [
  "Material",
  "Process",
  "Equipment",
  "Property",
  "Experiment",
  "Expert",
  "Facility",
];

const RELATION_RU: Record<string, string> = {
  USES_MATERIAL: "использует материал",
  OPERATES_AT_CONDITION: "условия",
  PRODUCES_OUTPUT: "получает продукт",
  VALIDATED_BY: "проверено",
  CONTRADICTS: "противоречит",
  HAS_PROPERTY: "имеет свойство",
  AFFILIATED_WITH: "аффилирован",
  CONDUCTED_AT: "проведено на",
};

const NODE_DOT_COLORS: Record<string, string> = {
  Material: "#00D49F",
  Process: "#7B2CFF",
  Equipment: "#FFB000",
  Property: "#FF3EA5",
  Experiment: "#1688FF",
  Expert: "#FF5A36",
  Facility: "#8B95A7",
  Publication: "#F2C200",
};

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  radius: number;
}

interface GraphTransform {
  x: number;
  y: number;
  k: number;
}

type DragState =
  | {
      mode: "pan";
      startX: number;
      startY: number;
      originX: number;
      originY: number;
    }
  | {
      mode: "node";
      id: string;
      startX: number;
      startY: number;
    };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatRelationType(type: string) {
  return RELATION_RU[type] ?? type.toLowerCase().replaceAll("_", " ");
}

function getNodeColor(label: string) {
  return nodeLabelColors[label] ?? nodeLabelColors.Facility;
}

function getNodeDotColor(label: string) {
  return NODE_DOT_COLORS[label] ?? NODE_DOT_COLORS.Facility;
}

function nodeRadius(node: GraphNode) {
  if (node.label === "Property") return 5.5;
  return 6.5;
}

function nodeSearchText(node: GraphNode) {
  return [node.name, node.text].filter(Boolean).join(" ").toLowerCase();
}

function getComponents(nodes: GraphNode[], relationships: GraphRelationship[]) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const adjacency = new Map<string, Set<string>>();
  nodes.forEach((node) => adjacency.set(node.id, new Set()));
  relationships.forEach((relationship) => {
    if (!nodeIds.has(relationship.source) || !nodeIds.has(relationship.target)) return;
    adjacency.get(relationship.source)?.add(relationship.target);
    adjacency.get(relationship.target)?.add(relationship.source);
  });

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  const components: GraphNode[][] = [];

  nodes.forEach((node) => {
    if (visited.has(node.id)) return;
    const stack = [node.id];
    const component: GraphNode[] = [];
    visited.add(node.id);

    while (stack.length) {
      const id = stack.pop()!;
      const item = byId.get(id);
      if (item) component.push(item);
      adjacency.get(id)?.forEach((nextId) => {
        if (!visited.has(nextId)) {
          visited.add(nextId);
          stack.push(nextId);
        }
      });
    }

    components.push(component);
  });

  return components.sort((a, b) => b.length - a.length);
}

function makeLayout(nodes: GraphNode[], relationships: GraphRelationship[], width: number, height: number) {
  const centerX = width / 2;
  const centerY = height / 2;
  const positions = new Map<string, PositionedNode>();
  const componentCenters = new Map<string, { x: number; y: number }>();
  const components = getComponents(nodes, relationships);

  components.forEach((component, componentIndex) => {
    const componentAngle = -Math.PI / 2 + Math.max(0, componentIndex - 1) * 1.22;
    const ringX = Math.min(width * 0.12, 132);
    const ringY = Math.min(height * 0.1, 98);
    const componentCenter =
      componentIndex === 0
        ? { x: centerX, y: centerY }
        : {
            x: centerX + Math.cos(componentAngle) * ringX,
            y: centerY + Math.sin(componentAngle) * ringY,
          };
    const localRadius = 18 + Math.sqrt(component.length) * 5.8;

    component.forEach((node, localIndex) => {
      const labelIndex = Math.max(0, LABEL_ORDER.indexOf(node.label));
      const labelAngle = -Math.PI / 2 + (labelIndex / LABEL_ORDER.length) * Math.PI * 2;
      const angle = (localIndex / Math.max(component.length, 1)) * Math.PI * 2 + componentIndex * 0.31;
      const radius = localRadius * (0.55 + ((localIndex % 5) + 1) * 0.08);
      const x =
        componentCenter.x +
        Math.cos(angle) * radius +
        Math.cos(labelAngle) * Math.min(22, localRadius * 0.2);
      const y =
        componentCenter.y +
        Math.sin(angle) * radius +
        Math.sin(labelAngle) * Math.min(18, localRadius * 0.18);
      positions.set(node.id, {
        ...node,
        x,
        y,
        radius: nodeRadius(node),
      });
      componentCenters.set(node.id, componentCenter);
    });
  });

  const links = relationships
    .map((relationship) => ({
      source: positions.get(relationship.source),
      target: positions.get(relationship.target),
    }))
    .filter((link): link is { source: PositionedNode; target: PositionedNode } => Boolean(link.source && link.target));
  const iterations = nodes.length > 420 ? 80 : nodes.length > 220 ? 110 : 150;
  const repulsion = nodes.length > 320 ? 140 : nodes.length > 180 ? 180 : 240;
  const attraction = nodes.length > 320 ? 0.052 : 0.064;
  const desiredDistance = nodes.length > 220 ? 36 : nodes.length > 80 ? 42 : 48;
  const list = Array.from(positions.values());

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j += 1) {
        const b = list[j];
        const dx = a.x - b.x || 0.01;
        const dy = a.y - b.y || 0.01;
        const distanceSq = Math.max(dx * dx + dy * dy, 100);
        const force = repulsion / distanceSq;
        const fx = dx * force;
        const fy = dy * force;
        a.x += fx;
        a.y += fy;
        b.x -= fx;
        b.y -= fy;
      }
    }

    links.forEach(({ source, target }) => {
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (distance - desiredDistance) * attraction;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      source.x += fx;
      source.y += fy;
      target.x -= fx;
      target.y -= fy;
    });

    list.forEach((node) => {
      const componentCenter = componentCenters.get(node.id) ?? { x: centerX, y: centerY };
      const labelIndex = Math.max(0, LABEL_ORDER.indexOf(node.label));
      const labelAngle = -Math.PI / 2 + (labelIndex / LABEL_ORDER.length) * Math.PI * 2;
      const labelTarget = {
        x: componentCenter.x + Math.cos(labelAngle) * 20,
        y: componentCenter.y + Math.sin(labelAngle) * 16,
      };
      node.x += (componentCenter.x - node.x) * 0.024;
      node.y += (componentCenter.y - node.y) * 0.024;
      node.x += (labelTarget.x - node.x) * 0.002;
      node.y += (labelTarget.y - node.y) * 0.002;
    });
  }

  return positions;
}

function fitTransformForNodes(nodes: PositionedNode[], width: number, height: number): GraphTransform {
  if (!nodes.length) return { x: 0, y: 0, k: 1 };

  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const padding = 42;
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;
  const graphWidth = Math.max(1, maxX - minX);
  const graphHeight = Math.max(1, maxY - minY);
  const scale = clamp(Math.min(width / graphWidth, height / graphHeight), 0.58, 1.65);

  return {
    k: scale,
    x: (width - (minX + maxX) * scale) / 2,
    y: (height - (minY + maxY) * scale) / 2,
  };
}

function getGraphStats(nodes: GraphNode[], relationships: GraphRelationship[]) {
  const labels = new Map<string, number>();
  const relationTypes = new Map<string, number>();
  nodes.forEach((node) => labels.set(node.label, (labels.get(node.label) ?? 0) + 1));
  relationships.forEach((relationship) =>
    relationTypes.set(relationship.type, (relationTypes.get(relationship.type) ?? 0) + 1),
  );
  return { labels, relationTypes };
}

function SourceList({ sources, compact = false }: { sources: GraphSource[]; compact?: boolean }) {
  if (!sources.length) {
    return <span className="graph-muted">Источники не найдены</span>;
  }

  return (
    <div className="graph-source-list">
      {sources.slice(0, compact ? 8 : 14).map((source) => (
        <article className="graph-source-card" key={source.uid}>
	          <div className="graph-source-title">{source.title}</div>
	          <div className="graph-source-tags">
	            {source.source_type && <Tag>{source.source_type}</Tag>}
	            {source.country && <Tag className="graph-source-tag-meta">{source.country}</Tag>}
	            {(source.year ?? source.actualization_date) != null && (
              <Tag className="graph-source-tag-meta">{source.year ?? source.actualization_date}</Tag>
            )}
	          </div>
          {!compact && source.summary && <p>{source.summary}</p>}
          {source.link && (
            <a href={source.link} target="_blank" rel="noreferrer">
              <LinkOutlined /> Открыть источник
            </a>
          )}
        </article>
      ))}
    </div>
  );
}

export function GraphView() {
  const [graph, setGraph] = useState<GraphResponse>({ nodes: [], relationships: [], sources: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [serverSearch, setServerSearch] = useState("");
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [selectedRelationshipTypes, setSelectedRelationshipTypes] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Map<string, PositionedNode>>(new Map());
  const [transform, setTransform] = useState<GraphTransform>({ x: 0, y: 0, k: 1 });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchGraph(serverSearch)
      .then((data) => {
        if (!active) return;
        setGraph(data);
        setSelectedNodeId(null);
        setSelectedLabels(new Set(Array.from(new Set(data.nodes.map((node) => node.label)))));
        setSelectedRelationshipTypes(new Set(Array.from(new Set(data.relationships.map((rel) => rel.type)))));
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Не удалось загрузить граф.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [serverSearch]);

  const stats = useMemo(() => getGraphStats(graph.nodes, graph.relationships), [graph]);
  const labelEntries = useMemo(
    () =>
      Array.from(stats.labels.entries()).sort(
        ([a], [b]) => LABEL_ORDER.indexOf(a) - LABEL_ORDER.indexOf(b),
      ),
    [stats.labels],
  );
  const relationEntries = useMemo(
    () => Array.from(stats.relationTypes.entries()).sort(([, a], [, b]) => b - a),
    [stats.relationTypes],
  );
  const localSearch = searchDraft.trim().toLowerCase();

  const visibleNodes = useMemo(() => {
    return graph.nodes.filter((node) => {
      if (!selectedLabels.has(node.label)) return false;
      if (localSearch && !nodeSearchText(node).includes(localSearch)) return false;
      return true;
    });
  }, [graph.nodes, localSearch, selectedLabels]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const visibleRelationships = useMemo(() => {
    return graph.relationships.filter(
      (relationship) =>
        visibleNodeIds.has(relationship.source) &&
        visibleNodeIds.has(relationship.target) &&
        selectedRelationshipTypes.has(relationship.type),
    );
  }, [graph.relationships, selectedRelationshipTypes, visibleNodeIds]);

  const visibleSources = useMemo(() => {
    return graph.sources.filter((source) => {
      const touchesVisibleNode = source.linked_node_ids.some((nodeId) => visibleNodeIds.has(nodeId));
      return touchesVisibleNode;
    });
  }, [graph.sources, visibleNodeIds]);

  const positionedNodes = useMemo(
    () => visibleNodes.map((node) => positions.get(node.id)).filter((node): node is PositionedNode => Boolean(node)),
    [positions, visibleNodes],
  );

  const positionedById = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes],
  );

  const selectedNode = selectedNodeId ? graph.nodes.find((node) => node.id === selectedNodeId) ?? null : null;
  const focusNodeId = hoverNodeId ?? selectedNodeId;
  const neighborIds = useMemo(() => {
    if (!focusNodeId) return new Set<string>();
    const ids = new Set<string>([focusNodeId]);
    visibleRelationships.forEach((relationship) => {
      if (relationship.source === focusNodeId) ids.add(relationship.target);
      if (relationship.target === focusNodeId) ids.add(relationship.source);
    });
    return ids;
  }, [focusNodeId, visibleRelationships]);
  const selectedRelationships = useMemo(() => {
    if (!selectedNodeId) return [];
    return visibleRelationships.filter(
      (relationship) => relationship.source === selectedNodeId || relationship.target === selectedNodeId,
    );
  }, [selectedNodeId, visibleRelationships]);
  const selectedSources = useMemo(() => {
    if (!selectedNodeId) return [];
    return graph.sources.filter((source) => source.linked_node_ids.includes(selectedNodeId));
  }, [graph.sources, selectedNodeId]);

  useEffect(() => {
    const rect = wrapRef.current?.getBoundingClientRect();
    const width = Math.max(720, rect?.width ?? 920);
    const height = Math.max(520, rect?.height ?? 620);
    const nextPositions = makeLayout(visibleNodes, visibleRelationships, width, height);
    const nextNodes = Array.from(nextPositions.values());
    setPositions(nextPositions);
    setTransform(fitTransformForNodes(nextNodes, width, height));
  }, [visibleNodes, visibleRelationships]);

  function toggleLabel(label: string) {
    setSelectedLabels((current) => {
      const next = new Set(current);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  function toggleRelationship(type: string) {
    setSelectedRelationshipTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function screenToGraph(event: ReactPointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    const left = rect?.left ?? 0;
    const top = rect?.top ?? 0;
    return {
      x: (event.clientX - left - transform.x) / transform.k,
      y: (event.clientY - top - transform.y) / transform.k,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!dragState) return;

    if (!didDragRef.current) {
      didDragRef.current = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) > 4;
    }

    if (dragState.mode === "pan") {
      setTransform((current) => ({
        ...current,
        x: dragState.originX + event.clientX - dragState.startX,
        y: dragState.originY + event.clientY - dragState.startY,
      }));
      return;
    }

    const point = screenToGraph(event);
    setPositions((current) => {
      const next = new Map(current);
      const node = next.get(dragState.id);
      if (node) {
        next.set(dragState.id, { ...node, x: point.x, y: point.y });
      }
      return next;
    });
  }

  function handleWheel(event: ReactWheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    const cursorX = event.clientX - (rect?.left ?? 0);
    const cursorY = event.clientY - (rect?.top ?? 0);
    const nextScale = clamp(transform.k * (event.deltaY > 0 ? 0.9 : 1.1), 0.28, 2.8);
    const graphX = (cursorX - transform.x) / transform.k;
    const graphY = (cursorY - transform.y) / transform.k;
    setTransform({
      k: nextScale,
      x: cursorX - graphX * nextScale,
      y: cursorY - graphY * nextScale,
    });
  }

  function fitGraph() {
    if (!positionedNodes.length) return;
    const rect = svgRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 900;
    const height = rect?.height ?? 620;
    setTransform(fitTransformForNodes(positionedNodes, width, height));
  }

  function zoomBy(factor: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    const centerX = (rect?.width ?? 900) / 2;
    const centerY = (rect?.height ?? 620) / 2;
    const nextScale = clamp(transform.k * factor, 0.28, 2.8);
    const graphX = (centerX - transform.x) / transform.k;
    const graphY = (centerY - transform.y) / transform.k;
    setTransform({
      k: nextScale,
      x: centerX - graphX * nextScale,
      y: centerY - graphY * nextScale,
    });
  }

  function exportGraph() {
    const payload = JSON.stringify(
      { nodes: visibleNodes, relationships: visibleRelationships, sources: visibleSources },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nornickel-graph-slice.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="graph-view">
      <header className="graph-toolbar">
        <div className="graph-title">
          <div className="graph-title-copy">
            <h1>Граф знаний</h1>
            <div className="graph-title-stats" aria-label="Статистика графа">
              <span>{visibleNodes.length} вершин</span>
              <span>{visibleRelationships.length} связей</span>
              <span>{visibleSources.length} источников</span>
            </div>
          </div>
        </div>

        <div className="graph-controls">
          <Search
            className="graph-search"
            allowClear
            placeholder="Поиск по графу"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            onSearch={(value) => setServerSearch(value.trim())}
          />
        </div>
      </header>

      {error && <Alert className="graph-alert" type="error" message={error} showIcon />}

      <div className="graph-layout">
        <aside className="graph-panel graph-filters">
          <div className="graph-panel-section">
            <div className="graph-panel-title">Типы вершин</div>
            <div className="graph-chip-list">
              {labelEntries.map(([label, count]) => {
                const colors = getNodeColor(label);
                const active = selectedLabels.has(label);
                return (
                  <button
                    className={`graph-filter-chip ${active ? "graph-filter-chip-active" : ""}`}
                    key={label}
	                    style={{
	                      "--chip-bg": colors.bg,
	                      "--chip-border": colors.border,
	                      "--chip-text": colors.text,
	                      "--chip-accent": getNodeDotColor(label),
	                    } as CSSProperties}
                    type="button"
                    onClick={() => toggleLabel(label)}
                  >
                    <span>{LABEL_RU[label] ?? label}</span>
                    <small>{count}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="graph-panel-section">
            <div className="graph-panel-title">Связи</div>
            <div className="graph-relation-list">
	              {relationEntries.map(([type, count]) => (
	                <button
	                  className={`graph-relation-filter ${
	                    selectedRelationshipTypes.has(type) ? "graph-relation-filter-active" : ""
                  }`}
                  key={type}
                  type="button"
                  onClick={() => toggleRelationship(type)}
                >
                  <span>{formatRelationType(type)}</span>
                  <small>{count}</small>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="graph-canvas-panel" ref={wrapRef}>
          {loading ? (
            <div className="graph-loading">
              <Spin />
            </div>
          ) : visibleNodes.length === 0 ? (
            <Empty className="graph-empty" description="Нет вершин для выбранных фильтров" />
          ) : (
            <>
              <div className="graph-canvas-actions">
                <Tooltip title="Приблизить">
                  <Button icon={<ZoomInOutlined />} onClick={() => zoomBy(1.16)} />
                </Tooltip>
                <Tooltip title="Отдалить">
                  <Button icon={<ZoomOutOutlined />} onClick={() => zoomBy(0.86)} />
                </Tooltip>
                <Tooltip title="Вписать">
                  <Button icon={<AimOutlined />} onClick={fitGraph} />
                </Tooltip>
                <Tooltip title="Экспорт">
                  <Button icon={<DownloadOutlined />} onClick={exportGraph} />
                </Tooltip>
              </div>

              <svg
                className="graph-svg"
                ref={svgRef}
                role="img"
                aria-label="Визуализация графа знаний"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  didDragRef.current = false;
                  setDragState({
                    mode: "pan",
                    startX: event.clientX,
                    startY: event.clientY,
                    originX: transform.x,
                    originY: transform.y,
                  });
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={() => setDragState(null)}
                onPointerLeave={() => {
                  setDragState(null);
                  setHoverNodeId(null);
                }}
                onWheel={handleWheel}
              >
                <defs>
                  <marker id="graph-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M 2 2 L 10 6 L 2 10" fill="none" stroke={palette.inkMuted} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </marker>
                  <marker id="graph-arrow-active" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="8" markerHeight="8" orient="auto">
                    <path d="M 2 2 L 10 6 L 2 10" fill="none" stroke={palette.violetDark} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                  </marker>
                </defs>
                <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
                  <g>
                    {visibleRelationships.map((relationship) => {
                      const source = positionedById.get(relationship.source);
                      const target = positionedById.get(relationship.target);
                      if (!source || !target) return null;
                      const highlighted = Boolean(
                        focusNodeId && (neighborIds.has(source.id) || neighborIds.has(target.id)),
                      );
                      const dx = target.x - source.x;
                      const dy = target.y - source.y;
                      const distance = Math.hypot(dx, dy) || 1;
                      const unitX = dx / distance;
                      const unitY = dy / distance;
                      const sourceOffset = Math.min(distance / 3, source.radius + 2);
                      const targetOffset = Math.min(distance / 3, target.radius + 3);
                      return (
                        <line
                          className={`graph-edge ${highlighted ? "graph-edge-active" : ""} ${
                            focusNodeId && !highlighted ? "graph-edge-muted" : ""
                          }`}
                          key={relationship.id}
                          x1={source.x + unitX * sourceOffset}
                          y1={source.y + unitY * sourceOffset}
                          x2={target.x - unitX * targetOffset}
                          y2={target.y - unitY * targetOffset}
                          markerEnd={highlighted ? "url(#graph-arrow-active)" : "url(#graph-arrow)"}
                        />
                      );
                    })}
                  </g>
	                  <g>
	                    {positionedNodes.map((node) => {
	                      const active = !focusNodeId || neighborIds.has(node.id);
                      const selected = selectedNodeId === node.id;
                      const labelVisible = transform.k > 0.45 || selected || hoverNodeId === node.id;
                      return (
                        <g
                          className={`graph-node ${active ? "graph-node-active" : "graph-node-muted"} ${
                            selected ? "graph-node-selected" : ""
                          }`}
                          key={node.id}
                          transform={`translate(${node.x} ${node.y})`}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            didDragRef.current = false;
                            setDragState({
                              mode: "node",
                              id: node.id,
                              startX: event.clientX,
                              startY: event.clientY,
                            });
	                          }}
                          onPointerEnter={() => setHoverNodeId(node.id)}
                          onPointerLeave={() => setHoverNodeId(null)}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (didDragRef.current) return;
                            setSelectedNodeId((current) => (current === node.id ? null : node.id));
                          }}
	                        >
                          <circle className="graph-node-hit" r={node.radius + 8} />
	                          <circle
	                            className="graph-node-dot"
	                            r={node.radius}
	                            fill={getNodeDotColor(node.label)}
	                            stroke={selected ? palette.violetDark : palette.panel}
	                            strokeWidth={selected ? 2.6 : 1.6}
	                          />
	                          {labelVisible && (
                            <text x={node.radius + 7} y="4">
                              {node.name}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </g>
              </svg>
            </>
          )}
        </section>

        <aside className="graph-panel graph-details">
          {selectedNode ? (
            <>
              <div className="graph-detail-heading">
                <Tag
                  style={{
                    background: getNodeColor(selectedNode.label).bg,
                    borderColor: getNodeColor(selectedNode.label).border,
                    color: getNodeColor(selectedNode.label).text,
                  }}
                >
                  {LABEL_RU[selectedNode.label] ?? selectedNode.label}
                </Tag>
                <h2>{selectedNode.name}</h2>
              </div>

              {selectedNode.text && <p className="graph-detail-text">{selectedNode.text}</p>}

              <div className="graph-panel-section">
                <div className="graph-panel-title">Соседние связи</div>
                <div className="graph-neighbor-list">
                  {selectedRelationships.slice(0, 18).map((relationship) => {
                    const otherId =
                      relationship.source === selectedNode.id ? relationship.target : relationship.source;
                    const other = graph.nodes.find((node) => node.id === otherId);
                    return (
                      <button
                        className="graph-neighbor-item"
                        key={relationship.id}
                        type="button"
                        onClick={() => setSelectedNodeId(otherId)}
                      >
                        <span>{formatRelationType(relationship.type)}</span>
                        <strong>{other?.name ?? otherId}</strong>
                      </button>
                    );
                  })}
                  {selectedRelationships.length === 0 && <span className="graph-muted">Связей нет</span>}
                </div>
              </div>

              <div className="graph-panel-section">
                <div className="graph-panel-title">Источники</div>
                <SourceList sources={selectedSources} compact />
              </div>
            </>
          ) : (
            <div className="graph-sources-overview">
              <div className="graph-panel-title">Источники текущего среза</div>
              <SourceList sources={visibleSources} compact />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
