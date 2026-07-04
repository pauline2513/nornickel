# Frontend — чат по графу знаний

React + TypeScript + [antd](https://ant.design/), сборка на Vite.

## Запуск

```powershell
npm install
npm run dev       # http://localhost:5173, hot reload
npm run build     # production-сборка в dist/, её раздаёт backend/main.py
```

## Структура

```
src/
├── api/
│   ├── chat.ts        askChat(query) — сейчас заглушка, см. ниже
│   └── mockData.ts     примеры ответов + подсказки для стартового экрана
├── components/
│   ├── EmptyState.tsx      стартовый экран (центрированный ввод + подсказки)
│   ├── ChatWindow.tsx      список сообщений + прикреплённый снизу ввод
│   ├── ChatInput.tsx       поле ввода с кнопкой отправки
│   ├── MessageBubble.tsx   пузырь сообщения, копирование ответа, извлечённые сущности
│   ├── ThinkingBubble.tsx  индикатор с реальными стадиями RAG-пайплайна
│   ├── UsedNodesPanel.tsx  вершины графа, использованные в ответе (цветные чипы по типу)
│   ├── SourcesPanel.tsx    публикации-источники
│   └── Header.tsx
├── theme.ts             тема antd + палитра цветов
├── types.ts             типы, зеркалящие формат ответа backend/rag.py
└── App.tsx
```

## Мок бэкенда

Backend-модель (Graph RAG, `backend/rag.py`) ещё не готова, поэтому
`src/api/chat.ts` не ходит в реальный `/api/chat`, а возвращает один из
готовых ответов из `mockData.ts` с искусственной задержкой. Формат ответа
идентичен реальному эндпоинту (см. корневой `README.md`).

Когда backend будет готов — заменить тело `askChat()` реальным `fetch`
(закомментированный вариант уже есть в файле). Dev-сервер Vite настроен
проксировать `/api/*` на `http://localhost:8000` (см. `vite.config.ts`).
