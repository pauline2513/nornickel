import { useEffect, useState } from "react";
import { LoadingOutlined } from "@ant-design/icons";

const STAGES = [
  "Извлекаю сущности из запроса…",
  "Ищу вершины графа знаний…",
  "Оцениваю релевантность…",
  "Проверяю, достаточно ли контекста…",
  "Формирую ответ…",
];

export function ThinkingBubble() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStage((s) => (s + 1) % STAGES.length);
    }, 1100);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bubble bubble-assistant bubble-thinking">
      <LoadingOutlined spin style={{ color: "var(--turquoise-dark)" }} />
      <span>{STAGES[stage]}</span>
    </div>
  );
}
