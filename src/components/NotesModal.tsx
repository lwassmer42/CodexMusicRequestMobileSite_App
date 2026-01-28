import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
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
      <IonHeader className="appHeader notesModalHeader">
        <IonToolbar className="appToolbar notesModalToolbar">
          <IonTitle>Notes</IonTitle>
          <IonButtons slot="end">
            <IonButton fill="clear" className="notesCloseButton" onClick={onCancel} aria-label="Close notes">
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="notesModalContent">
        <div className="notesBox">
          <IonTextarea
            value={notes}
            onIonInput={(e) => setNotes(e.detail.value ?? '')}
            autoGrow
            placeholder="Add a quick note…"
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
      </IonContent>
    </IonModal>
  );
}
