import { useEffect, useRef } from "react";
import type { ChatMessage } from "../types";
import { MessageBubble } from "./MessageBubble";
import { ThinkingBubble } from "./ThinkingBubble";
import { ChatInput } from "./ChatInput";

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  onSend: (query: string) => void;
}

export function ChatWindow({ messages, loading, onSend }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageElsRef = useRef(new Map<string, HTMLDivElement>());
  const prevLoadingRef = useRef(loading);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const last = messages[messages.length - 1];
    const justAnswered = prevLoadingRef.current && !loading && last?.role === "assistant";
    prevLoadingRef.current = loading;

    const answerEl = justAnswered ? messageElsRef.current.get(last.id) : null;
    if (answerEl) {
      const top =
        answerEl.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top: Math.max(top - 16, 0), behavior: "smooth" });
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages, loading]);

  return (
    <div className="chat-window">
      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-scroll-inner">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              messageRef={(el) => {
                if (el) messageElsRef.current.set(m.id, el);
                else messageElsRef.current.delete(m.id);
              }}
            />
          ))}
          {loading && <ThinkingBubble />}
        </div>
      </div>
      <div className="chat-input-dock">
        <ChatInput onSend={onSend} loading={loading} />
      </div>
    </div>
  );
}
