import { execSync } from 'node:child_process';
import path from 'node:path';
import { formatUtcIso } from './trust.js';

export function isGitRepo(cwd: string): boolean {
  try {
    const res = execSync('git rev-parse --is-inside-work-tree', {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
    return res.trim() === 'true';
  } catch {
    return false;
  }
}

export function getCurrentCommitSha(cwd: string): string | null {
  try {
    const res = execSync('git rev-parse HEAD', {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
    return res.trim();
  } catch {
    return null;
  }
}

export function getRemoteOriginUrl(cwd: string): string | null {
  try {
    const res = execSync('git config --get remote.origin.url', {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
    return res.trim();
  } catch {
    return null;
  }
}

export function normalizeRepoWebUrl(
  remoteUrl: string
): { type: 'github' | 'gitlab' | 'generic'; webUrl: string } | null {
  if (!remoteUrl) return null;
  const trimmed = remoteUrl.trim();

  // GitHub SSH: git@github.com:owner/repo.git
  const ghSsh = trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (ghSsh) {
    return {
      type: 'github',
      webUrl: `https://github.com/${ghSsh[1]}/${ghSsh[2]}`,
    };
  }

  // GitHub HTTPS: https://github.com/owner/repo.git or https://github.com/owner/repo
  const ghHttps = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (ghHttps) {
    return {
      type: 'github',
      webUrl: `https://github.com/${ghHttps[1]}/${ghHttps[2]}`,
    };
  }

  // GitLab SSH: git@gitlab.com:owner/repo.git
  const glSsh = trimmed.match(/^git@gitlab\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (glSsh) {
    return {
      type: 'gitlab',
      webUrl: `https://gitlab.com/${glSsh[1]}/${glSsh[2]}`,
    };
  }

  // GitLab HTTPS: https://gitlab.com/owner/repo.git
  const glHttps = trimmed.match(/^https?:\/\/gitlab\.com\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (glHttps) {
    return {
      type: 'gitlab',
      webUrl: `https://gitlab.com/${glHttps[1]}/${glHttps[2]}`,
    };
  }

  // Generic fallback if https
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    const clean = trimmed.replace(/\.git$/, '');
    return {
      type: 'generic',
      webUrl: clean,
    };
  }

  return null;
}

export function buildPermalink(
  webUrl: string,
  repoType: 'github' | 'gitlab' | 'generic',
  commitSha: string,
  repoRelativePath: string,
  fragment?: string
): string {
  const normPath = repoRelativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const fragStr = fragment || '';

  if (repoType === 'gitlab') {
    return `${webUrl}/-/blob/${commitSha}/${normPath}${fragStr}`;
  }

  // GitHub and generic default: /blob/<commit>/<path>
  return `${webUrl}/blob/${commitSha}/${normPath}${fragStr}`;
}

export function parsePermalink(
  url: string
): { repoRelativePath: string; commitSha?: string; fragment?: string } | null {
  if (!url || typeof url !== 'string') return null;

  // GitHub: https://github.com/owner/repo/blob/<commit>/<path>#fragment
  const gh = url.match(/^https?:\/\/[^/]+\/[^/]+\/[^/]+\/blob\/([^/]+)\/([^#]+)(#.*)?$/);
  if (gh) {
    return {
      commitSha: gh[1],
      repoRelativePath: gh[2],
      fragment: gh[3],
    };
  }

  // GitLab: https://gitlab.com/owner/repo/-/blob/<commit>/<path>#fragment
  const gl = url.match(/^https?:\/\/[^/]+\/[^/]+\/[^/]+\/-\/blob\/([^/]+)\/([^#]+)(#.*)?$/);
  if (gl) {
    return {
      commitSha: gl[1],
      repoRelativePath: gl[2],
      fragment: gl[3],
    };
  }

  return null;
}

export function getFileGitMetadata(
  cwd: string,
  repoRelativePath: string
): { author?: string; lastModified?: string } | null {
  try {
    const normPath = repoRelativePath.replace(/\\/g, '/');
    const out = execSync(`git log -1 --format="%an|%aI" -- "${normPath}"`, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    }).trim();

    if (!out) return null;

    const [authorName, dateStr] = out.split('|');
    if (!authorName && !dateStr) return null;

    let isoUtc: string | undefined;
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        isoUtc = formatUtcIso(d);
      }
    }

    return {
      author: authorName ? `human:${authorName}` : undefined,
      lastModified: isoUtc,
    };
  } catch {
    return null;
  }
}

export function hasFileChangedSinceCommit(
  cwd: string,
  baseCommit: string,
  repoRelativePath: string
): boolean {
  try {
    const normPath = repoRelativePath.replace(/\\/g, '/');
    const diff = execSync(`git diff --name-only ${baseCommit}..HEAD -- "${normPath}"`, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
    }).trim();

    return diff.length > 0;
  } catch {
    return false;
  }
}
