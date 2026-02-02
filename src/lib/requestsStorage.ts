import type { ISODate, MusicRequest } from '../models/Request';

const STORAGE_KEY = 'cmr_requests_v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function safeBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function coerceRequest(raw: unknown): MusicRequest | undefined {
  if (!isRecord(raw)) return undefined;

  const id = safeString(raw.id);
  const studentName = safeString(raw.studentName);
  const songTitle = safeString(raw.songTitle);
  const artist = safeString(raw.artist);
  const dateRequested = safeString(raw.dateRequested);
  const archivedDate = safeString(raw.archivedDate);
  const delivered = safeBoolean(raw.delivered);
  const reimbursed = safeBoolean(raw.reimbursed);
  const createdAt = safeString(raw.createdAt);
  const updatedAt = safeString(raw.updatedAt);

  if (
    !id ||
    !studentName ||
    !songTitle ||
    !artist ||
    !dateRequested ||
    delivered === undefined ||
    reimbursed === undefined ||
    !createdAt ||
    !updatedAt
  ) {
    return undefined;
  }

  return {
    id,
    studentName,
    songTitle,
    artist,
    dateRequested: dateRequested as ISODate,
    dueDate: safeString(raw.dueDate) as ISODate | undefined,
    archivedDate: archivedDate as ISODate | undefined,
    scoreLink: safeString(raw.scoreLink),
    cost: safeNumber(raw.cost),
    delivered,
    reimbursed,
    notes: safeString(raw.notes),
    createdAt,
    updatedAt,
  };
}

export function loadRequests(): MusicRequest[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(coerceRequest).filter((r): r is MusicRequest => Boolean(r));
  } catch {
    return [];
  }
}

export function saveRequests(requests: MusicRequest[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

