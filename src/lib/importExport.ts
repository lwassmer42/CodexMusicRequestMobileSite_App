import * as XLSX from 'xlsx';
import { generateId } from './id';
import type { ISODate, MusicRequest } from '../models/Request';

export const EXCEL_HEADERS = [
  'Student Name',
  'Song Title',
  'Artist',
  'Date Requested',
  'Archived Date',
  'Score Link',
  'Cost',
  'Delivered',
  'Reimbursed',
  'Due Date',
  'Notes',
] as const;

export type ImportSummary = {
  added: number;
  skippedDuplicates: number;
  skippedInvalid: number;
};

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeDupeKeyParts(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}

export function dupeKeyFromParts(studentName: string, songTitle: string, artist: string) {
  return `${normalizeDupeKeyParts(studentName)}|${normalizeDupeKeyParts(songTitle)}|${normalizeDupeKeyParts(artist)}`;
}

function nowIsoString() {
  return new Date().toISOString();
}

function todayIsoDate(): ISODate {
  return new Date().toISOString().slice(0, 10) as ISODate;
}

function formatYesNo(value: boolean) {
  return value ? 'Yes' : 'No';
}

function parseYesNo(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['yes', 'y', 'true', '1'].includes(normalized)) return true;
  if (['no', 'n', 'false', '0'].includes(normalized)) return false;
  return undefined;
}

function isIsoDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toIsoDate(value: unknown): ISODate | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10) as ISODate;
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const y = String(parsed.y).padStart(4, '0');
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${y}-${m}-${d}` as ISODate;
    }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (isIsoDateString(trimmed)) return trimmed as ISODate;
    const dt = new Date(trimmed);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10) as ISODate;
  }

  return undefined;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toRequiredString(value: unknown): string | undefined {
  const str = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
  const trimmed = normalizeWhitespace(str);
  return trimmed ? trimmed : undefined;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function getHeaderValue(row: Record<string, unknown>, header: string) {
  const desired = header.trim().toLowerCase();
  for (const key of Object.keys(row)) {
    if (key.trim().toLowerCase() === desired) return row[key];
  }
  return undefined;
}

export function exportRequestsToXlsx(requests: MusicRequest[]) {
  const rows = requests.map((r) => ({
    'Student Name': r.studentName,
    'Song Title': r.songTitle,
    Artist: r.artist,
    'Date Requested': r.dateRequested,
    'Archived Date': r.archivedDate ?? '',
    'Score Link': r.scoreLink ?? '',
    Cost: r.cost ?? '',
    Delivered: formatYesNo(r.delivered),
    Reimbursed: formatYesNo(r.reimbursed),
    'Due Date': r.dueDate ?? '',
    Notes: r.notes ?? '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...EXCEL_HEADERS] });
  worksheet['!cols'] = [
    { wch: 22 },
    { wch: 26 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 38 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 40 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Requests');

  const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function importRequestsFromXlsx(
  buffer: ArrayBuffer,
  existingRequests: MusicRequest[],
): { requests: MusicRequest[]; summary: ImportSummary } {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) return { requests: existingRequests, summary: { added: 0, skippedDuplicates: 0, skippedInvalid: 0 } };

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
  const now = nowIsoString();
  const today = todayIsoDate();

  const existingKeys = new Set(existingRequests.map((r) => dupeKeyFromParts(r.studentName, r.songTitle, r.artist)));

  let added = 0;
  let skippedDuplicates = 0;
  let skippedInvalid = 0;

  const imported: MusicRequest[] = [];

  for (const row of rows) {
    const studentName = toRequiredString(getHeaderValue(row, 'Student Name'));
    const songTitle = toRequiredString(getHeaderValue(row, 'Song Title'));
    const artist = toRequiredString(getHeaderValue(row, 'Artist'));

    if (!studentName || !songTitle || !artist) {
      skippedInvalid += 1;
      continue;
    }

    const key = dupeKeyFromParts(studentName, songTitle, artist);
    if (existingKeys.has(key)) {
      skippedDuplicates += 1;
      continue;
    }

    existingKeys.add(key);

    const dateRequested = toIsoDate(getHeaderValue(row, 'Date Requested')) ?? today;
    const archivedDate = toIsoDate(getHeaderValue(row, 'Archived Date'));
    const dueDate = toIsoDate(getHeaderValue(row, 'Due Date'));
    const scoreLink = toOptionalString(getHeaderValue(row, 'Score Link'));
    const cost = toOptionalNumber(getHeaderValue(row, 'Cost'));
    const delivered = parseYesNo(getHeaderValue(row, 'Delivered')) ?? false;
    const reimbursed = parseYesNo(getHeaderValue(row, 'Reimbursed')) ?? false;
    const notes = toOptionalString(getHeaderValue(row, 'Notes'));

    imported.push({
      id: generateId(),
      studentName,
      songTitle,
      artist,
      dateRequested,
      archivedDate: delivered && reimbursed ? archivedDate ?? today : archivedDate,
      dueDate,
      scoreLink,
      cost,
      delivered,
      reimbursed,
      notes,
      createdAt: now,
      updatedAt: now,
    });

    added += 1;
  }

  return { requests: [...imported, ...existingRequests], summary: { added, skippedDuplicates, skippedInvalid } };
}

export function exportRequestsToJson(requests: MusicRequest[]) {
  const payload = {
    version: 1,
    exportedAt: nowIsoString(),
    requests,
  };

  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

export function importRequestsFromJson(
  jsonText: string,
  existingRequests: MusicRequest[],
): { requests: MusicRequest[]; summary: ImportSummary } {
  const now = nowIsoString();
  const today = todayIsoDate();

  const existingKeys = new Set(existingRequests.map((r) => dupeKeyFromParts(r.studentName, r.songTitle, r.artist)));

  let added = 0;
  let skippedDuplicates = 0;
  let skippedInvalid = 0;
  const imported: MusicRequest[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { requests: existingRequests, summary: { added: 0, skippedDuplicates: 0, skippedInvalid: 0 } };
  }

  const parsedRequests = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>).requests : undefined;
  const items: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(parsedRequests) ? parsedRequests : [];
  if (!Array.isArray(parsed) && !Array.isArray(parsedRequests)) {
    return { requests: existingRequests, summary: { added: 0, skippedDuplicates: 0, skippedInvalid: 0 } };
  }

  for (const item of items) {
    if (typeof item !== 'object' || item === null) {
      skippedInvalid += 1;
      continue;
    }

    const row = item as Record<string, unknown>;

    const studentName =
      toRequiredString(row.studentName) ?? toRequiredString(getHeaderValue(row, 'Student Name')) ?? undefined;
    const songTitle = toRequiredString(row.songTitle) ?? toRequiredString(getHeaderValue(row, 'Song Title')) ?? undefined;
    const artist = toRequiredString(row.artist) ?? toRequiredString(getHeaderValue(row, 'Artist')) ?? undefined;

    if (!studentName || !songTitle || !artist) {
      skippedInvalid += 1;
      continue;
    }

    const key = dupeKeyFromParts(studentName, songTitle, artist);
    if (existingKeys.has(key)) {
      skippedDuplicates += 1;
      continue;
    }
    existingKeys.add(key);

    const dateRequested =
      (toIsoDate(row.dateRequested) ?? toIsoDate(getHeaderValue(row, 'Date Requested')) ?? today) as ISODate;
    const archivedDate = (toIsoDate(row.archivedDate) ?? toIsoDate(getHeaderValue(row, 'Archived Date'))) as
      | ISODate
      | undefined;
    const dueDate = (toIsoDate(row.dueDate) ?? toIsoDate(getHeaderValue(row, 'Due Date'))) as ISODate | undefined;
    const scoreLink = toOptionalString(row.scoreLink) ?? toOptionalString(getHeaderValue(row, 'Score Link'));
    const cost = toOptionalNumber(row.cost) ?? toOptionalNumber(getHeaderValue(row, 'Cost'));
    const delivered = parseYesNo(row.delivered) ?? parseYesNo(getHeaderValue(row, 'Delivered')) ?? false;
    const reimbursed = parseYesNo(row.reimbursed) ?? parseYesNo(getHeaderValue(row, 'Reimbursed')) ?? false;
    const notes = toOptionalString(row.notes) ?? toOptionalString(getHeaderValue(row, 'Notes'));

    imported.push({
      id: generateId(),
      studentName,
      songTitle,
      artist,
      dateRequested,
      archivedDate: delivered && reimbursed ? archivedDate ?? today : archivedDate,
      dueDate,
      scoreLink,
      cost,
      delivered,
      reimbursed,
      notes,
      createdAt: now,
      updatedAt: now,
    });
    added += 1;
  }

  return { requests: [...imported, ...existingRequests], summary: { added, skippedDuplicates, skippedInvalid } };
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

