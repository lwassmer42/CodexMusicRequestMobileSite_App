import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonIcon,
  IonText,
} from '@ionic/react';
import {
  cashOutline,
  chatbubbleEllipsesOutline,
  checkmarkCircleOutline,
  linkOutline,
  pencilOutline,
  receiptOutline,
  trashOutline,
} from 'ionicons/icons';
import type { MusicRequest } from '../models/Request';

export type RequestCardActionHandlers = {
  onToggleDelivered: (id: string) => void;
  onToggleReimbursed: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onEditNotes: (id: string) => void;
};

function formatMoney(amount?: number) {
  if (amount === undefined || Number.isNaN(amount)) return undefined;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount);
}

export function RequestCard({
  request,
  handlers,
}: {
  request: MusicRequest;
  handlers: RequestCardActionHandlers;
}) {
  const money = formatMoney(request.cost);
  const deliverBlocked = Boolean(
    request.onlyDeliverableIfReimbursed && !request.reimbursed && !request.delivered,
  );

  return (
    <IonCard className={`requestCard ${request.delivered ? 'isDelivered' : 'isPending'}`}>
      <IonCardHeader className="requestCardHeader">
        <div className="requestCardHeaderRow">
          <div className="requestCardTitles">
            <IonCardTitle>{request.studentName}</IonCardTitle>
            <IonCardSubtitle>
              {request.songTitle} <span className="muted">{'\u2022'}</span> {request.artist}
            </IonCardSubtitle>
            <IonText color="medium" className="requestCardMeta">
              Requested: {request.dateRequested}
              {request.dueDate ? <span className="muted"> {'\u2022'} </span> : null}
              {request.dueDate ? <>Due: {request.dueDate}</> : null}
              {request.delivered && request.reimbursed ? <span className="muted"> {'\u2022'} </span> : null}
              {request.delivered && request.reimbursed ? (
                <>Archived: {request.archivedDate ?? request.dateRequested}</>
              ) : null}
            </IonText>
          </div>

          <div className="requestCardHeaderActions">
            {request.onlyDeliverableIfReimbursed ? (
              <span
                className={`ruleBadge ${request.reimbursed ? 'ruleBadge--ok' : 'ruleBadge--blocked'}`}
                aria-label="Only deliverable if reimbursed"
                title="Only deliverable if reimbursed"
              >
                <IonIcon icon={cashOutline} />
              </span>
            ) : null}
            <IonButton
              fill="clear"
              size="small"
              aria-label="Edit request"
              onClick={() => handlers.onEdit(request.id)}
            >
              <IonIcon slot="icon-only" icon={pencilOutline} />
            </IonButton>
            <IonButton
              fill="clear"
              size="small"
              color="danger"
              aria-label="Delete request"
              onClick={() => handlers.onDelete(request.id)}
            >
              <IonIcon slot="icon-only" icon={trashOutline} />
            </IonButton>
          </div>
        </div>
      </IonCardHeader>

      <IonCardContent className="requestCardContent">
        <div className="requestCardBadges">
          {request.delivered ? (
            <IonChip color="success">
              <IonIcon icon={checkmarkCircleOutline} />
              <span>Delivered</span>
            </IonChip>
          ) : null}
          {request.reimbursed ? (
            <IonChip color="secondary">
              <IonIcon icon={receiptOutline} />
              <span>Reimbursed</span>
            </IonChip>
          ) : null}
          {request.scoreLink ? (
            <IonChip color="tertiary" className="chipLink">
              <IonIcon icon={linkOutline} />
              <a href={request.scoreLink} target="_blank" rel="noreferrer">
                Score Link
              </a>
            </IonChip>
          ) : null}
        </div>

        {money ? (
          <IonText className="requestCardCost">
            <IonIcon icon={cashOutline} /> Cost: {money}
          </IonText>
        ) : null}

        <div className="requestCardButtons">
          <IonButton
            fill="solid"
            size="small"
            color={deliverBlocked ? 'medium' : request.delivered ? 'medium' : 'success'}
            disabled={deliverBlocked}
            onClick={() => handlers.onToggleDelivered(request.id)}
          >
            {request.delivered ? 'Mark Pending' : 'Mark Delivered'}
          </IonButton>

          <IonButton
            fill="solid"
            size="small"
            color={request.reimbursed ? 'medium' : 'secondary'}
            onClick={() => handlers.onToggleReimbursed(request.id)}
          >
            {request.reimbursed ? 'Unreimburse' : 'Mark Reimbursed'}
          </IonButton>

          <IonButton
            fill="clear"
            size="small"
            className="notesButton"
            onClick={() => handlers.onEditNotes(request.id)}
          >
            <IonIcon slot="start" icon={chatbubbleEllipsesOutline} />
            Notes
          </IonButton>
        </div>
      </IonCardContent>
    </IonCard>
  );
}
