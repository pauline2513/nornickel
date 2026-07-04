import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { EmptyState } from "./components/EmptyState";
import { ChatWindow } from "./components/ChatWindow";
import { askChat } from "./api/chat";
import type { ChatMessage } from "./types";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSend(query: string) {
    const userMessage: ChatMessage = { id: makeId(), role: "user", text: query };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const data = await askChat(query);
      const assistantMessage: ChatMessage = {
        id: makeId(),
        role: "assistant",
        text: data.answer,
        status: "done",
        data,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const assistantMessage: ChatMessage = {
        id: makeId(),
        role: "assistant",
        text: err instanceof Error ? err.message : "Не удалось получить ответ.",
        status: "error",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setLoading(false);
    }
  }

  function handleNewChat() {
    setMessages([]);
  }

  return (
    <div className="app-shell">
      <Sidebar onNewChat={handleNewChat} hasMessages={messages.length > 0} loading={loading} />
      <main className="app-main">
        {messages.length === 0 ? (
          <EmptyState onSend={handleSend} loading={loading} />
        ) : (
          <ChatWindow messages={messages} loading={loading} onSend={handleSend} />
        )}
      </main>
    </div>
  );
}

export default App;
