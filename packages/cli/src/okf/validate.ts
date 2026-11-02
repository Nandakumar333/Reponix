import { OkfV02Adapter } from './spec-adapter.js';
import { validateCitations } from './cite.js';
import { validateLinks } from './links.js';
import type { Bundle, Concept, ValidationIssue, ValidationSeverity } from './types.js';

export interface ValidateOptions {
  strict?: boolean;
}

export function isSingleSentence(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // If text contains newlines, it's not a single sentence
  if (trimmed.includes('\n')) return false;
  // Check if multiple terminal punctuations (.!?) followed by space exist
  const sentences = trimmed.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  return sentences.length === 1;
}

export function isIso8601ExplicitUtc(ts: string): boolean {
  // e.g. 2026-10-24T09:12:00Z or 2026-06-20T22:53:05Z
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(ts);
}

export function validateConcept(
  concept: Concept,
  bundle: Bundle,
  options?: ValidateOptions
): ValidationIssue[] {
  const adapter = new OkfV02Adapter();
  const strict = Boolean(options?.strict);
  const profileSeverity: ValidationSeverity = strict ? 'error' : 'warning';
  const issues: ValidationIssue[] = [];

  // Layer 1: Base OKF Spec Conformance (Hard errors)
  const specIssues = adapter.validateConceptConformance(concept);
  issues.push(...specIssues);

  const fm = concept.frontmatter;
  if (!fm || typeof fm !== 'object') {
    return issues;
  }

  // Layer 2: Reponix OKF Profile Rules

  // Profile: title
  if (!fm.title || typeof fm.title !== 'string' || fm.title.trim().length === 0) {
    issues.push({
      code: 'OKF_PROFILE_TITLE_MISSING',
      severity: profileSeverity,
      path: concept.bundleRelativePath,
      line: 1,
      message: 'Profile requires a non-empty "title" in frontmatter',
      agent: concept.owningAgent,
    });
  }

  // Profile: description (single sentence)
  if (!fm.description || typeof fm.description !== 'string') {
    issues.push({
      code: 'OKF_PROFILE_DESCRIPTION_MISSING',
      severity: profileSeverity,
      path: concept.bundleRelativePath,
      line: 1,
      message: 'Profile requires a single-sentence "description" in frontmatter',
      agent: concept.owningAgent,
    });
  } else if (!isSingleSentence(fm.description)) {
    issues.push({
      code: 'OKF_PROFILE_DESCRIPTION_FORMAT',
      severity: profileSeverity,
      path: concept.bundleRelativePath,
      line: 1,
      message: 'Profile requires description to be a single sentence without line breaks',
      agent: concept.owningAgent,
    });
  }

  // Profile: tags
  if (!Array.isArray(fm.tags) || fm.tags.length === 0) {
    issues.push({
      code: 'OKF_PROFILE_TAGS_MISSING',
      severity: profileSeverity,
      path: concept.bundleRelativePath,
      line: 1,
      message: 'Profile requires a non-empty list of "tags" in frontmatter',
      agent: concept.owningAgent,
    });
  }

  // Profile: generated: { by, at }
  if (!fm.generated || typeof fm.generated !== 'object') {
    issues.push({
      code: 'OKF_PROFILE_GENERATED_MISSING',
      severity: profileSeverity,
      path: concept.bundleRelativePath,
      line: 1,
      message: 'Profile requires "generated: { by, at }" in frontmatter',
      agent: concept.owningAgent,
    });
  } else {
    // Actor convention check for generated.by
    const by = fm.generated.by;
    if (!by || typeof by !== 'string') {
      issues.push({
        code: 'OKF_PROFILE_GENERATED_BY_MISSING',
        severity: profileSeverity,
        path: concept.bundleRelativePath,
        line: 1,
        message: 'Profile requires generated.by in frontmatter',
        agent: concept.owningAgent,
      });
    } else {
      // Must follow reponix-<agent-name>/<model-id> or actor format
      const isReponixActor = /^reponix-[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(by);
      const isGeneralActor = by.startsWith('human:') || by.startsWith('process:') || by.includes('/');
      if (!isReponixActor && !isGeneralActor) {
        issues.push({
          code: 'OKF_PROFILE_ACTOR_FORMAT',
          severity: profileSeverity,
          path: concept.bundleRelativePath,
          line: 1,
          message: `Profile recommends generated.by format "reponix-<agent-name>/<model-id>", got "${by}"`,
          agent: concept.owningAgent,
        });
      }
    }

    // Timestamp check
    const at = fm.generated.at;
    if (!at || typeof at !== 'string') {
      issues.push({
        code: 'OKF_PROFILE_GENERATED_AT_MISSING',
        severity: profileSeverity,
        path: concept.bundleRelativePath,
        line: 1,
        message: 'Profile requires generated.at in frontmatter',
        agent: concept.owningAgent,
      });
    } else if (!isIso8601ExplicitUtc(at)) {
      issues.push({
        code: 'OKF_PROFILE_TIMESTAMP_FORMAT',
        severity: profileSeverity,
        path: concept.bundleRelativePath,
        line: 1,
        message: `Timestamps must be ISO-8601 with explicit "Z", got "${at}"`,
        agent: concept.owningAgent,
      });
    }
  }

  // Profile: check verified timestamp format if present
  if (fm.verified) {
    const list = adapter.normalizeVerified(fm.verified);
    for (const v of list) {
      if (v.at && !isIso8601ExplicitUtc(v.at)) {
        issues.push({
          code: 'OKF_PROFILE_TIMESTAMP_FORMAT',
          severity: profileSeverity,
          path: concept.bundleRelativePath,
          line: 1,
          message: `Verified timestamp must be ISO-8601 with explicit "Z", got "${v.at}"`,
          agent: concept.owningAgent,
        });
      }
    }
  }

  // Profile: check stale_after format if present
  if (fm.stale_after && !isIso8601ExplicitUtc(fm.stale_after)) {
    issues.push({
      code: 'OKF_PROFILE_TIMESTAMP_FORMAT',
      severity: profileSeverity,
      path: concept.bundleRelativePath,
      line: 1,
      message: `stale_after must be ISO-8601 with explicit "Z", got "${fm.stale_after}"`,
      agent: concept.owningAgent,
    });
  }

  // Profile: Reponix-specific metadata lives only under `reponix: { cli, commit, agent }`
  const forbiddenTopKeys = ['agent', 'commit', 'cli', 'confidence', 'credibility', 'score'];
  for (const k of forbiddenTopKeys) {
    if (k in fm) {
      issues.push({
        code: 'OKF_PROFILE_NAMESPACING',
        severity: profileSeverity,
        path: concept.bundleRelativePath,
        line: 1,
        message: `Reponix metadata must live under namespaced "reponix" key, not top-level "${k}"`,
        agent: concept.owningAgent,
      });
    }
  }

  // Profile: No numeric confidence/credibility scores anywhere
  if (typeof fm.confidence === 'number' || typeof fm.credibility === 'number' || typeof fm.score === 'number') {
    issues.push({
      code: 'OKF_PROFILE_NO_NUMERIC_SCORES',
      severity: 'error',
      path: concept.bundleRelativePath,
      line: 1,
      message: 'Numeric confidence or credibility scores are strictly prohibited in OKF bundles',
      agent: concept.owningAgent,
    });
  }

  // Profile: sources requirements for claim-bearing concepts
  // Overview concepts or Playbooks may be exempt, but contracts/inventory/specs must have sources
  const isClaimBearing = concept.bundleRelativePath.startsWith('contracts/') ||
    concept.bundleRelativePath.startsWith('inventory/') ||
    concept.bundleRelativePath.startsWith('architecture/') ||
    concept.bundleRelativePath.startsWith('reconstruction/');

  if (isClaimBearing) {
    if (!Array.isArray(fm.sources) || fm.sources.length === 0) {
      issues.push({
        code: 'OKF_PROFILE_SOURCES_REQUIRED',
        severity: profileSeverity,
        path: concept.bundleRelativePath,
        line: 1,
        message: `Claim-bearing concept "${concept.bundleRelativePath}" must have at least one source in "sources"`,
        agent: concept.owningAgent,
      });
    } else {
      for (let sIdx = 0; sIdx < fm.sources.length; sIdx++) {
        const src = fm.sources[sIdx];
        if (!src.id) {
          issues.push({
            code: 'OKF_PROFILE_SOURCE_ID_MISSING',
            severity: profileSeverity,
            path: concept.bundleRelativePath,
            line: 1,
            message: `Source at index ${sIdx} is missing required "id" field`,
            agent: concept.owningAgent,
          });
        }
        if (!src.title) {
          issues.push({
            code: 'OKF_PROFILE_SOURCE_TITLE_MISSING',
            severity: profileSeverity,
            path: concept.bundleRelativePath,
            line: 1,
            message: `Source "${src.id || sIdx}" is missing recommended "title" field`,
            agent: concept.owningAgent,
          });
        }
      }
    }
  }

  // Profile: citations and footnotes validation
  const citeResult = validateCitations(concept, bundle.repoRoot, strict);
  issues.push(...citeResult.issues);

  // Profile: links validation
  const linkIssues = validateLinks(concept, bundle, strict);
  issues.push(...linkIssues);

  return issues;
}

export function validateBundle(
  bundle: Bundle,
  options?: ValidateOptions
): ValidationIssue[] {
  const adapter = new OkfV02Adapter();
  const allIssues: ValidationIssue[] = [];

  // 1. Validate reserved files
  for (const [relPath, content] of bundle.indexFiles.entries()) {
    const isRoot = relPath === 'index.md';
    allIssues.push(...adapter.validateReservedFile('index.md', content, relPath, isRoot));
  }

  for (const [relPath, content] of bundle.logFiles.entries()) {
    allIssues.push(...adapter.validateReservedFile('log.md', content, relPath, false));
  }

  // 2. Validate every concept
  for (const concept of bundle.concepts.values()) {
    allIssues.push(...validateConcept(concept, bundle, options));
  }

  return allIssues;
}
