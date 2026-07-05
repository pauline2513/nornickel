import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { EmptyState } from "./components/EmptyState";
import { ChatWindow } from "./components/ChatWindow";
import { GraphView } from "./components/GraphView";
import { DatasetView } from "./components/DatasetView";
import { DatasetNotice } from "./components/DatasetNotice";
import { askChat } from "./api/chat";
import type { ChatConversation, ChatMessage } from "./types";

const CHAT_HISTORY_STORAGE_KEY = "nornickel-chat-history";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeTitle(text: string) {
  const title = text.trim().replace(/\s+/g, " ");
  return title.length > 48 ? `${title.slice(0, 45)}...` : title || "Новый диалог";
}

function isChatConversation(value: unknown): value is ChatConversation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ChatConversation>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.updatedAt === "number" &&
    Array.isArray(candidate.messages)
  );
}

function loadConversations() {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isChatConversation)
      .map((conversation) => ({
        ...conversation,
        lastRequestAt: typeof conversation.lastRequestAt === "number" ? conversation.lastRequestAt : conversation.updatedAt,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function upsertConversation(
  conversations: ChatConversation[],
  conversationId: string,
  nextMessages: ChatMessage[],
  fallbackTitle: string,
  lastRequestAt: number,
) {
  const now = Date.now();
  const existing = conversations.find((conversation) => conversation.id === conversationId);
  const nextConversation: ChatConversation = {
    id: conversationId,
    title: existing?.title ?? fallbackTitle,
    messages: nextMessages,
    lastRequestAt,
    updatedAt: now,
  };

  return [
    nextConversation,
    ...conversations.filter((conversation) => conversation.id !== conversationId),
  ].sort((a, b) => b.updatedAt - a.updatedAt);
}

function App() {
  const [conversations, setConversations] = useState<ChatConversation[]>(() => loadConversations());
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    () => loadConversations()[0]?.id ?? null,
  );
  const [activeView, setActiveView] = useState<"chat" | "graph" | "dataset">("chat");
  const [loading, setLoading] = useState(false);
  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  );
  const messages = activeConversation?.messages ?? [];

  useEffect(() => {
    localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  async function handleSend(query: string) {
    const userMessage: ChatMessage = { id: makeId(), role: "user", text: query };
    const conversationId = activeConversationId ?? makeId();
    const title = makeTitle(query);
    const lastRequestAt = Date.now();
    const messagesWithUser = [...messages, userMessage];

    setActiveConversationId(conversationId);
    setConversations((prev) => upsertConversation(prev, conversationId, messagesWithUser, title, lastRequestAt));
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
      setConversations((prev) =>
        upsertConversation(prev, conversationId, [...messagesWithUser, assistantMessage], title, lastRequestAt),
      );
    } catch (err) {
      const assistantMessage: ChatMessage = {
        id: makeId(),
        role: "assistant",
        text: err instanceof Error ? err.message : "Не удалось получить ответ.",
        status: "error",
      };
      setConversations((prev) =>
        upsertConversation(prev, conversationId, [...messagesWithUser, assistantMessage], title, lastRequestAt),
      );
    } finally {
      setLoading(false);
    }
  }

  function handleNewChat() {
    setActiveConversationId(null);
    setActiveView("chat");
  }

  function handleSelectConversation(conversationId: string) {
    if (!loading) {
      setActiveConversationId(conversationId);
      setActiveView("chat");
    }
  }

  function handleOpenGraph() {
    setActiveView("graph");
  }

  function handleOpenDataset() {
    setActiveView("dataset");
  }

  return (
    <div className="app-shell">
      <DatasetNotice />
      <Sidebar
        activeConversationId={activeConversationId}
        conversations={conversations}
        activeView={activeView}
        onNewChat={handleNewChat}
        onOpenGraph={handleOpenGraph}
        onOpenDataset={handleOpenDataset}
        onSelectConversation={handleSelectConversation}
        hasMessages={messages.length > 0}
        loading={loading}
      />
      <main className="app-main">
        {activeView === "graph" ? (
          <GraphView />
        ) : activeView === "dataset" ? (
          <DatasetView />
        ) : messages.length === 0 ? (
          <EmptyState onSend={handleSend} loading={loading} />
        ) : (
          <ChatWindow messages={messages} loading={loading} onSend={handleSend} />
        )}
      </main>
    </div>
  );
}

export default App;
