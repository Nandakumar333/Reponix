import type { Concept, VerifiedEntry } from './types.js';
import { OkfV02Adapter } from './spec-adapter.js';

export interface TrustStampOptions {
  allPassed: boolean;
  hasMissingSourceFile?: boolean;
  now?: Date;
  staleAfterDays?: number;
  emitV01Timestamp?: boolean;
}

export function formatUtcIso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function calculateStaleAfter(generatedAt: string, days: number = 90): string {
  const parsed = Date.parse(generatedAt);
  const base = isNaN(parsed) ? new Date() : new Date(parsed);
  const future = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return formatUtcIso(future);
}

export function stampTrust(concept: Concept, options: TrustStampOptions): Concept {
  const adapter = new OkfV02Adapter();
  const now = options.now || new Date();
  const nowIso = formatUtcIso(now);
  const staleDays = options.staleAfterDays ?? 90;

  const fm = { ...concept.frontmatter };

  // Ensure generated exists
  if (!fm.generated) {
    const agentName = concept.owningAgent || 'reponix';
    fm.generated = {
      by: `reponix-${agentName}/model`,
      at: nowIso,
    };
  } else if (!fm.generated.at) {
    fm.generated.at = nowIso;
  }

  // Stale after calculation
  if (!fm.stale_after) {
    fm.stale_after = calculateStaleAfter(fm.generated.at, staleDays);
  }

  // v0.1 compatibility timestamp
  if (options.emitV01Timestamp ?? true) {
    fm.timestamp = fm.generated.at;
  }

  // Handle status and verification
  if (options.hasMissingSourceFile) {
    fm.status = 'deprecated';
  } else if (options.allPassed) {
    fm.status = 'stable';
    const verifiedList = adapter.normalizeVerified(fm.verified);

    // Check if machine-confirmed is already present
    const alreadyMachineConfirmed = verifiedList.some(
      v => v.by === 'process:reponix-validator'
    );

    if (!alreadyMachineConfirmed) {
      verifiedList.push({
        by: 'process:reponix-validator',
        at: nowIso,
      });
    }

    fm.verified = verifiedList;
  } else {
    // Has issues, keep/set as draft if not verified
    const verifiedList = adapter.normalizeVerified(fm.verified);
    if (verifiedList.length === 0) {
      fm.status = 'draft';
    }
  }

  concept.frontmatter = fm;
  return concept;
}

export function addHumanVerification(
  concept: Concept,
  humanId: string,
  now: Date = new Date()
): Concept {
  if (!humanId.startsWith('human:')) {
    throw new Error(`Actor identifier must begin with "human:", got "${humanId}"`);
  }

  const adapter = new OkfV02Adapter();
  const nowIso = formatUtcIso(now);
  const verifiedList = adapter.normalizeVerified(concept.frontmatter.verified);

  // Append new human verification
  verifiedList.push({
    by: humanId,
    at: nowIso,
  });

  concept.frontmatter = {
    ...concept.frontmatter,
    status: 'stable',
    verified: verifiedList,
  };

  return concept;
}
