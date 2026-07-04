import { Button } from "antd";
import { FilePptOutlined, GithubOutlined, PlusOutlined } from "@ant-design/icons";
import type { ChatConversation } from "../types";

const REPO_URL = "https://github.com/pauline2513/nornickel";
const PITCH_URL = "#";
const REQUEST_TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});
const REQUEST_DAY_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
});

interface Props {
  activeConversationId: string | null;
  conversations: ChatConversation[];
  onNewChat: () => void;
  onSelectConversation: (conversationId: string) => void;
  hasMessages: boolean;
  loading: boolean;
}

function formatRequestDate(timestamp: number) {
  const requestDate = new Date(timestamp);
  const today = new Date();
  const isToday =
    requestDate.getFullYear() === today.getFullYear() &&
    requestDate.getMonth() === today.getMonth() &&
    requestDate.getDate() === today.getDate();

  return isToday ? REQUEST_TIME_FORMATTER.format(requestDate) : REQUEST_DAY_FORMATTER.format(requestDate);
}

export function Sidebar({
  activeConversationId,
  conversations,
  onNewChat,
  onSelectConversation,
  hasMessages,
  loading,
}: Props) {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <button className="sidebar-mark" onClick={onNewChat} type="button" aria-label="Новый диалог">
            <img className="sidebar-mark-image" src="/nornickel-hackathon-favicon.ico" alt="" />
          </button>
          <div className="sidebar-hackathon-title" aria-label="Норникель AI Science Hack">
            <span>Норникель</span>
            <span>AI Science Hack</span>
          </div>
        </div>
        <div className="sidebar-team">Команда MISIS_MSc</div>
        <span className="sidebar-track-badge">Трек «Научный клубок»</span>
      </div>

      <Button
        className="sidebar-new-chat"
        icon={<PlusOutlined />}
        onClick={onNewChat}
        disabled={!hasMessages || loading}
        block
      >
        Новый диалог
      </Button>

      {conversations.length > 0 && (
        <div className="sidebar-history" aria-label="История диалогов">
          {conversations.map((conversation) => (
            <button
              className={`sidebar-history-item ${
                conversation.id === activeConversationId ? "sidebar-history-item-active" : ""
              }`}
              disabled={loading}
              key={conversation.id}
              onClick={() => onSelectConversation(conversation.id)}
              title={conversation.title}
              type="button"
            >
              <span className="sidebar-history-text">
                <span className="sidebar-history-title">{conversation.title}</span>
                <span className="sidebar-history-date">{formatRequestDate(conversation.lastRequestAt)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="sidebar-spacer" />

      <div className="sidebar-footer">
        <a className="sidebar-footer-link" href={PITCH_URL}>
          <FilePptOutlined /> Питч
        </a>
        <a
          className="sidebar-footer-link"
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
        >
          <GithubOutlined /> Репозиторий
        </a>
      </div>
    </aside>
  );
}
