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

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  return (
    <div className="chat-window">
      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-scroll-inner">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
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
