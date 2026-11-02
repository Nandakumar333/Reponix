export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  path: string;
  line?: number;
  message: string;
  agent?: string;
}

export interface Actor {
  raw: string;
  type: 'agent' | 'human' | 'process';
  name: string;
  versionOrId?: string;
}

export interface Source {
  id?: string;
  resource: string;
  title?: string;
  author?: string;
  usage_count?: number;
  last_modified?: string;
  [key: string]: any;
}

export interface VerifiedEntry {
  by: string;
  at: string;
}

export interface GeneratedInfo {
  by: string;
  at: string;
}

export interface ReponixMeta {
  cli?: string;
  commit?: string;
  agent?: string;
}

export interface ConceptFrontmatter {
  type: string;
  title?: string;
  description?: string;
  resource?: string;
  tags?: string[];
  status?: 'draft' | 'stable' | 'deprecated';
  generated?: GeneratedInfo;
  verified?: VerifiedEntry | VerifiedEntry[];
  stale_after?: string;
  timestamp?: string; // v0.1 backwards-compatibility
  sources?: Source[];
  usage_window?: { from: string; to: string };
  reponix?: ReponixMeta;
  runtime?: string;
  parameters?: Array<{ name: string; type: string; required?: boolean }>;
  computation?: string;
  executor?: { resource: string; receipt?: string[] };
  attester?: { resource: string };
  [key: string]: any;
}

export interface Concept {
  filePath: string;
  bundleRelativePath: string; // e.g. "contracts/apis/post-orders.md"
  id: string; // e.g. "contracts/apis/post-orders"
  owningAgent?: string;
  frontmatter: ConceptFrontmatter;
  body: string;
  raw: string;
  lineOffset: number;
}

export interface Bundle {
  rootDir: string;
  repoRoot: string;
  concepts: Map<string, Concept>;
  indexFiles: Map<string, string>;
  logFiles: Map<string, string>;
  okfVersion?: string;
}

export interface FinalizeSummary {
  success: boolean;
  totalConcepts: number;
  validConcepts: number;
  issues: ValidationIssue[];
  failedConcepts: Array<{
    id: string;
    path: string;
    owningAgent: string;
    issues: ValidationIssue[];
  }>;
}
