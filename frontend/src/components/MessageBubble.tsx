import { useState } from "react";
import { Button, Tag, Tooltip } from "antd";
import { CheckOutlined, CopyOutlined, TagsOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../types";
import { UsedNodesPanel } from "./UsedNodesPanel";
import { SourcesPanel } from "./SourcesPanel";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);

  if (message.role === "user") {
    return <div className="bubble bubble-user">{message.text}</div>;
  }

  const isError = message.status === "error";

  async function handleCopy() {
    await navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={`bubble-assistant-wrap ${isError ? "is-error" : ""}`}>
      <div className={`bubble bubble-assistant ${isError ? "bubble-error" : ""}`}>
        {isError ? (
          message.text
        ) : (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          </div>
        )}
      </div>

      {!isError && (
        <div className="bubble-toolbar">
          <Tooltip title={copied ? "Скопировано" : "Скопировать ответ"}>
            <Button
              type="text"
              size="small"
              icon={copied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={handleCopy}
            />
          </Tooltip>
          {!!message.data?.entities?.length && (
            <div className="entities-line">
              <TagsOutlined style={{ color: "var(--ink-muted)" }} />
              {message.data.entities.map((e) => (
                <Tag key={e} variant="filled" className="entity-tag">
                  {e}
                </Tag>
              ))}
            </div>
          )}
        </div>
      )}

      {message.data && (
        <div className="meta-stack">
          <UsedNodesPanel nodes={message.data.used_nodes} />
          <SourcesPanel sources={message.data.sources} />
        </div>
      )}
    </div>
  );
}
