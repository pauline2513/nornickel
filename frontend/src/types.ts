export type NodeLabel =
  | "Material"
  | "Process"
  | "Equipment"
  | "Property"
  | "Experiment"
  | "Expert"
  | "Facility";

export interface UsedNode {
  id: string;
  label: NodeLabel;
  name: string;
  text?: string | null;
  score: number;
}

export interface Source {
  uid: string;
  title: string;
  year?: number | null;
  source_type?: string | null;
  country?: string | null;
  summary?: string | null;
  link?: string | null;
  used_nodes_count: number;
}

export interface ChatResponse {
  answer: string;
  entities: string[];
  expansions?: number;
  used_nodes: UsedNode[];
  sources: Source[];
}

export type MessageStatus = "pending" | "done" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  status?: MessageStatus;
  data?: ChatResponse;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  lastRequestAt: number;
  updatedAt: number;
}

export interface GraphNode {
  id: string;
  label: NodeLabel;
  labels: string[];
  name: string;
  text?: string | null;
}

export interface GraphRelationship {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface GraphSource {
  uid: string;
  title: string;
  year?: number | null;
  source_type?: string | null;
  country?: string | null;
  summary?: string | null;
  link?: string | null;
  linked_node_ids: string[];
}

export interface GraphResponse {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  sources: GraphSource[];
}
