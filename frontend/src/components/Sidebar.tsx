import { Button } from "antd";
import { FilePptOutlined, GithubOutlined, PlusOutlined } from "@ant-design/icons";

const REPO_URL = "https://github.com/pauline2513/nornickel";
const PITCH_URL = "#";

interface Props {
  onNewChat: () => void;
  hasMessages: boolean;
  loading: boolean;
}

function GraphMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="9" fill="var(--violet)" />
      <path
        d="M11 12 L21 21 M11 12 L22 10"
        stroke="#fff"
        strokeWidth="1.4"
        opacity="0.7"
        strokeLinecap="round"
      />
      <circle cx="11" cy="12" r="3.2" fill="#fff" />
      <circle cx="22" cy="10" r="2.4" fill="#fff" opacity="0.9" />
      <circle cx="21" cy="21" r="3.6" fill="#fff" />
    </svg>
  );
}

export function Sidebar({ onNewChat, hasMessages, loading }: Props) {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <button className="sidebar-mark" onClick={onNewChat} type="button" aria-label="Новый диалог">
            <GraphMark />
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
