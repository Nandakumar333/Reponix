import type {
  Concept,
  ValidationIssue,
  VerifiedEntry,
  Actor,
} from './types.js';

export interface OkfSpecAdapter {
  version: string;
  validateConceptConformance(concept: Concept): ValidationIssue[];
  validateReservedFile(
    fileName: string,
    content: string,
    filePath: string,
    isRoot?: boolean
  ): ValidationIssue[];
  normalizeVerified(verified: unknown): VerifiedEntry[];
  deriveTrustTier(
    verified: unknown
  ): 'unverified' | 'machine-confirmed' | 'human-reviewed';
  isStale(staleAfter: string | undefined, now?: Date): boolean;
  parseActor(actorStr: string): Actor;
}

export class OkfV02Adapter implements OkfSpecAdapter {
  public readonly version = '0.2';

  public validateConceptConformance(concept: Concept): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Spec §11: non-empty type is required
    if (!concept.frontmatter || typeof concept.frontmatter !== 'object') {
      issues.push({
        code: 'OKF_SPEC_FRONTMATTER_MISSING',
        severity: 'error',
        path: concept.bundleRelativePath,
        line: 1,
        message: 'Concept document missing valid YAML frontmatter',
        agent: concept.owningAgent,
      });
      return issues;
    }

    const type = concept.frontmatter.type;
    if (typeof type !== 'string' || type.trim().length === 0) {
      issues.push({
        code: 'OKF_SPEC_TYPE_REQUIRED',
        severity: 'error',
        path: concept.bundleRelativePath,
        line: 1,
        message: 'Concept frontmatter must include a non-empty "type" field',
        agent: concept.owningAgent,
      });
    }

    // Spec §10: If type is 'Attested Computation', runtime is required
    if (type === 'Attested Computation') {
      const runtime = concept.frontmatter.runtime;
      if (typeof runtime !== 'string' || runtime.trim().length === 0) {
        issues.push({
          code: 'OKF_SPEC_RUNTIME_REQUIRED',
          severity: 'error',
          path: concept.bundleRelativePath,
          line: 1,
          message: 'Attested Computation concept requires a "runtime" field in frontmatter',
          agent: concept.owningAgent,
        });
      }
    }

    return issues;
  }

  public validateReservedFile(
    fileName: string,
    content: string,
    filePath: string,
    isRoot: boolean = false
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (fileName === 'index.md') {
      // Check frontmatter
      const hasFrontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.test(content);
      if (hasFrontmatter) {
        if (!isRoot) {
          issues.push({
            code: 'OKF_SPEC_INDEX_FRONTMATTER',
            severity: 'error',
            path: filePath,
            line: 1,
            message: 'Subdirectory index.md files MUST NOT contain frontmatter (§8)',
          });
        }
      }
    } else if (fileName === 'log.md') {
      const hasFrontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.test(content);
      if (hasFrontmatter) {
        issues.push({
          code: 'OKF_SPEC_LOG_FRONTMATTER',
          severity: 'error',
          path: filePath,
          line: 1,
          message: 'log.md files MUST NOT contain frontmatter (§9)',
        });
      }

      // Spec §9: Date headings MUST use ISO 8601 YYYY-MM-DD form
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('## ')) {
          const heading = line.slice(3).trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(heading)) {
            issues.push({
              code: 'OKF_SPEC_LOG_DATE_FORMAT',
              severity: 'error',
              path: filePath,
              line: i + 1,
              message: `log.md heading must use ISO 8601 YYYY-MM-DD form, got "${heading}"`,
            });
          }
        }
      }
    }

    return issues;
  }

  public normalizeVerified(verified: unknown): VerifiedEntry[] {
    if (!verified) return [];
    if (Array.isArray(verified)) {
      return verified.filter((v): v is VerifiedEntry => Boolean(v && typeof v === 'object' && v.by && v.at));
    }
    if (typeof verified === 'object' && verified !== null) {
      const single = verified as Record<string, any>;
      if (single.by && single.at) {
        return [{ by: String(single.by), at: String(single.at) }];
      }
    }
    return [];
  }

  public deriveTrustTier(
    verified: unknown
  ): 'unverified' | 'machine-confirmed' | 'human-reviewed' {
    const list = this.normalizeVerified(verified);
    if (list.length === 0) return 'unverified';
    const hasHuman = list.some(entry => entry.by.startsWith('human:'));
    if (hasHuman) return 'human-reviewed';
    return 'machine-confirmed';
  }

  public isStale(staleAfter: string | undefined, now: Date = new Date()): boolean {
    if (!staleAfter) return false;
    const parsed = Date.parse(staleAfter);
    if (isNaN(parsed)) return false;
    return now.getTime() >= parsed;
  }

  public parseActor(actorStr: string): Actor {
    if (!actorStr || typeof actorStr !== 'string') {
      return { raw: actorStr || '', type: 'agent', name: 'unknown' };
    }
    const raw = actorStr.trim();
    if (raw.startsWith('human:')) {
      return {
        raw,
        type: 'human',
        name: raw.slice('human:'.length),
      };
    }
    if (raw.startsWith('process:')) {
      return {
        raw,
        type: 'process',
        name: raw.slice('process:'.length),
      };
    }
    const parts = raw.split('/');
    return {
      raw,
      type: 'agent',
      name: parts[0],
      versionOrId: parts[1],
    };
  }
}
