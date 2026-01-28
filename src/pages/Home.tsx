import {
  IonActionSheet,
  IonBadge,
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonFab,
  IonFabButton,
  IonGrid,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonPage,
  IonRow,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonToast,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import {
  addOutline,
  cloudUploadOutline,
  documentTextOutline,
  ellipsisVerticalOutline,
  musicalNotesOutline,
} from 'ionicons/icons';
import { type ChangeEventHandler, useEffect, useMemo, useRef, useState } from 'react';
import { RequestEditorModal, type RequestEditorDraft } from '../components/RequestEditorModal';
import { RequestCard, type RequestCardActionHandlers } from '../components/RequestCard';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useThemeMode } from '../hooks/useThemeMode';
import {
  downloadBlob,
  exportRequestsToJson,
  exportRequestsToXlsx,
  importRequestsFromJson,
  importRequestsFromXlsx,
} from '../lib/importExport';
import { loadRequests, saveRequests } from '../lib/requestsStorage';
import type { MusicRequest } from '../models/Request';
import './Home.css';

function toMonthKey(isoDate: string) {
  return isoDate.slice(0, 7);
}

function nowIsoString() {
  return new Date().toISOString();
}

function formatMonthLabel(monthKey: string) {
  const [y, m] = monthKey.split('-');
  if (!y || !m) return monthKey;
  const dt = new Date(`${y}-${m}-01T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return monthKey;
  const month = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(dt);
  return `${month} ${y}`;
}

function normalizeDupeKey(text: string) {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function requestDupeKey(request: Pick<MusicRequest, 'studentName' | 'songTitle' | 'artist'>) {
  return `${normalizeDupeKey(request.studentName)}|${normalizeDupeKey(request.songTitle)}|${normalizeDupeKey(
    request.artist,
  )}`;
}

const Home: React.FC = () => {
  const { isDark, toggle: toggleTheme } = useThemeMode();
  const isDesktop = useMediaQuery('(min-width: 960px)');

  const today = new Date().toISOString().slice(0, 10);
  const defaultFilter = `month:${toMonthKey(today)}`;

  const [filterValue, setFilterValue] = useState<string>(defaultFilter);
  const [activeView, setActiveView] = useState<'pending' | 'delivered'>('pending');

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [requests, setRequests] = useState<MusicRequest[]>(() => loadRequests());

  useEffect(() => {
    saveRequests(requests);
  }, [requests]);

  const undoRef = useRef<null | (() => void)>(null);
  const [toast, setToast] = useState<{ isOpen: boolean; message: string; showUndo: boolean }>({
    isOpen: false,
    message: '',
    showUndo: false,
  });

  const showToast = (message: string) => setToast({ isOpen: true, message, showUndo: false });
  const showUndoToast = (message: string, undo: () => void) => {
    undoRef.current = undo;
    setToast({ isOpen: true, message, showUndo: true });
  };

  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  const filteredRequests = useMemo(() => {
    if (filterValue === 'all') return requests;

    const [kind, value] = filterValue.split(':');
    if (kind === 'year' && value) return requests.filter((r) => r.dateRequested.startsWith(value));
    if (kind === 'month' && value) return requests.filter((r) => r.dateRequested.startsWith(value));
    return requests;
  }, [requests, filterValue]);

  const pending = useMemo(
    () => filteredRequests.filter((r) => !r.delivered).sort((a, b) => a.dateRequested.localeCompare(b.dateRequested)),
    [filteredRequests],
  );
  const delivered = useMemo(
    () => filteredRequests.filter((r) => r.delivered).sort((a, b) => a.dateRequested.localeCompare(b.dateRequested)),
    [filteredRequests],
  );

  const totalAwaitingReimbursement = useMemo(
    () =>
      filteredRequests.reduce((sum, r) => {
        if (r.reimbursed) return sum;
        if (r.cost === undefined || Number.isNaN(r.cost)) return sum;
        return sum + r.cost;
      }, 0),
    [filteredRequests],
  );

  const filterOptions = useMemo(() => {
    const monthKeys = Array.from(new Set(requests.map((r) => toMonthKey(r.dateRequested)))).sort().reverse();
    const currentYear = today.slice(0, 4);

    return [
      { value: defaultFilter, label: `This month (${formatMonthLabel(today.slice(0, 7))})` },
      { value: `year:${currentYear}`, label: `This year (${currentYear})` },
      { value: 'all', label: 'All time' },
      ...monthKeys
        .filter((m) => `month:${m}` !== defaultFilter)
        .map((m) => ({ value: `month:${m}`, label: formatMonthLabel(m) })),
    ];
  }, [requests, today, defaultFilter]);

  const editingRequest = useMemo(
    () => (editingId ? requests.find((r) => r.id === editingId) : undefined),
    [requests, editingId],
  );

  const handlers = useMemo<RequestCardActionHandlers>(
    () => ({
      onToggleDelivered: (id) => {
        setRequests((prev) => {
          const target = prev.find((r) => r.id === id);
          if (!target) return prev;

          const nextDelivered = !target.delivered;
          showUndoToast(nextDelivered ? 'Marked delivered' : 'Marked pending', () =>
            setRequests((cur) =>
              cur.map((r) => (r.id === id ? { ...r, delivered: target.delivered, updatedAt: nowIsoString() } : r)),
            ),
          );

          return prev.map((r) => (r.id === id ? { ...r, delivered: nextDelivered, updatedAt: nowIsoString() } : r));
        });
      },
      onToggleReimbursed: (id) => {
        setRequests((prev) => {
          const target = prev.find((r) => r.id === id);
          if (!target) return prev;

          const nextReimbursed = !target.reimbursed;
          showUndoToast(nextReimbursed ? 'Marked reimbursed' : 'Marked unreimbursed', () =>
            setRequests((cur) =>
              cur.map((r) =>
                r.id === id ? { ...r, reimbursed: target.reimbursed, updatedAt: nowIsoString() } : r,
              ),
            ),
          );

          return prev.map((r) =>
            r.id === id ? { ...r, reimbursed: nextReimbursed, updatedAt: nowIsoString() } : r,
          );
        });
      },
      onEdit: (id) => {
        setEditingId(id);
        setIsEditorOpen(true);
      },
      onDelete: (id) => {
        setRequests((prev) => {
          const index = prev.findIndex((r) => r.id === id);
          if (index < 0) return prev;
          const removed = prev[index];

          showUndoToast('Request deleted', () =>
            setRequests((cur) => {
              if (cur.some((r) => r.id === removed.id)) return cur;
              const copy = [...cur];
              copy.splice(index, 0, removed);
              return copy;
            }),
          );

          return prev.filter((r) => r.id !== id);
        });
      },
      onEditNotes: (id) => {
        setEditingId(id);
        setIsEditorOpen(true);
      },
    }),
    [],
  );

  const openNewRequest = () => {
    setEditingId(null);
    setIsEditorOpen(true);
  };

  const exportSortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      if (a.delivered !== b.delivered) return a.delivered ? 1 : -1;
      const date = a.dateRequested.localeCompare(b.dateRequested);
      if (date !== 0) return date;
      return a.studentName.localeCompare(b.studentName);
    });
  }, [requests]);

  const onClickExportExcel = () => {
    const fileDate = new Date().toISOString().slice(0, 10);
    const blob = exportRequestsToXlsx(exportSortedRequests);
    downloadBlob(`music-requests-${fileDate}.xlsx`, blob);
  };

  const onClickExportJson = () => {
    const fileDate = new Date().toISOString().slice(0, 10);
    const blob = exportRequestsToJson(exportSortedRequests);
    downloadBlob(`music-requests-${fileDate}.json`, blob);
  };

  const onClickImport = () => importFileInputRef.current?.click();

  const onImportFileSelected: ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        const text = await file.text();
        const { requests: next, summary } = importRequestsFromJson(text, requests);
        setRequests(next);
        showToast(
          `Imported ${summary.added} • Skipped ${summary.skippedDuplicates} dupes • Skipped ${summary.skippedInvalid} invalid`,
        );
        return;
      }

      const buffer = await file.arrayBuffer();
      const { requests: next, summary } = importRequestsFromXlsx(buffer, requests);
      setRequests(next);
      showToast(
        `Imported ${summary.added} • Skipped ${summary.skippedDuplicates} dupes • Skipped ${summary.skippedInvalid} invalid`,
      );
    } catch {
      showToast('Import failed. Please try a valid .xlsx or .json file.');
    }
  };

  const onSaveDraft = (draft: RequestEditorDraft) => {
    setRequests((prev) => {
      const now = nowIsoString();

      if (editingId) {
        const dupe = prev.some((r) => r.id !== editingId && requestDupeKey(r) === requestDupeKey(draft));
        if (dupe) {
          showToast('Skipped: duplicate request (same Student + Song + Artist)');
          return prev;
        }

        setIsEditorOpen(false);
        return prev.map((r) => (r.id === editingId ? { ...r, ...draft, updatedAt: now } : r));
      }

      const dupe = prev.some((r) => requestDupeKey(r) === requestDupeKey(draft));
      if (dupe) {
        showToast('Skipped: duplicate request (same Student + Song + Artist)');
        return prev;
      }

      const next: MusicRequest = {
        id: crypto.randomUUID(),
        ...draft,
        delivered: false,
        reimbursed: false,
        createdAt: now,
        updatedAt: now,
      };
      setIsEditorOpen(false);
      return [next, ...prev];
    });
  };

  const renderEmptyState = (label: string) => (
    <div className="emptyState">
      <p className="emptyStateTitle">No {label} requests</p>
      <p className="emptyStateBody">Try a different filter, or add a new request.</p>
      <IonButton color="primary" shape="round" onClick={openNewRequest}>
        <IonIcon slot="start" icon={addOutline} />
        New Request
      </IonButton>
    </div>
  );

  return (
    <IonPage className="appPage">
      <IonHeader className="appHeader">
        <IonToolbar className="appToolbar">
          <div className="toolbarTitle">
            <IonIcon icon={musicalNotesOutline} className="toolbarIcon" />
            <IonTitle className="toolbarText">Music Request Tracker</IonTitle>
          </div>

          <IonButtons slot="end" className="toolbarButtons">
            <ThemeToggleButton isDark={isDark} onToggle={toggleTheme} />

            {isDesktop ? (
              <>
                <IonButton color="tertiary" shape="round" className="actionButton" onClick={onClickImport}>
                  <IonIcon slot="start" icon={cloudUploadOutline} />
                  <span className="actionButtonLabel">Import</span>
                </IonButton>
                <IonButton color="success" shape="round" className="actionButton" onClick={onClickExportExcel}>
                  <span className="actionButtonLabel">Excel</span>
                </IonButton>
                <IonButton color="secondary" shape="round" className="actionButton" onClick={onClickExportJson}>
                  <span className="actionButtonLabel">JSON</span>
                </IonButton>
                <IonButton color="primary" shape="round" className="actionButton" onClick={openNewRequest}>
                  <IonIcon slot="start" icon={addOutline} />
                  <span className="actionButtonLabel">New Request</span>
                </IonButton>
              </>
            ) : (
              <IonButton
                fill="clear"
                size="small"
                className="overflowButton"
                aria-label="Actions"
                onClick={() => setIsActionsOpen(true)}
              >
                <IonIcon slot="icon-only" icon={ellipsisVerticalOutline} />
              </IonButton>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="appContent">
        <input
          ref={importFileInputRef}
          className="hiddenFileInput"
          type="file"
          accept=".xlsx,.json,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={onImportFileSelected}
        />

        {!isDesktop ? (
          <IonFab vertical="bottom" horizontal="end" slot="fixed">
            <IonFabButton color="primary" onClick={openNewRequest} aria-label="New request">
              <IonIcon icon={addOutline} />
            </IonFabButton>
          </IonFab>
        ) : null}

        <div className="contentWrap">
          <div className="summaryCard">
            <div className="summaryRow">
              <div className="summaryItem">
                <IonIcon icon={musicalNotesOutline} />
                <span>
                  <strong>{pending.length}</strong> request{pending.length === 1 ? '' : 's'} waiting on delivery
                </span>
              </div>
              <div className="summaryItem">
                <IonIcon icon={documentTextOutline} />
                <span>
                  Total awaiting reimbursement:{' '}
                  <strong>
                    {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
                      totalAwaitingReimbursement,
                    )}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="controlsRow">
            <IonItem lines="none" className="filterItem">
              <IonLabel>Filter</IonLabel>
              <IonSelect
                value={filterValue}
                interface="popover"
                onIonChange={(e) => setFilterValue((e.detail.value as string) ?? defaultFilter)}
              >
                {filterOptions.map((opt) => (
                  <IonSelectOption key={opt.value} value={opt.value}>
                    {opt.label}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </div>

          {!isDesktop ? (
            <div className="mobileToggleRow">
              <IonSegment
                value={activeView}
                onIonChange={(e) => {
                  const next = e.detail.value as 'pending' | 'delivered' | undefined;
                  if (next) setActiveView(next);
                }}
              >
              <IonSegmentButton value="pending">
                  <IonLabel>
                    Pending <IonBadge color="primary">{pending.length}</IonBadge>
                  </IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="delivered">
                  <IonLabel>
                    Delivered <IonBadge color="success">{delivered.length}</IonBadge>
                  </IonLabel>
                </IonSegmentButton>
              </IonSegment>
            </div>
          ) : null}

          {isDesktop ? (
            <IonGrid className="listsGrid">
              <IonRow>
                <IonCol size="12" sizeLg="6">
                  <h2 className="listTitle">
                    Pending <span className="muted">({pending.length})</span>
                  </h2>
                  <div className="listStack">
                    {pending.length === 0
                      ? renderEmptyState('pending')
                      : pending.map((r) => <RequestCard key={r.id} request={r} handlers={handlers} />)}
                  </div>
                </IonCol>

                <IonCol size="12" sizeLg="6">
                  <h2 className="listTitle">
                    Delivered <span className="muted">({delivered.length})</span>
                  </h2>
                  <div className="listStack">
                    {delivered.length === 0
                      ? renderEmptyState('delivered')
                      : delivered.map((r) => <RequestCard key={r.id} request={r} handlers={handlers} />)}
                  </div>
                </IonCol>
              </IonRow>
            </IonGrid>
          ) : (
            <div className="listStack">
              {(activeView === 'pending' ? pending : delivered).length === 0
                ? renderEmptyState(activeView)
                : (activeView === 'pending' ? pending : delivered).map((r) => (
                    <RequestCard key={r.id} request={r} handlers={handlers} />
                  ))}
            </div>
          )}
        </div>
      </IonContent>

      <RequestEditorModal
        isOpen={isEditorOpen}
        title={editingRequest ? 'Edit Request' : 'Add New Request'}
        initialDraft={editingRequest}
        onCancel={() => setIsEditorOpen(false)}
        onSave={onSaveDraft}
      />

      <IonActionSheet
        isOpen={isActionsOpen}
        onDidDismiss={() => setIsActionsOpen(false)}
        header="Actions"
        buttons={[
          {
            text: 'Import (Excel or JSON)',
            icon: cloudUploadOutline,
            handler: () => onClickImport(),
          },
          {
            text: 'Export Excel (.xlsx)',
            handler: () => onClickExportExcel(),
          },
          {
            text: 'Export JSON',
            handler: () => onClickExportJson(),
          },
          { text: 'Cancel', role: 'cancel' },
        ]}
      />

      <IonToast
        isOpen={toast.isOpen}
        message={toast.message}
        duration={toast.showUndo ? 6000 : 2500}
        position="bottom"
        buttons={
          toast.showUndo
            ? [
                {
                  text: 'Undo',
                  handler: () => undoRef.current?.(),
                },
              ]
            : undefined
        }
        onDidDismiss={() => {
          undoRef.current = null;
          setToast((t) => ({ ...t, isOpen: false }));
        }}
      />
    </IonPage>
  );
};

export default Home;
