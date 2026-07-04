import { Collapse, Tooltip } from "antd";
import { ApartmentOutlined } from "@ant-design/icons";
import type { UsedNode } from "../types";
import { nodeLabelColors } from "../theme";

const LABEL_RU: Record<string, string> = {
  Material: "материал",
  Process: "процесс",
  Equipment: "оборудование",
  Property: "свойство",
  Experiment: "эксперимент",
  Expert: "эксперт",
  Facility: "объект",
};

export function UsedNodesPanel({ nodes }: { nodes: UsedNode[] }) {
  if (!nodes.length) return null;

  return (
    <Collapse
      ghost
      className="meta-collapse"
      items={[
        {
          key: "nodes",
          label: (
            <span className="meta-collapse-label">
              <ApartmentOutlined /> Вершины графа, использованные в ответе ({nodes.length})
            </span>
          ),
          children: (
            <div className="node-chips">
              {nodes.map((n) => {
                const colors = nodeLabelColors[n.label] ?? nodeLabelColors.Facility;
                return (
                  <Tooltip
                    key={n.id}
                    title={`${n.text || n.name} · релевантность ${n.score.toFixed(2)}`}
                  >
                    <span
                      className="node-chip"
                      style={{
                        background: colors.bg,
                        borderColor: colors.border,
                        color: colors.text,
                      }}
                    >
                      {n.name}
                      <small>{LABEL_RU[n.label] ?? n.label}</small>
                    </span>
                  </Tooltip>
                );
              })}
            </div>
          ),
        },
      ]}
    />
  );
}
