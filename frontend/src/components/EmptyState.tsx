import { ApartmentOutlined, BulbOutlined } from "@ant-design/icons";
import { ChatInput } from "./ChatInput";
import { SUGGESTED_PROMPTS } from "../api/mockData";

interface Props {
  onSend: (query: string) => void;
  loading: boolean;
}

export function EmptyState({ onSend, loading }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <ApartmentOutlined />
      </div>
      <h1>О чём спросим граф знаний?</h1>
      <p>
        Отвечаю на вопросы по металлургии и обогащению руд, опираясь на граф знаний,
        извлечённый из научных источников. Каждый ответ приходит с вершинами графа
        и публикациями, на которые он опирается.
      </p>

      <ChatInput onSend={onSend} loading={loading} large />

      <div className="empty-state-suggestions">
        <div className="empty-state-suggestions-label">
          <BulbOutlined /> Примеры вопросов
        </div>
        <div className="suggestion-grid">
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              className="suggestion-chip"
              onClick={() => onSend(p)}
              disabled={loading}
              type="button"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
