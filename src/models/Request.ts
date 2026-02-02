export type RequestId = string;

export type ISODate = `${number}-${number}-${number}`;

export interface MusicRequest {
  id: RequestId;

  studentName: string;
  songTitle: string;
  artist: string;

  dateRequested: ISODate;
  dueDate?: ISODate;
  archivedDate?: ISODate;

  scoreLink?: string;
  cost?: number;

  delivered: boolean;
  reimbursed: boolean;

  notes?: string;
  createdAt: string;
  updatedAt: string;
}

