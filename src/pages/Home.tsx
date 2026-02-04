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
  IonSpinner,
  IonText,
  IonToast,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import {
  addOutline,
  archiveOutline,
  cloudUploadOutline,
  documentTextOutline,
  ellipsisVerticalOutline,
  logOutOutline,
  musicalNotesOutline,
} from 'ionicons/icons';
import { type ChangeEventHandler, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RequestEditorModal, type RequestEditorDraft } from '../components/RequestEditorModal';
import { RequestCard, type RequestCardActionHandlers } from '../components/RequestCard';
import { NotesModal } from '../components/NotesModal';
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
import { generateId } from '../lib/id';
import { AuthPage } from './Auth';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { supabase } from '../lib/supabaseClient';
import { deleteRequest, fetchRequests, upsertRequest, upsertRequests } from '../lib/requestsRepository';
import type { ISODate, MusicRequest } from '../models/Request';
import './Home.css';

function nowIsoString() {
  return new Date().toISOString();
}

function todayIsoDate(): ISODate {
  return new Date().toISOString().slice(0, 10) as ISODate;
}

function formatMonthName(monthValue: string) {
  const monthNum = Number(monthValue);
  if (!Number.isFinite(monthNum)) return monthValue;
  const dt = new Date(Date.UTC(2020, monthNum - 1, 1));
  if (Number.isNaN(dt.getTime())) return monthValue;
  return new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(dt);
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
  const { isConfigured, isLoading, user } = useSupabaseAuth();

  if (!isConfigured) return <AuthPage />;

  if (isLoading) {
    return (
      <IonPage className="appPage">
        <IonContent fullscreen className="appContent">
          <div className="contentWrap" style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
            <div style={{ textAlign: 'center' }}>
              <IonSpinner />
              <div style={{ marginTop: 12 }}>
                <IonText color="medium">Loading…</IonText>
              </div>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!user) return <AuthPage />;

  return <AuthedHome userId={user.id} />;
};

const AuthedHome: React.FC<{ userId: string }> = ({ userId }) => {
  const { isDark, toggle: toggleTheme } = useThemeMode();
  const isDesktop = useMediaQuery('(min-width: 960px)');

  const today = todayIsoDate();
  const currentYear = today.slice(0, 4);
  const currentMonth = today.slice(5, 7);

  const [filterYear, setFilterYear] = useState<string>(currentYear);
  const [filterMonth, setFilterMonth] = useState<string>(currentMonth);
  const [showArchived, setShowArchived] = useState(false);
  const [activeView, setActiveView] = useState<'pending' | 'delivered' | 'archived'>('pending');

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [notesId, setNotesId] = useState<string | null>(null);

  const [requests, setRequests] = useState<MusicRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingRequests(true);

    fetchRequests(userId)
      .then((rows) => {
        if (cancelled) return;
        setRequests(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setToast({ isOpen: true, message: 'Failed to load requests.', showUndo: false });
        setRequests([]);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingRequests(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const undoRef = useRef<null | (() => void)>(null);
  const [toast, setToast] = useState<{ isOpen: boolean; message: string; showUndo: boolean }>({
    isOpen: false,
    message: '',
    showUndo: false,
  });

  const showToast = useCallback((message: string) => setToast({ isOpen: true, message, showUndo: false }), []);
  const showUndoToast = useCallback((message: string, undo: () => void) => {
    undoRef.current = undo;
    setToast({ isOpen: true, message, showUndo: true });
  }, []);

  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  const filteredRequests = useMemo(() => {
    if (filterYear === 'all') return requests;
    if (filterMonth === 'all') return requests.filter((r) => r.dateRequested.startsWith(filterYear));
    return requests.filter((r) => r.dateRequested.startsWith(`${filterYear}-${filterMonth}`));
  }, [requests, filterYear, filterMonth]);

  const pending = useMemo(
    () =>
      filteredRequests.filter((r) => !r.delivered).sort((a, b) => {
        const date = b.dateRequested.localeCompare(a.dateRequested);
        if (date !== 0) return date;
        return a.studentName.localeCompare(b.studentName);
      }),
    [filteredRequests],
  );
  const delivered = useMemo(
    () =>
      filteredRequests
        .filter((r) => r.delivered && !r.reimbursed)
        .sort((a, b) => {
          const date = b.dateRequested.localeCompare(a.dateRequested);
          if (date !== 0) return date;
          return a.studentName.localeCompare(b.studentName);
        }),
    [filteredRequests],
  );
  const archived = useMemo(
    () =>
      filteredRequests
        .filter((r) => r.delivered && r.reimbursed)
        .sort((a, b) => {
          const archivedDate = (b.archivedDate ?? b.dateRequested).localeCompare(a.archivedDate ?? a.dateRequested);
          if (archivedDate !== 0) return archivedDate;
          const requestedDate = b.dateRequested.localeCompare(a.dateRequested);
          if (requestedDate !== 0) return requestedDate;
          return a.studentName.localeCompare(b.studentName);
        }),
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

  const yearOptions = useMemo(() => {
    const years = Array.from(new Set(requests.map((r) => r.dateRequested.slice(0, 4))));
    if (!years.includes(currentYear)) years.push(currentYear);
    years.sort().reverse();
    return [{ value: 'all', label: 'All time' }, ...years.map((y) => ({ value: y, label: y }))];
  }, [requests, currentYear]);

  const monthOptions = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    return [
      { value: 'all', label: 'All months' },
      ...months.map((m) => ({ value: m, label: formatMonthName(m) })),
    ];
  }, []);

  const editingRequest = useMemo(
    () => (editingId ? requests.find((r) => r.id === editingId) : undefined),
    [requests, editingId],
  );

  const notesRequest = useMemo(
    () => (notesId ? requests.find((r) => r.id === notesId) : undefined),
    [requests, notesId],
  );

  const syncUpsert = useCallback(async (request: MusicRequest) => {
    try {
      await upsertRequest(userId, request);
    } catch {
      showToast('Sync failed. Please refresh and try again.');
    }
  }, [userId, showToast]);

  const syncUpsertMany = useCallback(async (next: MusicRequest[]) => {
    try {
      await upsertRequests(userId, next);
    } catch {
      showToast('Sync failed. Please refresh and try again.');
    }
  }, [userId, showToast]);

  const syncDelete = useCallback(async (id: string) => {
    try {
      await deleteRequest(userId, id);
    } catch {
      showToast('Delete failed. Please refresh and try again.');
    }
  }, [userId, showToast]);

  const handlers = useMemo<RequestCardActionHandlers>(
    () => ({
      onToggleDelivered: (id) => {
        let nextRequest: MusicRequest | null = null;

        setRequests((prev) => {
          const target = prev.find((r) => r.id === id);
          if (!target) return prev;
          if (target.onlyDeliverableIfReimbursed && !target.reimbursed && !target.delivered) {
            showToast('Reimburse first before marking delivered.');
            return prev;
          }

          const now = nowIsoString();
          const nextDelivered = !target.delivered;
          const nextIsArchived = nextDelivered && target.reimbursed;
          const leavingArchive = target.delivered && target.reimbursed && !nextIsArchived;
          const archivedDate = nextIsArchived ? todayIsoDate() : leavingArchive ? undefined : target.archivedDate;

          nextRequest = { ...target, delivered: nextDelivered, archivedDate, updatedAt: now };

          showUndoToast(nextDelivered ? 'Marked delivered' : 'Marked pending', () => {
            const undoNow = nowIsoString();
            const restored = { ...target, delivered: target.delivered, archivedDate: target.archivedDate, updatedAt: undoNow };
            setRequests((cur) => cur.map((r) => (r.id === id ? restored : r)));
            void syncUpsert(restored);
          });

          return prev.map((r) =>
            r.id === id ? { ...r, delivered: nextDelivered, archivedDate, updatedAt: nowIsoString() } : r,
          );
        });

        if (nextRequest) void syncUpsert(nextRequest);
      },
      onToggleReimbursed: (id) => {
        let nextRequest: MusicRequest | null = null;

        setRequests((prev) => {
          const target = prev.find((r) => r.id === id);
          if (!target) return prev;

          const now = nowIsoString();
          const nextReimbursed = !target.reimbursed;
          const forcePending = Boolean(target.onlyDeliverableIfReimbursed && target.delivered && !nextReimbursed);
          const nextDelivered = forcePending ? false : target.delivered;
          const nextIsArchived = nextDelivered && nextReimbursed;
          const leavingArchive = target.delivered && target.reimbursed && !nextIsArchived;
          const archivedDate = nextIsArchived ? todayIsoDate() : leavingArchive ? undefined : target.archivedDate;

          nextRequest = {
            ...target,
            reimbursed: nextReimbursed,
            delivered: nextDelivered,
            archivedDate,
            updatedAt: now,
          };
          showUndoToast(
            forcePending ? 'Marked unreimbursed and pending' : nextReimbursed ? 'Marked reimbursed' : 'Marked unreimbursed',
            () => {
              const undoNow = nowIsoString();
              const restored = {
                ...target,
                reimbursed: target.reimbursed,
                delivered: target.delivered,
                archivedDate: target.archivedDate,
                updatedAt: undoNow,
              };
              setRequests((cur) => cur.map((r) => (r.id === id ? restored : r)));
              void syncUpsert(restored);
            },
          );

          return prev.map((r) =>
            r.id === id
              ? { ...r, reimbursed: nextReimbursed, delivered: nextDelivered, archivedDate, updatedAt: nowIsoString() }
              : r,
          );
        });

        if (nextRequest) void syncUpsert(nextRequest);
      },
      onEdit: (id) => {
        setEditingId(id);
        setIsEditorOpen(true);
      },
      onDelete: (id) => {
        let removed: MusicRequest | null = null;
        let removedIndex = -1;
        setRequests((prev) => {
          const index = prev.findIndex((r) => r.id === id);
          if (index < 0) return prev;
          removed = prev[index];
          removedIndex = index;

          return prev.filter((r) => r.id !== id);
        });

        void syncDelete(id);
        const removedRequest = removed;
        const removedAtIndex = removedIndex;
        if (removedRequest && removedAtIndex >= 0) {
          const restored = { ...(removedRequest as MusicRequest), updatedAt: nowIsoString() };
          showUndoToast('Request deleted', () => {
            setRequests((cur) => {
              if (cur.some((r) => r.id === restored.id)) return cur;
              const copy = [...cur];
              copy.splice(removedAtIndex, 0, restored);
              return copy;
            });
            void syncUpsert(restored);
          });
        }
      },
      onEditNotes: (id) => {
        setNotesId(id);
        setIsNotesOpen(true);
      },
    }),
    [showToast, showUndoToast, syncDelete, syncUpsert],
  );

  const openNewRequest = () => {
    setEditingId(null);
    setIsEditorOpen(true);
  };

  const exportSortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      const aRank = a.delivered && a.reimbursed ? 2 : a.delivered ? 1 : 0;
      const bRank = b.delivered && b.reimbursed ? 2 : b.delivered ? 1 : 0;
      if (aRank !== bRank) return aRank - bRank;

      if (aRank === 2) {
        const archivedDate = (b.archivedDate ?? b.dateRequested).localeCompare(a.archivedDate ?? a.dateRequested);
        if (archivedDate !== 0) return archivedDate;
      }

      const requestedDate = b.dateRequested.localeCompare(a.dateRequested);
      if (requestedDate !== 0) return requestedDate;
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

  const onClickSignOut = async () => {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch {
      showToast('Sign out failed. Please try again.');
    }
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
        void syncUpsertMany(next);
        showToast(
          `Imported ${summary.added} \u2022 Skipped ${summary.skippedDuplicates} dupes \u2022 Skipped ${summary.skippedInvalid} invalid`,
        );
        return;
      }

      const buffer = await file.arrayBuffer();
      const { requests: next, summary } = importRequestsFromXlsx(buffer, requests);
      setRequests(next);
      void syncUpsertMany(next);
      showToast(
        `Imported ${summary.added} \u2022 Skipped ${summary.skippedDuplicates} dupes \u2022 Skipped ${summary.skippedInvalid} invalid`,
      );
    } catch {
      showToast('Import failed. Please try a valid .xlsx or .json file.');
    }
  };

  const onSaveDraft = (draft: RequestEditorDraft) => {
    let toSync: MusicRequest | null = null;
    setRequests((prev) => {
      const now = nowIsoString();

      if (editingId) {
        const dupe = prev.some((r) => r.id !== editingId && requestDupeKey(r) === requestDupeKey(draft));
        if (dupe) {
          showToast('Skipped: duplicate request (same Student + Song + Artist)');
          return prev;
        }

        setIsEditorOpen(false);
        return prev.map((r) => {
          if (r.id !== editingId) return r;
          const next = { ...r, ...draft, updatedAt: now };
          toSync = next;
          return next;
        });
      }

      const dupe = prev.some((r) => requestDupeKey(r) === requestDupeKey(draft));
      if (dupe) {
        showToast('Skipped: duplicate request (same Student + Song + Artist)');
        return prev;
      }

      const next: MusicRequest = {
        id: generateId(),
        ...draft,
        delivered: false,
        reimbursed: false,
        onlyDeliverableIfReimbursed: draft.onlyDeliverableIfReimbursed ?? false,
        createdAt: now,
        updatedAt: now,
      };
      toSync = next;
      setIsEditorOpen(false);
      return [next, ...prev];
    });

    if (toSync) void syncUpsert(toSync);
  };

  const renderEmptyState = (label: string, withButton = true, bodyText?: string) => (
    <div className="emptyState">
      <p className="emptyStateTitle">No {label} requests</p>
      <p className="emptyStateBody">{bodyText ?? 'Try a different filter, or add a new request.'}</p>
      {withButton ? (
        <IonButton color="primary" shape="round" onClick={openNewRequest}>
          <IonIcon slot="start" icon={addOutline} />
          New Request
        </IonButton>
      ) : null}
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
                <IonButton
                  color="success"
                  shape="round"
                  className="actionButton"
                  onClick={onClickExportExcel}
                  disabled={isLoadingRequests}
                >
                  <span className="actionButtonLabel">Excel</span>
                </IonButton>
                <IonButton
                  color="secondary"
                  shape="round"
                  className="actionButton"
                  onClick={onClickExportJson}
                  disabled={isLoadingRequests}
                >
                  <span className="actionButtonLabel">JSON</span>
                </IonButton>
                <IonButton fill="clear" size="small" className="overflowButton" onClick={onClickSignOut}>
                  <IonIcon slot="icon-only" icon={logOutOutline} />
                </IonButton>
                <IonButton
                  color="primary"
                  shape="round"
                  className="actionButton"
                  onClick={openNewRequest}
                  disabled={isLoadingRequests}
                >
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
            <IonFabButton color="primary" onClick={openNewRequest} aria-label="New request" disabled={isLoadingRequests}>
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
              <div className="filterControls">
                <IonSelect
                  value={filterYear}
                  interface="popover"
                  onIonChange={(e) => {
                    const next = String(e.detail.value);
                    setFilterYear(next);
                    if (next === 'all') setFilterMonth('all');
                  }}
                >
                  {yearOptions.map((opt) => (
                    <IonSelectOption key={opt.value} value={opt.value}>
                      {opt.label}
                    </IonSelectOption>
                  ))}
                </IonSelect>
                <IonSelect
                  value={filterMonth}
                  interface="popover"
                  disabled={filterYear === 'all'}
                  onIonChange={(e) => setFilterMonth(String(e.detail.value))}
                >
                  {monthOptions.map((opt) => (
                    <IonSelectOption key={opt.value} value={opt.value}>
                      {opt.label}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </div>
            </IonItem>
          </div>

          <div className="archivedToggleRow">
            <IonButton
              fill="outline"
              size="small"
              onClick={() => {
                setShowArchived((prev) => {
                  const next = !prev;
                  if (!prev && next) setActiveView('archived');
                  if (prev && !next) setActiveView((cur) => (cur === 'archived' ? 'pending' : cur));
                  return next;
                });
              }}
            >
              <IonIcon slot="start" icon={archiveOutline} />
              {showArchived ? 'Hide Archived' : 'Show Archived'} <IonBadge color="medium">{archived.length}</IonBadge>
            </IonButton>
          </div>

          {!isDesktop ? (
            <div className="mobileToggleRow">
              <IonSegment
                value={activeView}
                onIonChange={(e) => {
                  const next = e.detail.value as 'pending' | 'delivered' | 'archived' | undefined;
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
                {showArchived ? (
                  <IonSegmentButton value="archived">
                    <IonLabel>
                      Archived <IonBadge color="medium">{archived.length}</IonBadge>
                    </IonLabel>
                  </IonSegmentButton>
                ) : null}
              </IonSegment>
            </div>
          ) : null}

          {isDesktop ? (
            <IonGrid className="listsGrid">
              <IonRow>
                <IonCol size="12" sizeLg={showArchived ? '4' : '6'}>
                  <h2 className="listTitle">
                    Pending <span className="muted">({pending.length})</span>
                  </h2>
                  <div className="listStack">
                    {pending.length === 0
                      ? renderEmptyState('pending')
                      : pending.map((r) => <RequestCard key={r.id} request={r} handlers={handlers} />)}
                    {pending.length > 0 ? (
                      <div className="emptyState newRequestCard">
                        <IonButton color="primary" shape="round" onClick={openNewRequest}>
                          <IonIcon slot="start" icon={addOutline} />
                          New Request
                        </IonButton>
                      </div>
                    ) : null}
                  </div>
                </IonCol>

                <IonCol size="12" sizeLg={showArchived ? '4' : '6'}>
                  <h2 className="listTitle">
                    Delivered <span className="muted">({delivered.length})</span>
                  </h2>
                  <div className="listStack">
                    {delivered.length === 0
                      ? renderEmptyState('delivered', false, 'Try a different filter, or deliver a pending request.')
                      : delivered.map((r) => <RequestCard key={r.id} request={r} handlers={handlers} />)}
                  </div>
                </IonCol>

                {showArchived ? (
                  <IonCol size="12" sizeLg="4">
                    <h2 className="listTitle">
                      Archived <span className="muted">({archived.length})</span>
                    </h2>
                    <div className="listStack">
                      {archived.length === 0
                        ? renderEmptyState('archived', false, 'Archived requests (delivered + reimbursed) show up here.')
                        : archived.map((r) => <RequestCard key={r.id} request={r} handlers={handlers} />)}
                    </div>
                  </IonCol>
                ) : null}
              </IonRow>
            </IonGrid>
          ) : (
            <div className="listStack">
              {(activeView === 'pending' ? pending : activeView === 'delivered' ? delivered : archived).length === 0
                ? renderEmptyState(
                    activeView,
                    activeView !== 'archived',
                    activeView === 'archived' ? 'Archived requests (delivered + reimbursed) show up here.' : undefined,
                  )
                : (activeView === 'pending' ? pending : activeView === 'delivered' ? delivered : archived).map((r) => (
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

      <NotesModal
        isOpen={isNotesOpen}
        value={notesRequest?.notes}
        onSave={(nextNotes) => {
          if (!notesId) return;
          let updated: MusicRequest | null = null;
          setRequests((prev) =>
            prev.map((r) => {
              if (r.id !== notesId) return r;
              updated = { ...r, notes: nextNotes, updatedAt: nowIsoString() };
              return updated;
            }),
          );
          if (updated) void syncUpsert(updated);
          setIsNotesOpen(false);
        }}
        onCancel={() => setIsNotesOpen(false)}
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
          {
            text: 'Sign out',
            icon: logOutOutline,
            handler: () => onClickSignOut(),
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
