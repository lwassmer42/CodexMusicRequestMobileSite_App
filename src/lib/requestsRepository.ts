import type { ISODate, MusicRequest } from '../models/Request';
import { assertSupabaseConfigured } from './supabaseClient';

type DbRequestRow = {
  id: string;
  user_id: string;
  student_name: string;
  song_title: string;
  artist: string;
  date_requested: string;
  due_date: string | null;
  archived_date: string | null;
  score_link: string | null;
  cost: number | null;
  only_deliverable_if_reimbursed: boolean;
  delivered: boolean;
  reimbursed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type DbRequestInsert = Omit<DbRequestRow, never>;

function toDbRow(userId: string, request: MusicRequest): DbRequestInsert {
  return {
    id: request.id,
    user_id: userId,
    student_name: request.studentName,
    song_title: request.songTitle,
    artist: request.artist,
    date_requested: request.dateRequested,
    due_date: request.dueDate ?? null,
    archived_date: request.archivedDate ?? null,
    score_link: request.scoreLink ?? null,
    cost: request.cost ?? null,
    only_deliverable_if_reimbursed: Boolean(request.onlyDeliverableIfReimbursed),
    delivered: request.delivered,
    reimbursed: request.reimbursed,
    notes: request.notes ?? null,
    created_at: request.createdAt,
    updated_at: request.updatedAt,
  };
}

function fromDbRow(row: DbRequestRow): MusicRequest {
  return {
    id: row.id,
    studentName: row.student_name,
    songTitle: row.song_title,
    artist: row.artist,
    dateRequested: row.date_requested as ISODate,
    dueDate: (row.due_date ?? undefined) as ISODate | undefined,
    archivedDate: (row.archived_date ?? undefined) as ISODate | undefined,
    scoreLink: row.score_link ?? undefined,
    cost: row.cost ?? undefined,
    onlyDeliverableIfReimbursed: row.only_deliverable_if_reimbursed,
    delivered: row.delivered,
    reimbursed: row.reimbursed,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchRequests(userId: string): Promise<MusicRequest[]> {
  const supabase = assertSupabaseConfigured();
  const { data, error } = await supabase.from('requests').select('*').eq('user_id', userId);
  if (error) throw error;
  return (data as DbRequestRow[]).map(fromDbRow);
}

export async function upsertRequest(userId: string, request: MusicRequest): Promise<void> {
  const supabase = assertSupabaseConfigured();
  const row = toDbRow(userId, request);
  const { error } = await supabase.from('requests').upsert(row);
  if (error) throw error;
}

export async function upsertRequests(userId: string, requests: MusicRequest[]): Promise<void> {
  const supabase = assertSupabaseConfigured();
  const rows = requests.map((r) => toDbRow(userId, r));
  const { error } = await supabase.from('requests').upsert(rows);
  if (error) throw error;
}

export async function deleteRequest(userId: string, requestId: string): Promise<void> {
  const supabase = assertSupabaseConfigured();
  const { error } = await supabase.from('requests').delete().eq('user_id', userId).eq('id', requestId);
  if (error) throw error;
}
