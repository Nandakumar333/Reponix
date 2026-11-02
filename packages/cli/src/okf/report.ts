import pc from 'picocolors';
import type { ValidationIssue, FinalizeSummary, Bundle } from './types.js';

export function formatTextReport(issues: ValidationIssue[]): string {
  if (issues.length === 0) {
    return pc.green('\n  ✔ OKF Bundle validated successfully with 0 errors and 0 warnings.\n');
  }

  const grouped = new Map<string, ValidationIssue[]>();
  for (const issue of issues) {
    const list = grouped.get(issue.path) || [];
    list.push(issue);
    grouped.set(issue.path, list);
  }

  const lines: string[] = [''];
  let errorCount = 0;
  let warnCount = 0;

  for (const [filePath, fileIssues] of grouped.entries()) {
    lines.push(pc.bold(pc.underline(`  ${filePath}`)));
    for (const issue of fileIssues) {
      if (issue.severity === 'error') errorCount++;
      else warnCount++;

      const badge = issue.severity === 'error'
        ? pc.red('ERROR')
        : issue.severity === 'warning'
        ? pc.yellow('WARN')
        : pc.cyan('INFO');

      const loc = issue.line ? `:${issue.line}` : '';
      const agentTag = issue.agent ? pc.dim(` [${issue.agent}]`) : '';
      lines.push(`    ${badge} ${pc.gray(issue.code)}${agentTag} — ${issue.message}${pc.dim(loc)}`);
    }
    lines.push('');
  }

  const summary = errorCount > 0
    ? pc.red(`  ✖ Validation failed with ${errorCount} error(s) and ${warnCount} warning(s).\n`)
    : pc.yellow(`  ⚠ Validation completed with 0 errors and ${warnCount} warning(s).\n`);

  lines.push(summary);
  return lines.join('\n');
}

export function formatJsonReport(issues: ValidationIssue[]): string {
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  const output = {
    valid: errorCount === 0,
    summary: {
      errors: errorCount,
      warnings: warningCount,
      total: issues.length,
    },
    issues,
  };

  return JSON.stringify(output, null, 2);
}

export function formatSarifReport(issues: ValidationIssue[]): string {
  // Collect unique rules
  const ruleMap = new Map<string, { id: string; name: string; shortDescription: { text: string } }>();
  for (const issue of issues) {
    if (!ruleMap.has(issue.code)) {
      ruleMap.set(issue.code, {
        id: issue.code,
        name: issue.code.toLowerCase().replace(/_/g, '-'),
        shortDescription: { text: issue.message },
      });
    }
  }

  const results = issues.map(issue => {
    let level: 'error' | 'warning' | 'note' = 'note';
    if (issue.severity === 'error') level = 'error';
    else if (issue.severity === 'warning') level = 'warning';

    const resultObj: any = {
      ruleId: issue.code,
      level,
      message: {
        text: issue.message,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: issue.path.replace(/\\/g, '/'),
              uriBaseId: '%SRCROOT%',
            },
            region: {
              startLine: issue.line || 1,
            },
          },
        },
      ],
    };

    if (issue.agent) {
      resultObj.properties = {
        owningAgent: issue.agent,
      };
    }

    return resultObj;
  });

  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'reponix-okf',
            version: '0.2.0',
            informationUri: 'https://github.com/GoogleCloudPlatform/knowledge-catalog',
            rules: Array.from(ruleMap.values()),
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

export function createFinalizeSummary(
  bundle: Bundle,
  issues: ValidationIssue[]
): FinalizeSummary {
  const errorIssues = issues.filter(i => i.severity === 'error');
  const totalConcepts = bundle.concepts.size;

  const failedConceptMap = new Map<string, { id: string; path: string; owningAgent: string; issues: ValidationIssue[] }>();

  for (const issue of issues) {
    if (issue.severity === 'error') {
      const entry = failedConceptMap.get(issue.path) || {
        id: issue.path.replace(/\.md$/, ''),
        path: issue.path,
        owningAgent: issue.agent || 'reponix-orchestrator',
        issues: [],
      };
      entry.issues.push(issue);
      failedConceptMap.set(issue.path, entry);
    }
  }

  const failedConcepts = Array.from(failedConceptMap.values());
  const validConcepts = Math.max(0, totalConcepts - failedConcepts.length);

  return {
    success: errorIssues.length === 0,
    totalConcepts,
    validConcepts,
    issues,
    failedConcepts,
  };
}
