import { BulbOutlined } from "@ant-design/icons";
import { ChatInput } from "./ChatInput";

const SUGGESTED_PROMPTS = [
  "При каких температуре и содержании кислорода проводится частичный обжиг медных концентратов?",
  "На какой глубине добыча считается сверхглубокой?",
  "Какие результаты указаны для процессов CESL и Toowong?",
  "Какие два способа переработки медных шлаков широко применяют в промышленной практике?",
  "Сделай краткий литобзор для российский источников",
  "Какие требования предъявляются к хромиту огнеупорного сорта?"
];

interface Props {
  onSend: (query: string) => void;
  loading: boolean;
}

export function EmptyState({ onSend, loading }: Props) {
  return (
    <div className="empty-state">
      <h1>
        Это граф <span className="accent-underline">знаний</span>!
      </h1>
      <p>
        Отвечаем на вопросы по металлургии и показываем,
        <br />
        откуда взят ответ – вершины графа и статьи-источники
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
