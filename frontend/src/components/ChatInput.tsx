import { useState, type KeyboardEvent } from "react";
import { Button, Input } from "antd";
import { ArrowUpOutlined } from "@ant-design/icons";

interface Props {
  onSend: (query: string) => void;
  loading: boolean;
  large?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, loading, large, placeholder }: Props) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className={`chat-input ${large ? "chat-input-large" : ""}`}>
      <Input.TextArea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Задайте вопрос по графу знаний…"}
        autoSize={{ minRows: large ? 2 : 1, maxRows: 8 }}
        variant="borderless"
        disabled={loading}
      />
      <Button
        type="primary"
        shape="circle"
        icon={<ArrowUpOutlined />}
        onClick={submit}
        disabled={!value.trim() || loading}
        loading={loading}
        className="chat-send-btn"
      />
    </div>
  );
}
