import type { Concept, Bundle, ValidationIssue } from './types.js';

export interface SecretPattern {
  name: string;
  regex: RegExp;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: 'AWS Access Key ID',
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
  },
  {
    name: 'AWS Secret Key',
    regex: /(?:aws_secret_access_key|aws_secret_key)\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi,
  },
  {
    name: 'GitHub Token',
    regex: /\b(gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59})\b/g,
  },
  {
    name: 'Slack Token',
    regex: /\b(xox[baprs]-[0-9a-zA-Z]{10,48})\b/g,
  },
  {
    name: 'Google API Key',
    regex: /\b(AIza[0-9A-Za-z_-]{30,40})\b/g,
  },
  {
    name: 'Stripe API Key',
    regex: /\b(?:sk|rk)_live_[0-9a-zA-Z]{24}\b/g,
  },
  {
    name: 'Private Key Block',
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  },
  {
    name: 'Generic API Key / Secret Token',
    regex: /(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|password)\s*[:=]\s*["']([A-Za-z0-9_\-]{24,})["']/gi,
  },
];

export function redactSecret(secret: string): string {
  if (secret.length <= 6) {
    return '******';
  }
  const prefix = secret.slice(0, 4);
  const stars = '*'.repeat(Math.max(6, secret.length - 4));
  return `${prefix}${stars}`;
}

export interface SecretScanResult {
  rule: string;
  line: number;
  redacted: string;
}

export function scanTextForSecrets(text: string): SecretScanResult[] {
  const results: SecretScanResult[] = [];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const pattern of SECRET_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.regex.exec(line)) !== null) {
        const secretVal = match[1] || match[0];
        results.push({
          rule: pattern.name,
          line: i + 1,
          redacted: redactSecret(secretVal),
        });
      }
    }
  }

  return results;
}

export function scanConceptForSecrets(concept: Concept): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const matches = scanTextForSecrets(concept.raw);

  for (const match of matches) {
    issues.push({
      code: 'OKF_SECRET_DETECTED',
      severity: 'error',
      path: concept.bundleRelativePath,
      line: match.line,
      message: `Potential secret detected (${match.rule}): ${match.redacted}. Remove before finalizing.`,
      agent: concept.owningAgent,
    });
  }

  return issues;
}

export function scanBundleForSecrets(bundle: Bundle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const concept of bundle.concepts.values()) {
    issues.push(...scanConceptForSecrets(concept));
  }
  return issues;
}
