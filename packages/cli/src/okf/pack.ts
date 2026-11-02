import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type { Bundle, Concept } from './types.js';
import { formatUtcIso } from './trust.js';

export type PackFormat = 'markdown' | 'json' | 'tar';

export interface PackOptions {
  format: PackFormat;
  outFile?: string;
  compress?: boolean;
}

export function packBundleToMarkdown(bundle: Bundle): string {
  const lines: string[] = [];

  lines.push('# Open Knowledge Format (OKF) Bundle');
  lines.push('');
  lines.push(`*Generated at: ${formatUtcIso(new Date())}*`);
  lines.push(`*Total Concepts: ${bundle.concepts.size}*`);
  lines.push('');

  // Table of Contents
  lines.push('## Table of Contents');
  lines.push('');
  const sortedConcepts = Array.from(bundle.concepts.values()).sort((a, b) =>
    a.bundleRelativePath.localeCompare(b.bundleRelativePath)
  );

  for (const c of sortedConcepts) {
    const title = c.frontmatter.title || path.basename(c.bundleRelativePath, '.md');
    const anchor = c.bundleRelativePath.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    lines.push(`- [${title} (/${c.bundleRelativePath})](#concept-${anchor})`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Concatenate Concepts
  for (const c of sortedConcepts) {
    const anchor = c.bundleRelativePath.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    lines.push(`<!-- concept: ${c.bundleRelativePath} -->`);
    lines.push(`<a id="concept-${anchor}"></a>`);
    lines.push(`### Concept: \`${c.bundleRelativePath}\``);
    lines.push('');
    lines.push(c.raw.trim());
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function packBundleToJson(bundle: Bundle): string {
  const conceptsList: Array<{
    id: string;
    path: string;
    owningAgent: string;
    frontmatter: Record<string, any>;
    body: string;
  }> = [];

  const sortedConcepts = Array.from(bundle.concepts.values()).sort((a, b) =>
    a.bundleRelativePath.localeCompare(b.bundleRelativePath)
  );

  for (const c of sortedConcepts) {
    conceptsList.push({
      id: c.id,
      path: c.bundleRelativePath,
      owningAgent: c.owningAgent || 'unknown',
      frontmatter: c.frontmatter,
      body: c.body,
    });
  }

  const indicesObj: Record<string, string> = {};
  for (const [p, content] of bundle.indexFiles.entries()) {
    indicesObj[p] = content;
  }

  const logsObj: Record<string, string> = {};
  for (const [p, content] of bundle.logFiles.entries()) {
    logsObj[p] = content;
  }

  const payload = {
    okf_version: '0.2',
    generated_at: formatUtcIso(new Date()),
    concepts: conceptsList,
    indices: indicesObj,
    logs: logsObj,
  };

  return JSON.stringify(payload, null, 2);
}

function writeOctal(buf: Buffer, val: number, offset: number, length: number): void {
  const octStr = val.toString(8).padStart(length - 1, '0') + '\0';
  buf.write(octStr, offset, length, 'ascii');
}

export function createTarHeader(name: string, size: number, mtime: number = Math.floor(Date.now() / 1000)): Buffer {
  const header = Buffer.alloc(512);

  // File Name (0-99)
  header.write(name, 0, Math.min(name.length, 100), 'utf-8');

  // File Mode (100-107) -> 0644
  writeOctal(header, 0o644, 100, 8);

  // UID (108-115) -> 0
  writeOctal(header, 0, 108, 8);

  // GID (116-123) -> 0
  writeOctal(header, 0, 116, 8);

  // Size (124-135)
  writeOctal(header, size, 124, 12);

  // Mtime (136-143)
  writeOctal(header, mtime, 136, 12);

  // Typeflag (156) -> '0' normal file
  header[156] = 48; // ASCII '0'

  // Ustar magic (257-262) -> "ustar\0"
  header.write('ustar\0', 257, 6, 'ascii');

  // Ustar version (263-264) -> "00"
  header.write('00', 263, 2, 'ascii');

  // Checksum calculation: sum of all bytes in 512-byte header with spaces (0x20) in checksum field (148-155)
  for (let i = 148; i < 156; i++) {
    header[i] = 32; // ASCII space
  }

  let chksum = 0;
  for (let i = 0; i < 512; i++) {
    chksum += header[i];
  }

  // Write checksum into 148-155 (6-digit octal, null, space)
  const chkStr = chksum.toString(8).padStart(6, '0') + '\0 ';
  header.write(chkStr, 148, 8, 'ascii');

  return header;
}

export function packBundleToTar(bundle: Bundle, compress: boolean = false): Buffer {
  const chunks: Buffer[] = [];

  // Walk all files in bundle.rootDir
  function collectFiles(dir: string): Array<{ relativePath: string; fullPath: string }> {
    const list: Array<{ relativePath: string; fullPath: string }> = [];
    if (!fs.existsSync(dir)) return list;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        list.push(...collectFiles(full));
      } else if (ent.isFile()) {
        const rel = path.relative(bundle.rootDir, full).replace(/\\/g, '/');
        list.push({ relativePath: rel, fullPath: full });
      }
    }
    return list;
  }

  const allFiles = collectFiles(bundle.rootDir).sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath)
  );

  for (const f of allFiles) {
    const data = fs.readFileSync(f.fullPath);
    const header = createTarHeader(f.relativePath, data.length);
    chunks.push(header);
    chunks.push(data);

    // 512-byte padding
    const remainder = data.length % 512;
    if (remainder > 0) {
      chunks.push(Buffer.alloc(512 - remainder));
    }
  }

  // End of archive: 1024 bytes of zeroes
  chunks.push(Buffer.alloc(1024));

  const tarBuffer = Buffer.concat(chunks);
  if (compress) {
    return zlib.gzipSync(tarBuffer);
  }
  return tarBuffer;
}

export function packBundle(
  bundle: Bundle,
  options: PackOptions
): { content: string | Buffer; outFile?: string } {
  let content: string | Buffer;

  if (options.format === 'markdown') {
    content = packBundleToMarkdown(bundle);
  } else if (options.format === 'json') {
    content = packBundleToJson(bundle);
  } else {
    // tar
    const shouldCompress = Boolean(
      options.compress ||
        (options.outFile && (options.outFile.endsWith('.gz') || options.outFile.endsWith('.tgz')))
    );
    content = packBundleToTar(bundle, shouldCompress);
  }

  if (options.outFile) {
    const resolvedOut = path.resolve(options.outFile);
    const outDir = path.dirname(resolvedOut);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    if (typeof content === 'string') {
      fs.writeFileSync(resolvedOut, content, 'utf-8');
    } else {
      fs.writeFileSync(resolvedOut, content);
    }
  }

  return { content, outFile: options.outFile };
}
