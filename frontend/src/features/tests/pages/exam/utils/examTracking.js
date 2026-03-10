export const createTrackingEventId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

export const getTrackingTabSessionId = ({ examId, tabSessionIdRef, tabSessionScopeRef }) => {
  if (typeof window === 'undefined') return '';

  const storageKey = `exam-tab-session:${examId}`;
  if (tabSessionScopeRef.current === storageKey && tabSessionIdRef.current) {
    return tabSessionIdRef.current;
  }

  tabSessionScopeRef.current = storageKey;
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) {
    tabSessionIdRef.current = existing;
    return existing;
  }

  const nextId = createTrackingEventId();
  window.sessionStorage.setItem(storageKey, nextId);
  tabSessionIdRef.current = nextId;
  return nextId;
};

export const buildTrackingPayload = ({
  examId,
  hwctx,
  resourceRefType,
  resourceRefId,
  tabSessionIdRef,
  tabSessionScopeRef,
  extra = {},
}) => ({
  hwctx: hwctx || undefined,
  resource_ref_type: resourceRefType,
  resource_ref_id: resourceRefId,
  event_id: createTrackingEventId(),
  tab_session_id: getTrackingTabSessionId({
    examId,
    tabSessionIdRef,
    tabSessionScopeRef,
  }),
  client_ts: new Date().toISOString(),
  ...extra,
});
