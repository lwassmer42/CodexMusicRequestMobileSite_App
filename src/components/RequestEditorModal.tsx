import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useMemo, useState } from 'react';
import type { ISODate, MusicRequest } from '../models/Request';

export type RequestEditorDraft = Pick<
  MusicRequest,
  'studentName' | 'songTitle' | 'artist' | 'dateRequested' | 'dueDate' | 'scoreLink' | 'cost' | 'notes'
>;

function todayIsoDate(): ISODate {
  return new Date().toISOString().slice(0, 10) as ISODate;
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function RequestEditorModal({
  isOpen,
  title,
  initialDraft,
  onCancel,
  onSave,
}: {
  isOpen: boolean;
  title: string;
  initialDraft?: Partial<RequestEditorDraft>;
  onCancel: () => void;
  onSave: (draft: RequestEditorDraft) => void;
}) {
  const baseDraft = useMemo<RequestEditorDraft>(
    () => ({
      studentName: '',
      songTitle: '',
      artist: '',
      dateRequested: todayIsoDate(),
      dueDate: undefined,
      scoreLink: undefined,
      cost: undefined,
      notes: undefined,
      ...initialDraft,
    }),
    [initialDraft],
  );

  const [studentName, setStudentName] = useState(baseDraft.studentName);
  const [songTitle, setSongTitle] = useState(baseDraft.songTitle);
  const [artist, setArtist] = useState(baseDraft.artist);
  const [dateRequested, setDateRequested] = useState<ISODate>(baseDraft.dateRequested);
  const [dueDate, setDueDate] = useState<ISODate | undefined>(baseDraft.dueDate);
  const [scoreLink, setScoreLink] = useState<string | undefined>(baseDraft.scoreLink);
  const [cost, setCost] = useState<number | undefined>(baseDraft.cost);
  const [notes, setNotes] = useState<string | undefined>(baseDraft.notes);

  useEffect(() => {
    if (!isOpen) return;
    setStudentName(baseDraft.studentName);
    setSongTitle(baseDraft.songTitle);
    setArtist(baseDraft.artist);
    setDateRequested(baseDraft.dateRequested);
    setDueDate(baseDraft.dueDate);
    setScoreLink(baseDraft.scoreLink);
    setCost(baseDraft.cost);
    setNotes(baseDraft.notes);
  }, [isOpen, baseDraft]);

  const canSave = studentName.trim() && songTitle.trim() && artist.trim();

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onCancel} className="requestEditorModal">
      <IonHeader className="appHeader">
        <IonToolbar className="appToolbar">
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onCancel}>Cancel</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="requestEditorContent">
        <IonList inset>
          <IonItem>
            <IonLabel position="stacked">
              Student Name <span className="required">*</span>
            </IonLabel>
            <IonInput
              value={studentName}
              onIonInput={(e) => setStudentName(e.detail.value ?? '')}
              placeholder="Student Name"
              inputMode="text"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">
              Song Title <span className="required">*</span>
            </IonLabel>
            <IonInput
              value={songTitle}
              onIonInput={(e) => setSongTitle(e.detail.value ?? '')}
              placeholder="Song Title"
              inputMode="text"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">
              Artist <span className="required">*</span>
            </IonLabel>
            <IonInput
              value={artist}
              onIonInput={(e) => setArtist(e.detail.value ?? '')}
              placeholder="Artist"
              inputMode="text"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Score Link (optional)</IonLabel>
            <IonInput
              value={scoreLink ?? ''}
              onIonInput={(e) => setScoreLink(normalizeOptionalText(e.detail.value))}
              placeholder="https://…"
              inputMode="url"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Cost (optional)</IonLabel>
            <IonInput
              value={cost?.toString() ?? ''}
              onIonInput={(e) => {
                const next = normalizeOptionalText(e.detail.value);
                setCost(next ? Number(next) : undefined);
              }}
              placeholder="0.00"
              inputMode="decimal"
              type="number"
              step="0.01"
              min="0"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Date Requested</IonLabel>
            <IonInput
              value={dateRequested}
              onIonInput={(e) => setDateRequested(((e.detail.value ?? '') as ISODate) || todayIsoDate())}
              type="date"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Due Date (optional)</IonLabel>
            <IonInput
              value={dueDate ?? ''}
              onIonInput={(e) => setDueDate(normalizeOptionalText(e.detail.value) as ISODate | undefined)}
              type="date"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Notes (optional)</IonLabel>
            <IonTextarea
              value={notes ?? ''}
              onIonInput={(e) => setNotes(normalizeOptionalText(e.detail.value))}
              autoGrow
              placeholder="Anything special about this request…"
            />
          </IonItem>
        </IonList>

        <div className="requestEditorActions">
          <IonButton
            expand="block"
            shape="round"
            strong
            disabled={!canSave}
            onClick={() =>
              onSave({
                studentName: studentName.trim(),
                songTitle: songTitle.trim(),
                artist: artist.trim(),
                dateRequested,
                dueDate,
                scoreLink: normalizeOptionalText(scoreLink),
                cost: cost !== undefined && Number.isFinite(cost) ? cost : undefined,
                notes: normalizeOptionalText(notes),
              })
            }
          >
            Save Request
          </IonButton>
        </div>
      </IonContent>
    </IonModal>
  );
}

