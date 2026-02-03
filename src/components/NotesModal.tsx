import { IonButton, IonContent, IonIcon, IonModal, IonTextarea } from '@ionic/react';
import { closeOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function NotesModal({
  isOpen,
  value,
  onSave,
  onCancel,
}: {
  isOpen: boolean;
  value?: string;
  onSave: (nextNotes: string | undefined) => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState(value ?? '');

  useEffect(() => {
    if (isOpen) setNotes(value ?? '');
  }, [isOpen, value]);

  const handleSave = () => {
    onSave(normalizeOptionalText(notes));
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onCancel} className="notesModal">
      <IonContent className="notesModalContent">
        <div className="notesModalCard">
          <div className="notesModalTitleRow">
            <span className="notesModalTitle">Notes</span>
            <IonButton fill="clear" className="notesCloseButton" onClick={onCancel} aria-label="Close notes">
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </div>
          <div className="notesBox">
            <IonTextarea
              value={notes}
              onIonInput={(e) => setNotes(e.detail.value ?? '')}
              autoGrow
              placeholder={`Add a quick note\u2026`}
            />
          </div>
          <div className="notesModalActions">
            <IonButton color="medium" fill="solid" shape="round" onClick={onCancel}>
              Cancel
            </IonButton>
            <IonButton color="primary" fill="solid" shape="round" onClick={handleSave}>
              Save
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
}
