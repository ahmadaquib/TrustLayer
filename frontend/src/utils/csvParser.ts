/**
 * Lightweight CSV parsing helper for TrustLayer evaluation results.
 * Strictly standard library TypeScript — no external CSV dependencies.
 */

export interface AblationRecord {
  caseId: string;
  bucket: string;
  mode: string;
  expected: string;
  actual: string;
  correct: boolean;
}

export interface FullResultRecord {
  caseId: string;
  bucket: string;
  expected: string;
  actual: string;
  riskScore: number;
  groundingScore: number;
  latency: number;
}

export function parseAblationCsv(csvText: string): AblationRecord[] {
  if (!csvText || typeof csvText !== 'string') return [];
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  const records: AblationRecord[] = [];

  // Expected header: case id,bucket,mode,expected,actual,correct
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length < 6) continue;

    records.push({
      caseId: parts[0],
      bucket: parts[1],
      mode: parts[2],
      expected: parts[3],
      actual: parts[4],
      correct: parts[5].toLowerCase() === 'true' || parts[5] === '1',
    });
  }

  return records;
}

export function parseResultsCsv(csvText: string): FullResultRecord[] {
  if (!csvText || typeof csvText !== 'string') return [];
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];

  const records: FullResultRecord[] = [];

  // Expected header: case id,bucket,expected,actual,risk score,grounding score,latency
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length < 7) continue;

    records.push({
      caseId: parts[0],
      bucket: parts[1],
      expected: parts[2],
      actual: parts[3],
      riskScore: Number.parseFloat(parts[4]) || 0,
      groundingScore: Number.parseFloat(parts[5]) || 0,
      latency: Number.parseFloat(parts[6]) || 0,
    });
  }

  return records;
}

