import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";

interface Props {
  onNewChat: () => void;
  hasMessages: boolean;
  loading: boolean;
}

function GraphMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="9" fill="url(#graph-mark-gradient)" />
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
      <defs>
        <linearGradient id="graph-mark-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--violet)" />
          <stop offset="1" stopColor="var(--violet-dark)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Sidebar({ onNewChat, hasMessages, loading }: Props) {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-mark">
          <GraphMark />
        </div>
        <div className="sidebar-eyebrow">Норникель AI Science Hack</div>
        <div className="sidebar-team">MISIS_MSc</div>
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
    </aside>
  );
}
