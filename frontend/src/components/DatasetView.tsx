import { useEffect, useState } from "react";
import { Alert, Empty, Spin, Tag } from "antd";
import { LinkOutlined } from "@ant-design/icons";
import { fetchDataset } from "../api/dataset";
import type { DatasetSource } from "../types";

export function DatasetView() {
  const [sources, setSources] = useState<DatasetSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchDataset()
      .then((data) => {
        if (active) setSources(data.sources);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Не удалось загрузить набор данных.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="graph-view">
      <header className="graph-toolbar">
        <div className="graph-title">
          <div className="graph-title-copy">
            <h1>Набор данных</h1>
            <div className="graph-title-stats" aria-label="Статистика набора данных">
              <span>{sources.length} источников</span>
            </div>
          </div>
        </div>
      </header>

      {error && <Alert className="graph-alert" type="error" message={error} showIcon />}

      <div className="dataset-scroll">
        {loading ? (
          <div className="graph-loading">
            <Spin />
          </div>
        ) : sources.length === 0 ? (
          <Empty className="graph-empty" description="Источники не найдены" />
        ) : (
          <div className="dataset-grid">
            {sources.map((source) => (
              <article className="source-card" key={source.uid}>
                <div className="source-title">{source.title || source.uid}</div>
                <div className="source-tags">
                  {source.country && <Tag className="source-tag-country">{source.country}</Tag>}
                  {(source.year ?? source.actualization_date) != null && (
                    <Tag className="source-tag-year">{source.year ?? source.actualization_date}</Tag>
                  )}
                </div>
                {source.link && (
                  <a className="dataset-source-link" href={source.link} target="_blank" rel="noreferrer">
                    <LinkOutlined /> Открыть источник
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
