export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Outcome = 'vulnerable' | 'partial' | 'not-vulnerable' | 'inconclusive';
export type Taxonomy = 'OWASP-LLM' | 'APE' | 'Arcanum' | 'Custom';
export type SessionStatus = 'active' | 'completed' | 'archived';
export type FindingStatus = 'open' | 'confirmed' | 'mitigated' | 'false-positive';
export type ChainNodeType = 'attackVector' | 'vulnerability' | 'finding' | 'impact' | 'mitigation';

export interface TestSession {
  id: string;
  name: string;
  target: string;
  modelName: string;
  modelProvider: string;
  endpoint: string;
  description: string;
  startedAt: string;
  updatedAt: string;
  status: SessionStatus;
  tags: string[];
}

export interface TestEntry {
  id: string;
  sessionId: string;
  promptTemplateId?: string;
  title: string;
  category: string;
  categoryName: string;
  severity: Severity;
  prompt: string;
  response: string;
  outcome: Outcome;
  notes: string;
  timestamp: string;
  tags: string[];
  durationMs?: number;
}

export interface Finding {
  id: string;
  sessionId: string;
  title: string;
  category: string;
  severity: Severity;
  status: FindingStatus;
  description: string;
  impact: string;
  recommendation: string;
  evidenceIds: string[];
  cvssScore?: number;
  cweId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptTemplate {
  id: string;
  title: string;
  category: string;
  categoryName: string;
  taxonomy: Taxonomy;
  technique: string;
  subcategory: string;
  severity: Severity;
  prompt: string;
  description: string;
  objective: string;
  successIndicators: string[];
  references: string[];
  tags: string[];
}

export interface ChainData {
  id: string;
  sessionId?: string;
  name: string;
  description: string;
  nodes: StoredChainNode[];
  edges: StoredChainEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface StoredChainNode {
  id: string;
  type: ChainNodeType;
  label: string;
  description: string;
  severity: Severity;
  category: string;
  position: { x: number; y: number };
}

export interface StoredChainEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface AppState {
  sessions: TestSession[];
  entries: TestEntry[];
  findings: Finding[];
  chains: ChainData[];
  activeSessionId: string | null;
  activeView: string;
}
