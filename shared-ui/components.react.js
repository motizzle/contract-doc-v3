// React entry (UMD) for shared UI. Safe to include even if React is missing.
// Exposes window.mountReactApp({ rootSelector }) for progressive migration.

(function (global) {
  const win = typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this);

  function getApiBase() {
    try {
      const src = Array.from(document.scripts).map(s => s.src).find(u => typeof u === 'string' && /(^|\/)components\.react\.js(\?|$)/.test(u));
      if (src) return new URL(src).origin;
    } catch {}
    try { return location.origin; } catch {}
    return 'https://localhost:4001';
  }

  function mountReactApp(opts) {
    const options = opts || {};
    const selector = options.rootSelector || '#app-root';
    const rootEl = document.querySelector(selector);
    if (!rootEl) { try { console.warn('[react-entry] root not found', selector); } catch (_) {} return; }
    if (!win.React || !win.ReactDOM || !win.ReactDOM.createRoot || win.React.__placeholder || win.ReactDOM.__placeholder) {
      try { console.warn('[react-entry] React/ReactDOM not available; did you preload /vendor/react/*?'); } catch (_) {}
      return; // Graceful no-op
    }

    const React = win.React;
    const ReactDOM = win.ReactDOM;
    const MIN_DOCX_SIZE = 8192; // bytes; reject tiny/invalid working overlays

    const ThemeContext = React.createContext({ tokens: null });
  const StateContext = React.createContext(null);

    function ThemeProvider(props) {
      const [tokens, setTokens] = React.useState(null);
      React.useEffect(() => {
        const API_BASE = getApiBase();
        (async () => {
          try { const r = await fetch(`${API_BASE}/api/v1/theme`); if (r.ok) setTokens(await r.json()); } catch {}
        })();
      }, []);
      return React.createElement(ThemeContext.Provider, { value: { tokens } }, props.children);
    }

    // Reusable button with pressed and loading states
    function UIButton(props) {
      const { label, onClick, variant = 'primary', disabled = false, isLoading = false, uniform = false, style = {} } = props || {};
      const [pressed, setPressed] = React.useState(false);
      const [loading, setLoading] = React.useState(false);
      const busy = !!isLoading || loading;
      const className = `btn btn--${variant}${uniform ? ' btn-uniform' : ''}`;
      // Standardize spacing: no external margins; parents control spacing via gap
      const visual = Object.assign({ margin: '0', opacity: disabled ? 0.6 : 1 }, style);
      const handleClick = async (e) => {
        if (disabled || busy) return;
        try {
          const ret = onClick?.(e);
          if (ret && typeof ret.then === 'function') {
            setLoading(true);
            try { await ret; } finally { setLoading(false); }
          }
        } catch {}
      };
      const text = busy ? (typeof props.loadingLabel === 'string' ? props.loadingLabel : `${label}…`) : label;
      return React.createElement('button', { className, onClick: handleClick, disabled: disabled || busy, style: visual }, React.createElement('span', null, text));
    }

    function StateProvider(props) {
      const [config, setConfig] = React.useState(null);
      const [revision, setRevision] = React.useState(0);
      const [loadedVersion, setLoadedVersion] = React.useState(1);
      const [dismissedVersion, setDismissedVersion] = React.useState(0);
      const [viewingVersion, setViewingVersion] = React.useState(1);
      const [isConnected, setIsConnected] = React.useState(false);
      const [lastTs, setLastTs] = React.useState(0);
      const [userId, setUserId] = React.useState('user1');
      const [role, setRole] = React.useState('editor');
      const [users, setUsers] = React.useState([]);
      const [logs, setLogs] = React.useState([]);
      const [lastSeenLogCount, setLastSeenLogCount] = React.useState(0);
      const [documentSource, setDocumentSource] = React.useState(null);
      const [lastError, setLastError] = React.useState(null);
      const [approvalsSummary, setApprovalsSummary] = React.useState(null);
      const [approvalsRevision, setApprovalsRevision] = React.useState(0);
      const API_BASE = getApiBase();

      React.useEffect(() => {
        console.log('StateProvider config changed to:', config);
      }, [config]);

      // Notification formatting system
      const NOTIFICATION_TYPES = {
        success: { icon: '✅', color: '#10b981', bgColor: '#d1fae5', borderColor: '#34d399' },
        error: { icon: '❌', color: '#ef4444', bgColor: '#fee2e2', borderColor: '#f87171' },
        warning: { icon: '⚠️', color: '#f59e0b', bgColor: '#fef3c7', borderColor: '#fbbf24' },
        info: { icon: 'ℹ️', color: '#3b82f6', bgColor: '#dbeafe', borderColor: '#60a5fa' },
        system: { icon: '🔧', color: '#6b7280', bgColor: '#f9fafb', borderColor: '#d1d5db' },
        user: { icon: '👤', color: '#8b5cf6', bgColor: '#ede9fe', borderColor: '#a78bfa' },
        document: { icon: '📄', color: '#059669', bgColor: '#d1fae5', borderColor: '#34d399' },
        network: { icon: '🌐', color: '#0891b2', bgColor: '#cffafe', borderColor: '#06b6d4' }
      };

      const formatNotification = React.useCallback((message, type = 'info') => {
        const ts = new Date().toLocaleTimeString();
        const notificationType = NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.info;

        return {
          id: Date.now() + Math.random(),
          timestamp: ts,
          message: typeof message === 'string' ? message : String(message),
          type: type,
          formatted: true,
          style: notificationType
        };
      }, []);

      const addLog = React.useCallback((m, type = 'info') => {
        try {
          if (typeof m === 'string' && !m.includes('[Formatted]')) {
            // Legacy plain text message - wrap in formatted structure
            const formatted = formatNotification(m, type);
            setLogs((prev) => prev.concat(formatted));
          } else if (typeof m === 'object' && m.formatted) {
            // Already formatted notification object
            setLogs((prev) => prev.concat(m));
          } else {
            // Plain text fallback
          const ts = new Date().toLocaleTimeString();
          setLogs((prev) => prev.concat(`[${ts}] ${m}`));
          }
        } catch {}
      }, [formatNotification]);

      const markNotificationsSeen = React.useCallback(() => {
        try { setLastSeenLogCount((logs || []).length); } catch {}
      }, [logs]);

      // Render formatted notification
      const renderNotification = React.useCallback((log, index) => {
        if (typeof log === 'string') {
          // Legacy plain text notification
          return React.createElement('div', {
            key: index,
            className: 'notification-item notification-legacy'
          }, log);
        } else if (log.formatted) {
          // Formatted notification object
          const { message, timestamp, type, style } = log;
          const dynamicStyle = {
            border: `1px solid ${style.borderColor}`,
            backgroundColor: style.bgColor,
            color: style.color
          };
          return React.createElement('div', {
            key: log.id || index,
            className: 'notification-item notification-formatted',
            style: dynamicStyle
          }, [
            React.createElement('span', {
              key: 'icon',
              className: 'notification-icon'
            }, style.icon),
            React.createElement('div', {
              key: 'content',
              className: 'notification-content'
            }, [
              React.createElement('div', {
                key: 'message',
                className: 'notification-message'
              }, message),
              React.createElement('div', {
                key: 'timestamp',
                className: 'notification-timestamp'
              }, timestamp)
            ])
          ]);
        }
        return null;
      }, []);

      // Prefer working default if present, else canonical. Append a revision hint.
      const choosePreferredDocUrl = React.useCallback(async (revHint) => {
        try {
          const working = `${API_BASE}/documents/working/default.docx`;
          const canonical = `${API_BASE}/documents/canonical/default.docx`;
          let url = canonical;
          try {
            const h = await fetch(working, { method: 'HEAD' });
            if (h.ok) {
              const len = Number(h.headers.get('content-length') || '0');
              if (Number.isFinite(len) && len > MIN_DOCX_SIZE) url = working;
            }
          } catch {}
          const rev = (typeof revHint === 'number' && revHint > 0) ? revHint : Date.now();
          return `${url}?rev=${rev}`;
        } catch (e) {
            addLog(`Failed to load document: ${e?.message||e}`, 'error');
          return `${API_BASE}/documents/canonical/default.docx?rev=${Date.now()}`;
        }
      }, [API_BASE, addLog]);

      const refresh = React.useCallback(async () => {
        const plat = (typeof Office !== 'undefined') ? 'word' : 'web';
        const qs = `platform=${encodeURIComponent(plat)}&userId=${encodeURIComponent(userId)}&clientVersion=${encodeURIComponent(loadedVersion||0)}`;
        try {
          const r = await fetch(`${API_BASE}/api/v1/state-matrix?${qs}`);
            if (r.ok) {
              const j = await r.json();
            console.log('Fetched config:', j.config);
            try { console.log('Buttons:', j?.config?.buttons, 'Checkout:', j?.config?.checkoutStatus); } catch {}
            console.log('Setting config to:', j.config);
              setConfig(j.config || null);
              if (typeof j.revision === 'number') setRevision(j.revision);
              try { const sum = j?.config?.approvals?.summary || null; setApprovalsSummary(sum); } catch {}
            }
        } catch {}
      }, [API_BASE, userId, loadedVersion]);

      React.useEffect(() => {
        // Load users for selector (role comes from users.json)
        (async () => {
          try {
            const r = await fetch(`${API_BASE}/api/v1/users`);
            if (r.ok) {
              const j = await r.json();
              const items = Array.isArray(j.items) ? j.items : [];
              setUsers(items);
              if (items.length) {
                const me = items.find(u => (u.id || u.label) === userId) || items[0];
                setUserId(me.id || me.label);
                setRole(me.role || 'editor');
              }
            }
          } catch {}
        })();
        refresh();
        let sse;
        try {
          sse = new EventSource(`${API_BASE}/api/v1/events`);
          sse.onopen = () => { setIsConnected(true); addLog('Connected to server', 'network'); };
          sse.onmessage = (ev) => {
            try {
              const p = JSON.parse(ev.data);
              if (p && p.ts) setLastTs(p.ts);
              const nextRev = (typeof p.revision === 'number') ? p.revision : null;
              if (nextRev !== null) setRevision(nextRev);
              if (p && p.type === 'approvals:update') {
                if (typeof p.revision === 'number') setApprovalsRevision(p.revision);
                if (p.summary) setApprovalsSummary(p.summary);
                // Only log approvals updates that have user-relevant notices
                if (p.notice) {
                  const noticeType = p.notice.type;
                  if (noticeType === 'reset') {
                    addLog('Approvals have been reset', 'warning');
                  } else if (noticeType === 'request_review') {
                    addLog('Review requested for approvals', 'info');
                  }
                }
              }
              // Only log user-relevant events as notifications
              if (p && p.type) {
                switch (p.type) {
                  case 'documentUpload':
                    addLog(`Document "${p.name}" uploaded successfully`, 'document');
                    break;
                  case 'documentRevert':
                    addLog('Document reverted to previous version', 'warning');
                    break;
                  case 'snapshot':
                    addLog(`Snapshot "${p.name}" created`, 'success');
                    break;
                  case 'factoryReset':
                    addLog('System factory reset completed', 'warning');
                    break;
                  case 'exhibitUpload':
                    addLog(`Exhibit "${p.name}" uploaded`, 'document');
                    break;
                  case 'compile':
                    addLog(`Document compiled as "${p.name}"`, 'success');
                    break;
                  case 'finalize':
                    addLog(p.value ? 'Document finalized' : 'Document unfinalized', 'system');
                    break;
                  case 'checkout':
                    addLog('Document checked out', 'info');
                    break;
                  case 'checkin':
                    addLog('Document checked in', 'success');
                    break;
                  case 'checkoutCancel':
                    addLog('Checkout cancelled', 'warning');
                    break;
                  case 'overrideCheckout':
                    addLog('Checkout override performed', 'warning');
                    break;
                  // Skip logging: hello, saveProgress, chat events, sendVendor, and plain approvals:update
                }
              }
              // IMPORTANT: do not auto-refresh documentSource on SSE. User must click View Latest or reload.
              // Exception: after a Factory Reset, reload the canonical default document so the UI returns to baseline.
              if (p && p.type === 'factoryReset') {
                try {
                  const canonical = `${API_BASE}/documents/canonical/default.docx?rev=${Date.now()}`;
                  if (typeof Office !== 'undefined') {
                    (async () => {
                      try {
                        const res = await fetch(canonical, { cache: 'no-store' });
                        if (res && res.ok) {
                          const buf = await res.arrayBuffer();
                          const b64 = (function(buf){ let bin=''; const bytes=new Uint8Array(buf); for(let i=0;i<bytes.byteLength;i++) bin+=String.fromCharCode(bytes[i]); return btoa(bin); })(buf);
                          await Word.run(async (context) => { context.document.body.insertFileFromBase64(b64, Word.InsertLocation.replace); await context.sync(); });
                        }
                      } catch {}
                    })();
                  } else {
                    setDocumentSource(canonical);
                  }
                } catch {}
                try { window.dispatchEvent(new CustomEvent('factoryReset', { detail: p })); } catch {}
              }
              if (p && p.type === 'versions:update') { try { window.dispatchEvent(new CustomEvent('versions:update', { detail: p })); } catch {} }
              if (p && p.type === 'version:view') { try { window.dispatchEvent(new CustomEvent('version:view', { detail: p })); } catch {} }
              // Fan out chat messages to ChatConsole
              if (p && p.type === 'chat') {
                try { window.dispatchEvent(new CustomEvent('chat:message', { detail: p })); } catch {}
              }
              if (p && p.type === 'chat:delta') {
                try { window.dispatchEvent(new CustomEvent('chat:delta', { detail: p })); } catch {}
              }
              if (p && p.type === 'chat:complete') {
                try { window.dispatchEvent(new CustomEvent('chat:complete', { detail: p })); } catch {}
              }
              if (p && p.type === 'chat:reset') {
                try { window.dispatchEvent(new CustomEvent('chat:reset', { detail: p })); } catch {}
                // Clear AI chat local storage when reset is global or for this user
                try {
                  const all = !!(p.payload && p.payload.all);
                  if (all) {
                    try { localStorage.removeItem(`ogassist.messages.${String(currentUser || 'default')}`); } catch {}
                    try { localStorage.removeItem(`ogassist.seeded.${String(currentUser || 'default')}`); } catch {}
                  }
                } catch {}
              }
              // Fan out lightweight user messaging events
              if (p && p.type === 'approvals:message') {
                try { window.dispatchEvent(new CustomEvent('messaging:message', { detail: p })); } catch {}
              }
              // Bridge messaging reset to React app
              if (p && p.type === 'messaging:reset') {
                try { window.dispatchEvent(new CustomEvent('messaging:reset', { detail: p })); } catch {}
              }
              // Do not auto-refresh document on save/revert; show banner via state-matrix
              refresh();
            } catch {}
          };
          sse.onerror = () => { setIsConnected(false); addLog('Lost connection to server', 'error'); };
        } catch {}
        return () => { try { sse && sse.close(); } catch {} };
      }, [API_BASE, refresh, addLog]);

      const addError = React.useCallback((err) => {
        try { setLastError(err || null); if (err && err.message) addLog(`Error: ${err.message}`, 'error'); } catch {}
      }, [addLog]);

      // Sync viewingVersion to the current document version after saves/check-ins
      React.useEffect(() => {
        try {
          const v = Number(config?.documentVersion || 1);
          if (Number.isFinite(v) && v > 0) setViewingVersion(v);
        } catch {}
      }, [config?.documentVersion]);

      // Compute initial document source on web (prefer working overlay)
      React.useEffect(() => {
        if (typeof Office !== 'undefined') return; // Word path handles separately
        (async () => {
          try {
            const src = await choosePreferredDocUrl(Date.now());
            setDocumentSource(src);
            addLog(`Document source updated`, 'document');
            // Initialize version from first matrix load
            try {
              const r = await fetch(`${API_BASE}/api/v1/state-matrix?platform=web&userId=${encodeURIComponent(userId)}`);
              if (r.ok) {
                const j = await r.json();
                const v = Number(j?.config?.documentVersion || 1);
                setLoadedVersion(Number.isFinite(v) && v > 0 ? v : 1);
              }
            } catch {}
          } catch (e) { addError({ kind: 'doc_init', message: 'Failed to choose initial document', cause: String(e) }); }
        })();
      }, [API_BASE, addLog, addError, choosePreferredDocUrl]);

      // Do NOT auto-update document on revision changes. The banner/CTA controls refresh.

      // Refresh the document ONLY when the user changes (explicit action)
      const didInitUserRef = React.useRef(false);
      React.useEffect(() => {
        // Skip on initial mount; we already set initial document (web) or leave as-is (Word)
        if (!didInitUserRef.current) { didInitUserRef.current = true; return; }
        (async () => {
          try {
            const w = `${API_BASE}/documents/working/default.docx`;
            const c = `${API_BASE}/documents/canonical/default.docx`;
            let url = c;
            try {
              const h = await fetch(w, { method: 'HEAD' });
              if (h.ok) {
                const len = Number(h.headers.get('content-length') || '0');
                if (Number.isFinite(len) && len > MIN_DOCX_SIZE) url = w;
              }
            } catch {}
            const withRev = `${url}?rev=${Date.now()}`;
            if (typeof Office !== 'undefined') {
              const res = await fetch(withRev, { cache: 'no-store' }); if (!res.ok) throw new Error('download');
              const buf = await res.arrayBuffer();
              const b64 = (function(buf){ let bin=''; const bytes=new Uint8Array(buf); for(let i=0;i<bytes.byteLength;i++) bin+=String.fromCharCode(bytes[i]); return btoa(bin); })(buf);
              await Word.run(async (context) => { context.document.body.insertFileFromBase64(b64, Word.InsertLocation.replace); await context.sync(); });
            } else {
              setDocumentSource(withRev);
              addLog(`doc src userSwitch -> ${withRev}`, 'document');
            }
          } catch {}
        })();
      }, [userId]);

      async function exportWordDocumentAsBase64() {
        function u8ToB64(u8) { let bin=''; for (let i=0;i<u8.length;i++) bin+=String.fromCharCode(u8[i]); return btoa(bin); }
        function normalizeSliceToB64(data) {
          if (typeof data === 'string') return data;
          if (data && data.byteLength !== undefined) {
            const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
            return u8ToB64(u8);
          }
          if (Array.isArray(data) && data.length) {
            if (typeof data[0] === 'string') return data.join('');
            if (typeof data[0] === 'number') return u8ToB64(new Uint8Array(data));
            if (Array.isArray(data[0]) || (data[0] && data[0].byteLength !== undefined)) {
              // Flatten one level
              let total = 0; for (const part of data) total += (part?.length ?? (part?.byteLength ?? 0));
              const out = new Uint8Array(total);
              let off = 0;
              for (const part of data) {
                if (!part) continue;
                const u8 = part instanceof Uint8Array ? part : (part.byteLength !== undefined ? new Uint8Array(part) : new Uint8Array(part));
                out.set(u8, off); off += u8.length;
              }
              return u8ToB64(out);
            }
          }
          return '';
        }
        return new Promise((resolve, reject) => {
          try {
            if (typeof Office === 'undefined') return reject('no_office');
            Office.context.document.getFileAsync(Office.FileType.Compressed, { sliceSize: 65536 }, (result) => {
              if (result.status !== Office.AsyncResultStatus.Succeeded) return reject('getFile_failed');
              const file = result.value;
              const sliceCount = file.sliceCount;
              let acc = '';
              let index = 0;
              const readNext = () => {
                file.getSliceAsync(index, (res) => {
                  if (res.status !== Office.AsyncResultStatus.Succeeded) { try { file.closeAsync(); } catch {}; return reject('getSlice_failed'); }
                  const part = res.value && res.value.data;
                  acc += normalizeSliceToB64(part);
                  index++;
                  if (index < sliceCount) return readNext();
                  try { file.closeAsync(); } catch {}
                  resolve(acc);
                });
              };
              readNext();
            });
          } catch (e) { reject(e); }
        });
      }

      async function saveProgressWord() {
        const b64 = await exportWordDocumentAsBase64();
        if (!b64 || b64.length < 1024) throw new Error(`word_export_small ${b64 ? b64.length : 0}`);
        const r = await fetch(`${API_BASE}/api/v1/save-progress`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, base64: b64, platform: 'word' }) });
        if (!r.ok) {
          let msg = '';
          try { const j = await r.json(); msg = j && (j.error || j.message) || ''; } catch { try { msg = await r.text(); } catch {} }
          throw new Error(`save-progress ${r.status} ${msg}`.trim());
        }
      }

      async function saveProgressWebViaDownload() {
        // Web must export from live editor; no fallback to server bytes
        if (!(window.superdocAPI && typeof window.superdocAPI.export === 'function')) {
          addLog('Document export not available', 'warning');
          throw new Error('export_unavailable');
        }
        const b64 = await window.superdocAPI.export('docx');
        const size = (() => { try { return atob(b64 || '').length; } catch { return 0; } })();
        const pk = (() => { try { const u = new Uint8Array(atob(b64||'').split('').map(c=>c.charCodeAt(0))); return u[0]===0x50 && u[1]===0x4b; } catch { return false; } })();
        addLog(`Document exported (${Math.round(size/1024)}KB)`, 'document');
        if (!b64 || size < 1024 || !pk) {
          addLog('Document export failed - invalid format', 'error');
          throw new Error('export_invalid');
        }
        const r = await fetch(`${API_BASE}/api/v1/save-progress`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, base64: b64, platform: 'web' }) });
        if (!r.ok) {
          let msg = '';
          try { const j = await r.json(); msg = j && (j.error || j.message) || ''; } catch { try { msg = await r.text(); } catch {} }
          addLog(`Failed to save progress: ${msg || 'Server error'}`, 'error');
          throw new Error(`save-progress ${r.status} ${msg}`.trim());
        }
        addLog('Progress saved successfully', 'success');
      }

      const actions = React.useMemo(() => ({
        finalize: async () => { try { await fetch(`${API_BASE}/api/v1/finalize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); addLog('Document finalized successfully', 'success'); await refresh(); } catch (e) { addLog(`Failed to finalize document: ${e?.message||e}`, 'error'); } },
        unfinalize: async () => { try { await fetch(`${API_BASE}/api/v1/unfinalize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); addLog('Document unfinalized successfully', 'success'); await refresh(); } catch (e) { addLog(`Failed to unfinalize document: ${e?.message||e}`, 'error'); } },
        checkout: async () => { try { await fetch(`${API_BASE}/api/v1/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); addLog('Document checked out successfully', 'success'); await refresh(); } catch (e) { addLog(`Failed to check out document: ${e?.message||e}`, 'error'); } },
        checkin: async () => { try { await fetch(`${API_BASE}/api/v1/checkin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); addLog('Document checked in successfully', 'success'); await refresh(); } catch (e) { addLog(`Failed to check in document: ${e?.message||e}`, 'error'); } },
        cancel: async () => { try { await fetch(`${API_BASE}/api/v1/checkout/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); addLog('Checkout cancelled successfully', 'success'); await refresh(); } catch (e) { addLog(`Failed to cancel checkout: ${e?.message||e}`, 'error'); } },
        override: async () => { try { await fetch(`${API_BASE}/api/v1/checkout/override`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); addLog('Checkout override successful', 'warning'); await refresh(); } catch (e) { addLog(`Failed to override checkout: ${e?.message||e}`, 'error'); } },
        factoryReset: async () => { try { await fetch(`${API_BASE}/api/v1/factory-reset`, { method: 'POST' }); addLog('System reset completed successfully', 'system'); try { window.dispatchEvent(new CustomEvent('versions:update')); } catch {} await refresh(); } catch (e) { addLog(`Failed to reset system: ${e?.message||e}`, 'error'); } },
        sendVendor: (opts) => { try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'send-vendor', options: { userId, ...(opts||{}) } } })); } catch {} },
        saveProgress: async () => { try { if (typeof Office !== 'undefined') { await saveProgressWord(); } else { await saveProgressWebViaDownload(); } addLog('Progress saved successfully', 'success'); await refresh(); return true; } catch (e) { addLog(`Failed to save progress: ${e?.message||e}`, 'error'); return false; } },
        setUser: (nextUserId, nextRole) => {
          try {
            const plat = (typeof Office !== 'undefined') ? 'word' : 'web';
            setUserId(nextUserId);
            if (nextRole) setRole(nextRole);
            addLog(`Switched to user: ${nextUserId}`, 'user');
            // Immediately fetch matrix for the new user so buttons (override) reflect correctly
            (async () => {
              try {
                const qs = `platform=${encodeURIComponent(plat)}&userId=${encodeURIComponent(nextUserId)}&clientVersion=${encodeURIComponent(loadedVersion||0)}`;
                const r = await fetch(`${API_BASE}/api/v1/state-matrix?${qs}`);
                if (r.ok) {
                  const j = await r.json();
                  try { console.log('[user switch] Buttons:', j?.config?.buttons, 'Checkout:', j?.config?.checkoutStatus); } catch {}
                  setConfig(j.config || null);
                  if (typeof j.revision === 'number') setRevision(j.revision);
                }
              } catch {}
            })();
          } catch {}
        },
      }), [API_BASE, refresh, userId, addLog]);

      return React.createElement(StateContext.Provider, { value: { config, revision, actions, isConnected, lastTs, currentUser: userId, currentRole: role, users, logs, addLog, lastSeenLogCount, markNotificationsSeen, documentSource, setDocumentSource, lastError, setLastError: addError, loadedVersion, setLoadedVersion, dismissedVersion, setDismissedVersion, approvalsSummary, approvalsRevision, renderNotification, formatNotification, viewingVersion, setViewingVersion } }, React.createElement(App, { config }));
    }

    function BannerStack(props) {
      const { tokens } = React.useContext(ThemeContext);
      const { config, loadedVersion, setLoadedVersion, dismissedVersion, setDismissedVersion, revision, addLog, setDocumentSource } = React.useContext(StateContext);
      const banners = Array.isArray(config?.banners) ? config.banners : [];
      const API_BASE = getApiBase();
      const show = (b) => {
        if (!b) return false;
        // Exclude update_available here; it is rendered in a custom location
        if (b.state === 'update_available') return false;
        return true;
      };
      const refreshNow = async () => {
        try {
          const w = `${API_BASE}/documents/working/default.docx`;
          const c = `${API_BASE}/documents/canonical/default.docx`;
          let url = c;
          try {
            const h = await fetch(w, { method: 'HEAD' });
            if (h.ok) {
              const len = Number(h.headers.get('content-length') || '0');
              if (Number.isFinite(len) && len > MIN_DOCX_SIZE) url = w;
            }
          } catch {}
          const withRev = `${url}?rev=${revision || Date.now()}`;
          if (typeof Office !== 'undefined') {
            const res = await fetch(withRev, { cache: 'no-store' }); if (!res.ok) throw new Error('download');
            const buf = await res.arrayBuffer();
            const b64 = (function(buf){ let bin=''; const bytes=new Uint8Array(buf); for(let i=0;i<bytes.byteLength;i++) bin+=String.fromCharCode(bytes[i]); return btoa(bin); })(buf);
            await Word.run(async (context) => { context.document.body.insertFileFromBase64(b64, Word.InsertLocation.replace); await context.sync(); });
          } else {
            setDocumentSource(withRev);
            addLog(`doc src refreshNow -> ${withRev}`);
          }
          const serverVersion = Number(config?.documentVersion || 0);
          if (Number.isFinite(serverVersion) && serverVersion > 0) setLoadedVersion(serverVersion);
        } catch {}
      };
      return React.createElement('div', { className: 'd-flex flex-column gap-6 items-center' },
        banners.filter(show).map((b, i) => {
          const t = (tokens && tokens.banner && b && b.state) ? tokens.banner[b.state] : null;
          const dynamicStyle = {
            background: (t && (t.pillBg || t.bg)) || '#eef2ff',
            color: (t && (t.pillFg || t.fg)) || '#1e3a8a',
            border: `1px solid ${(t && t.border) || ((t && (t.pillBg || t.bg)) || '#c7d2fe')}`
          };
          const text = (b && b.title && b.message) ? `${b.title}: ${b.message}` : (b?.title || '');
          return React.createElement('div', { key: `b-${i}`, className: 'banner-item', style: dynamicStyle }, text);
        })
      );
    }

    function ConnectionBadge() {
      const { isConnected, lastTs } = React.useContext(StateContext);
      const when = lastTs ? new Date(lastTs).toLocaleTimeString() : '—';
      return React.createElement('div', { className: 'connection-badge' }, isConnected ? `connected • last: ${when}` : 'disconnected');
    }

    function ActionButtons() {
      const { config, actions, revision, setDocumentSource, addLog, setLoadedVersion, users, currentUser } = React.useContext(StateContext);
      const [confirm, setConfirm] = React.useState(null);
      const { tokens } = React.useContext(ThemeContext);
      const rootRef = React.useRef(null);

      // Listen for open-new-document event from header button
      React.useEffect(() => {
        function handleOpenNew() {
          openNew();
        }
        window.addEventListener('open-new-document', handleOpenNew);
        return () => window.removeEventListener('open-new-document', handleOpenNew);
      }, []);
      const btns = (config && config.buttons) ? config.buttons : {};
      const ask = (title, message, onConfirm) => setConfirm({ title, message, onConfirm });
      const add = (label, onClick, show, variant, opts = {}) => show
        ? React.createElement(UIButton, Object.assign({ key: label, label, onClick, variant: variant || (label && /^(Check\-in|Save Progress|Cancel Checkout|Override Checkout)/i.test(label) ? 'secondary' : 'primary'), uniform: true }, opts))
        : null;

      // Document controls (moved here so spacing matches other actions)
      const API_BASE = getApiBase();
      const isWord = (typeof Office !== 'undefined');
      const openNew = async () => {
        if (isWord) {
          const input = document.createElement('input'); input.type = 'file'; input.accept = '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          input.onchange = async (e) => {
            const file = e.target.files && e.target.files[0]; if (!file) return;
            const buf = await file.arrayBuffer(); const b64 = (function(buf){ let bin=''; const bytes=new Uint8Array(buf); for(let i=0;i<bytes.byteLength;i++) bin+=String.fromCharCode(bytes[i]); return btoa(bin); })(buf);
            try { await Word.run(async (context) => { context.document.body.insertFileFromBase64(b64, Word.InsertLocation.replace); await context.sync(); }); } catch {}
          };
          input.click();
        } else {
          const input = document.createElement('input'); input.type = 'file'; input.accept = '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          input.onchange = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; try { setDocumentSource(f); addLog('doc src set [file]'); } catch {} };
          input.click();
        }
      };
      const viewLatest = async () => {
        const w = `${API_BASE}/documents/working/default.docx`;
        const c = `${API_BASE}/documents/canonical/default.docx`;
        if (isWord) {
          try {
            let url = c;
            try {
              const h = await fetch(w, { method: 'HEAD' });
              if (h.ok) {
                const len = Number(h.headers.get('content-length') || '0');
                if (Number.isFinite(len) && len > MIN_DOCX_SIZE) url = w;
              }
            } catch {}
            const withRev = `${url}?rev=${revision || Date.now()}`;
            const res = await fetch(withRev, { cache: 'no-store' }); if (!res.ok) throw new Error('download');
            const buf = await res.arrayBuffer();
            const b64 = (function(buf){ let bin=''; const bytes=new Uint8Array(buf); for(let i=0;i<bytes.byteLength;i++) bin+=String.fromCharCode(bytes[i]); return btoa(bin); })(buf);
            await Word.run(async (context) => { context.document.body.insertFileFromBase64(b64, Word.InsertLocation.replace); await context.sync(); });
            // Clear local client caches to avoid stale chats after reload actions
            try {
              const uid = String(currentUser || 'default');
              localStorage.removeItem(`og.messaging.${uid}`);
              localStorage.removeItem(`og.messaging.active.${uid}`);
              localStorage.removeItem(`og.messaging.view.${uid}`);
              localStorage.removeItem(`ogassist.messages.${uid}`);
              localStorage.removeItem(`ogassist.seeded.${uid}`);
              try { window.dispatchEvent(new CustomEvent('messaging:reset', { detail: { source: 'viewLatest' } })); } catch {}
              try { window.dispatchEvent(new CustomEvent('chat:reset', { detail: { payload: { all: true }, source: 'viewLatest' } })); } catch {}
            } catch {}
            try {
              const plat = 'word';
              const u = `${API_BASE}/api/v1/state-matrix?platform=${plat}&clientVersion=0&userId=${encodeURIComponent('user1')}`;
              const r = await fetch(u);
              const j = await r.json();
              const v = Number(j?.config?.documentVersion || 0);
              if (v > 0) setLoadedVersion(v);
            } catch {}
          } catch {}
        } else {
          try {
            let url = c;
            try {
              const h = await fetch(w, { method: 'HEAD' });
              if (h.ok) {
                const len = Number(h.headers.get('content-length') || '0');
                if (Number.isFinite(len) && len > MIN_DOCX_SIZE) url = w;
              }
            } catch {}
            const finalUrl = `${url}?rev=${revision || Date.now()}`;
            setDocumentSource(finalUrl);
            addLog(`doc src viewLatest -> ${finalUrl}`);
            // Clear local client caches after swapping document
            try {
              const uid = String(currentUser || 'default');
              localStorage.removeItem(`og.messaging.${uid}`);
              localStorage.removeItem(`og.messaging.active.${uid}`);
              localStorage.removeItem(`og.messaging.view.${uid}`);
              localStorage.removeItem(`ogassist.messages.${uid}`);
              localStorage.removeItem(`ogassist.seeded.${uid}`);
              try { window.dispatchEvent(new CustomEvent('messaging:reset', { detail: { source: 'viewLatest' } })); } catch {}
              try { window.dispatchEvent(new CustomEvent('chat:reset', { detail: { payload: { all: true }, source: 'viewLatest' } })); } catch {}
            } catch {}
            try {
              const plat = 'web';
              const u = `${API_BASE}/api/v1/state-matrix?platform=${plat}&clientVersion=0&userId=${encodeURIComponent('user1')}`;
              const r = await fetch(u);
              const j = await r.json();
              const v = Number(j?.config?.documentVersion || 0);
              if (v > 0) setLoadedVersion(v);
            } catch {}
          } catch {}
        }
      };

      // Menu state and plain text menu items (no UIButton dependency)
      const [menuOpen, setMenuOpen] = React.useState(false);
      const menuItem = (label, onClick, show, opts = {}) => {
        if (!show) return null;
        const className = 'ui-menu__item' + (opts.danger ? ' danger' : '');
        const handler = (e) => { try { e.stopPropagation?.(); } catch {} try { setMenuOpen(false); } catch {} try { setCheckinMenuOpen(false); } catch {} try { onClick?.(e); } catch {} };
        const onKey = (e) => { try { if (e && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handler(e); } } catch {} };
        return React.createElement('div', { key: label, role: 'menuitem', tabIndex: 0, className, onClick: handler, onKeyDown: onKey }, label);
      };
      const menuItemTwo = (opts) => {
        const { icon, title, subtitle, onClick, show, danger } = opts || {};
        if (!show) return null;
        const className = 'ui-menu__item ui-menu__item--two' + (danger ? ' danger' : '');
        const handler = (e) => { try { e.stopPropagation?.(); } catch {} try { setMenuOpen(false); } catch {} try { setCheckinMenuOpen(false); } catch {} try { onClick?.(e); } catch {} };
        const onKey = (e) => { try { if (e && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handler(e); } } catch {} };
        const iconEl = React.createElement('span', { className: 'ui-menu__icon', 'aria-hidden': true }, icon || '•');
        const titleEl = React.createElement('div', { className: 'ui-menu__title' }, title || '');
        const subEl = React.createElement('div', { className: 'ui-menu__subtitle' }, subtitle || '');
        const textEl = React.createElement('div', { className: 'ui-menu__text' }, [titleEl, subEl]);
        return React.createElement('div', { key: (title || Math.random()), role: 'menuitem', tabIndex: 0, className, onClick: handler, onKeyDown: onKey }, [iconEl, textEl]);
      };

      // Portal menu to escape overflow clipping
      function PortalMenu(props) {
        const { anchorRef, open, children, onClose, align, menuElRef } = props || {};
        const [pos, setPos] = React.useState(null);
        const menuRef = React.useRef(null);
        React.useLayoutEffect(() => {
          if (!open || !anchorRef || !anchorRef.current) return;
          try {
            const r = anchorRef.current.getBoundingClientRect();
            const coords = { top: r.bottom, left: (align === 'left' ? r.left : r.right), width: undefined };
            setPos(coords);
          } catch {}
        }, [open, anchorRef, align]);
        React.useEffect(() => {
          if (!open) return;
          const onKey = (e) => { try { if (e.key === 'Escape') onClose?.(); } catch {} };
          const onDocClick = (e) => {
            try {
              const a = anchorRef && anchorRef.current;
              const m = menuRef && menuRef.current;
              if (a && (a === e.target || a.contains(e.target))) return; // ignore clicks on anchor
              if (m && (m === e.target || m.contains(e.target))) return; // ignore clicks inside menu
              onClose?.();
            } catch {}
          };
          const onScroll = () => { try { onClose?.(); } catch {} };
          window.addEventListener('keydown', onKey);
          window.addEventListener('click', onDocClick, true);
          window.addEventListener('scroll', onScroll, true);
          window.addEventListener('resize', onScroll);
          return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('click', onDocClick, true);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
          };
        }, [open, anchorRef, onClose]);
        if (!open || !pos) return null;
        const style = {
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          transform: (align === 'left' ? 'translateX(0)' : 'translateX(-100%)'),
          zIndex: 10000
        };
        return ReactDOM.createPortal(React.createElement('div', { style, ref: (el) => { menuRef.current = el; try { if (menuElRef) menuElRef.current = el; } catch {} } }, children), document.body);
      }
      const nestedItems = [
        menuItem('View Latest', viewLatest, true),
        menuItem('Finalize', () => ask('Finalize?', 'This will lock the document.', actions.finalize), !!btns.finalizeBtn),
        menuItem('Send to Vendor', () => { try { setTimeout(() => { try { actions.sendVendor({}); } catch {} }, 130); } catch {} }, !!btns.sendVendorBtn),
        menuItem('Request review', () => { try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'request-review' } })); } catch {} }, true),
        menuItem('Compile', () => { try { setTimeout(() => { try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'compile' } })); } catch {} }, 130); } catch {} }, true),
        menuItem('Override Checkout', actions.override, !!btns.overrideBtn),
        menuItem('Factory Reset', () => ask('Factory reset?', 'This will clear working data.', actions.factoryReset), true, { danger: true }),
      ].filter(Boolean);

      // Compute special case: only checkout is available (plus menu)
      const onlyCheckout = !!btns.checkoutBtn && !btns.checkinBtn && !btns.cancelBtn && !btns.saveProgressBtn && !btns.overrideBtn;

      // Top: checkout cluster with menu immediately adjacent (default)
      const menuAnchorRef = React.useRef(null);
      const topCluster = [
        add('Checkout', actions.checkout, !!btns.checkoutBtn),
        React.createElement('div', { style: { position: 'relative' } }, [
          React.createElement('span', { key: 'anchor', ref: menuAnchorRef },
            add('⋮', () => setMenuOpen(!menuOpen), true, 'secondary', { style: { minWidth: '75px' } })
          ),
          React.createElement(PortalMenu, { key: 'menu', anchorRef: menuAnchorRef, open: !!(nestedItems.length && menuOpen), onClose: () => setMenuOpen(false), align: 'right' },
            React.createElement('div', { className: 'ui-menu', role: 'menu' }, nestedItems)
          )
        ]),
        add('Check-in and Save', async () => { try { const ok = await actions.saveProgress(); if (ok) { await actions.checkin(); } } catch {} }, !!btns.checkinBtn),
        add('Cancel Checkout', actions.cancel, !!btns.cancelBtn),
        add('Save Progress', actions.saveProgress, !!btns.saveProgressBtn),
        add('Override Checkout', actions.override, !!btns.overrideBtn),
      ].filter(Boolean);

      // Bottom: all other actions, with '...' for menu
      const bottomGrid = [
        add('Unfinalize', () => ask('Unlock?', 'This will unlock the document.', actions.unfinalize), !!btns.unfinalizeBtn),
      ].filter(Boolean);

      // Read server-provided primary layout mode
      const mode = (config && config.buttons && config.buttons.primaryLayout && config.buttons.primaryLayout.mode)
        || (onlyCheckout ? 'not_checked_out' : (btns.checkinBtn ? 'self' : 'not_checked_out'));
      const [checkinMenuOpen, setCheckinMenuOpen] = React.useState(false);
      const portalMenuRef = React.useRef(null);
      const checkinPortalMenuRef = React.useRef(null);
      // Close any open dropdowns when mode changes (e.g., after Checkout)
      React.useEffect(() => { try { setMenuOpen(false); setCheckinMenuOpen(false); } catch {} }, [mode]);

      // Close menus when clicking outside of ActionButtons or the portal menus (web and add-in)
      React.useEffect(() => {
        const onOutside = (e) => {
          try {
            if (!menuOpen && !checkinMenuOpen) return;
            const el = rootRef.current;
            const menuEl = portalMenuRef && portalMenuRef.current;
            const checkinEl = checkinPortalMenuRef && checkinPortalMenuRef.current;
            if (el && el.contains(e.target)) return; // click inside the toolbar area
            if (menuEl && menuEl.contains(e.target)) return; // click inside portal menu
            if (checkinEl && checkinEl.contains(e.target)) return; // click inside check-in portal menu
          } catch {}
          try { setMenuOpen(false); } catch {}
          try { setCheckinMenuOpen(false); } catch {}
        };
        document.addEventListener('click', onOutside, false);
        return () => { document.removeEventListener('click', onOutside, false); };
      }, [menuOpen, checkinMenuOpen]);

      // Allow ESC to close any open menus
      React.useEffect(() => {
        const onKey = (e) => {
          try { if (e && (e.key === 'Escape' || e.key === 'Esc')) { setMenuOpen(false); setCheckinMenuOpen(false); } } catch {}
        };
        document.addEventListener('keydown', onKey, true);
        return () => { document.removeEventListener('keydown', onKey, true); };
      }, []);

      const topLayout = (function(){
        if (mode === 'not_checked_out') {
          return React.createElement('div', { className: 'd-flex items-center gap-8' }, [
            add('Checkout', actions.checkout, !!btns.checkoutBtn, undefined, { style: { width: '90%' } }),
            React.createElement('div', { style: { position: 'relative', flex: '0 0 auto', marginLeft: 'auto' } }, [
              React.createElement('span', { key: 'anchor_nc', ref: menuAnchorRef },
                add('⋮', () => setMenuOpen(!menuOpen), true, 'secondary', { style: { minWidth: '75px' } })
              ),
              React.createElement(PortalMenu, { key: 'menu_nc', anchorRef: menuAnchorRef, open: !!(nestedItems.length && menuOpen), onClose: () => setMenuOpen(false), align: 'right', menuElRef: portalMenuRef },
                React.createElement('div', { className: 'ui-menu', role: 'menu' }, nestedItems)
              )
            ])
          ]);
        }
        if (mode === 'self') {
          return React.createElement('div', { className: 'd-flex items-center gap-8' }, [
            add('Save', actions.saveProgress, !!btns.saveProgressBtn, 'primary', { style: { flex: '1 1 0', width: '100%' } }),
            React.createElement('div', { style: { position: 'relative', flex: '1 1 0' } }, [
              React.createElement('span', { key: 'anchor_ci', ref: menuAnchorRef },
                add('Check-in ▾', () => setCheckinMenuOpen(!checkinMenuOpen), !!btns.checkinBtn, 'secondary', { style: { width: '100%' } })
              ),
              (checkinMenuOpen ? React.createElement(PortalMenu, { anchorRef: menuAnchorRef, open: true, onClose: () => setCheckinMenuOpen(false), align: 'right', menuElRef: checkinPortalMenuRef }, React.createElement('div', { className: 'ui-menu', role: 'menu' }, [
                menuItemTwo({
                  icon: '🗝️',
                  title: 'Save and Check In',
                  subtitle: 'Save your progress and check in the document.',
                  onClick: async () => { try { const ok = await actions.saveProgress(); if (ok) await actions.checkin(); } catch {} },
                  show: !!btns.checkinBtn
                }),
                menuItemTwo({
                  icon: '➤',
                  title: 'Cancel Checkout',
                  subtitle: 'Cancel changes and check in the document.',
                  onClick: async () => { try { await actions.cancel(); } catch {} },
                  show: !!btns.checkinBtn
                })
              ])) : null)
            ]),
            React.createElement('div', { style: { position: 'relative', marginLeft: 'auto' } }, [
              React.createElement('span', { key: 'anchor_r', ref: menuAnchorRef },
                add('⋮', () => setMenuOpen(!menuOpen), true, 'secondary', { style: { minWidth: '75px' } })
              ),
              React.createElement(PortalMenu, { key: 'menu_r', anchorRef: menuAnchorRef, open: !!(nestedItems.length && menuOpen), onClose: () => setMenuOpen(false), align: 'right', menuElRef: portalMenuRef },
                React.createElement('div', { className: 'ui-menu', role: 'menu' }, nestedItems)
              )
            ])
          ]);
        }
        // mode === 'other'
        return React.createElement('div', { className: 'd-flex items-center gap-8 flex-wrap' }, [
          (function(){
            try {
              const uid = (config && config.checkoutStatus && config.checkoutStatus.checkedOutUserId) || '';
              const match = (Array.isArray(users) ? users.find(u => (u && (u.id === uid || u.label === uid)) ) : null);
              const name = (match && (match.label || match.id)) || uid || 'someone';
              const when = (config && config.lastUpdated) ? new Date(config.lastUpdated).toLocaleDateString() : '';
              const text = `Checked out by ${name}${when ? (' on ' + when) : ''}`;
              return React.createElement('div', { className: 'text-sm text-gray-700' }, text);
            } catch { return React.createElement('div', { className: 'text-sm text-gray-700' }, 'Checked out by someone'); }
          })(),
          React.createElement('div', { style: { position: 'relative', marginLeft: 'auto' } }, [
            React.createElement('span', { key: 'anchor_o', ref: menuAnchorRef },
              add('⋮', () => setMenuOpen(!menuOpen), true, 'secondary', { style: { minWidth: '75px' } })
            ),
            React.createElement(PortalMenu, { key: 'menu_o', anchorRef: menuAnchorRef, open: !!(nestedItems.length && menuOpen), onClose: () => setMenuOpen(false), align: 'right', menuElRef: portalMenuRef },
              React.createElement('div', { className: 'ui-menu', role: 'menu' }, nestedItems)
            )
          ])
        ]);
      })();

      const showUpdateBanner = Array.isArray(config?.banners) && (config.banners || []).some(b => b && b.state === 'update_available');
      const updateBannerParts = (function(){
        try {
          const b = (config.banners || []).find(x => x && x.state === 'update_available');
          return {
            title: (b && b.title) || '',
            message: (b && b.message) || ''
          };
        } catch { return { title: '', message: '' }; }
      })();

      return React.createElement('div', { ref: rootRef, className: 'd-flex flex-column gap-6' },
        topLayout,
        (showUpdateBanner ? (
          React.createElement('div', { className: 'update-banner' },
            React.createElement('div', { style: { position: 'relative', width: '100%' } }, [
              React.createElement('div', { key: 'row', style: { display: 'grid', gridTemplateColumns: '24px 1fr auto', alignItems: 'center', columnGap: 12 } }, [
                // Icon
                React.createElement('div', { key: 'icon', style: { width: 24, height: 24, borderRadius: '50%', border: '2px solid currentColor', color: '#0E6F7F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 } }, 'i'),
                // Text (title + message)
                React.createElement('div', { key: 'text', style: { color: 'inherit', textAlign: 'left' } }, [
                  updateBannerParts.title ? React.createElement('div', { key: 't', style: { fontWeight: 700, color: '#0E6F7F' } }, updateBannerParts.title) : null,
                  updateBannerParts.message ? React.createElement('div', { key: 'm' }, updateBannerParts.message) : null,
                ]),
                // Tertiary button aligned with title baseline
                React.createElement('button', {
                  key: 'btn',
                  onClick: viewLatest,
                  title: 'View latest',
                  style: {
                    background: 'transparent', border: 'none', padding: 0, margin: 0,
                    color: 'inherit', cursor: 'pointer', font: 'inherit', textDecoration: 'underline', alignSelf: 'center', marginTop: 2
                  }
                }, 'View latest')
              ])
            ])
          )
        ) : null),
        React.createElement('div', { className: 'd-grid grid-cols-2 column-gap-8 row-gap-6 grid-auto-rows-minmax-27' }, bottomGrid),
        confirm ? React.createElement(ConfirmModal, { title: confirm.title, message: confirm.message, onConfirm: confirm.onConfirm, onClose: () => setConfirm(null) }) : null
      );
    }

    function ExhibitsList() {
      const API_BASE = getApiBase();
      const [items, setItems] = React.useState([]);
      const refresh = React.useCallback(async () => { try { const r = await fetch(`${API_BASE}/api/v1/exhibits`); if (r.ok) { const j = await r.json(); setItems(Array.isArray(j.items) ? j.items : []); } } catch {} }, [API_BASE]);
      React.useEffect(() => { refresh(); }, [refresh]);
      return React.createElement('div', null,
        React.createElement('div', { className: 'font-semibold mt-2' }, 'Exhibits'),
        items.length ? React.createElement('ul', null, items.map((it, i) => React.createElement('li', { key: i }, React.createElement('a', { href: it.url, target: '_blank' }, it.name)))) : React.createElement('div', null, '(none)')
      );
    }

    function ActivityPanel() {
      const { logs, renderNotification, markNotificationsSeen, lastSeenLogCount } = React.useContext(StateContext);
      React.useEffect(() => { try { markNotificationsSeen?.(); } catch {} }, [markNotificationsSeen]);
      const copy = async () => {
        try {
          const text = (logs || []).slice().reverse().map(log => {
            if (typeof log === 'string') return log;
            return `[${log.timestamp}] ${log.message}`;
          }).join('\n');
          if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(text);
        } catch {}
      };
      const footer = React.createElement('div', { className: 'd-flex items-center justify-end', style: { padding: '8px 0' } }, [
        React.createElement(UIButton, { key: 'copy', label: 'Copy', onClick: copy, variant: 'primary' })
      ]);
      const list = (logs || []).length
        ? React.createElement('div', { className: 'notifications-list' }, (logs || []).slice().reverse().map((log, index) => renderNotification(log, index)).filter(Boolean))
        : React.createElement('div', { className: 'text-gray-500', style: { padding: 8 } }, 'No activity yet.');
      return React.createElement('div', { className: 'd-flex flex-column gap-2' }, [list, footer]);
    }

    function MessagingPanel() {
      const API_BASE = getApiBase();
      const { currentUser, users } = React.useContext(StateContext);
      const [messages, setMessages] = React.useState([]);
      const [text, setText] = React.useState('');
      const [view, setView] = React.useState('list'); // 'list' | 'thread' | 'new'
      const [activePartnerId, setActivePartnerId] = React.useState('');
      const [activeGroupIds, setActiveGroupIds] = React.useState([]);
      const [newSelection, setNewSelection] = React.useState(() => new Set());
      const listRef = React.useRef(null);

      const storageKey = React.useCallback(() => `og.messaging.${String(currentUser || 'default')}`, [currentUser]);
      const activeKey = React.useCallback(() => `og.messaging.active.${String(currentUser || 'default')}`, [currentUser]);
      const viewKey = React.useCallback(() => `og.messaging.view.${String(currentUser || 'default')}`, [currentUser]);

      const userLabel = (uid) => {
        try { const u = (users || []).find(x => (x && (x.id === uid || x.label === uid))); return (u && (u.label || u.id)) || uid; } catch { return uid; }
      };
      const userLabelById = (uid) => {
        try { const u = (users || []).find(x => (x && x.id === uid)); return (u && (u.label || u.id)) || uid; } catch { return uid; }
      };
      const initialsOf = (label) => {
        try { const parts = String(label || '').trim().split(/\s+/).filter(Boolean); if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase(); if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase(); return ''; } catch { return ''; }
      };

      // Initialize blank on load and user change (no local persistence)
      React.useEffect(() => {
        try { setMessages([]); setActivePartnerId(''); setActiveGroupIds([]); setView('list'); } catch {}
      }, [currentUser]);
      // No-op effects to avoid localStorage persistence
      React.useEffect(() => {}, [messages]);
      React.useEffect(() => {}, [activePartnerId]);
      React.useEffect(() => {}, [view]);

      // Inbound messages
      React.useEffect(() => {
        const onMsg = (ev) => {
          try {
            const d = ev.detail || {};
            if (!d || !d.payload) return;
            const from = String(d.userId || '');
            const toRaw = d.payload?.to;
            const to = Array.isArray(toRaw) ? toRaw.map(String) : String(toRaw || '');
            const text = String(d.payload.text || '');
            const clientId = d.payload && d.payload.clientId ? String(d.payload.clientId) : '';
            const threadId = d.payload && d.payload.threadId ? String(d.payload.threadId) : '';
            if (!text) return;
            const involvesMe = Array.isArray(to) ? (to.includes(String(currentUser)) || from === String(currentUser)) : (from === String(currentUser) || to === String(currentUser));
            if (involvesMe) {
              // Skip if we already have this client-sent message
              if (clientId && Array.isArray(messages) && messages.some(m => m.clientId && String(m.clientId) === clientId)) return;
              setMessages(prev => prev.concat({ id: Date.now() + Math.random(), from, to, text, ts: Date.now(), clientId: clientId || undefined, threadId: threadId || undefined }));
            }
          } catch {}
        };
        const onReset = () => {
          try {
            setMessages([]);
            setActivePartnerId('');
            setActiveGroupIds([]);
            setText('');
          } catch {}
        };
        try { window.addEventListener('messaging:message', onMsg); } catch {}
        try { window.addEventListener('messaging:reset', onReset); } catch {}
        return () => {
          try { window.removeEventListener('messaging:message', onMsg); } catch {}
          try { window.removeEventListener('messaging:reset', onReset); } catch {}
        };
      }, [currentUser, messages, storageKey, activeKey, viewKey]);

      // Do not auto-select a partner on New Chat; user must choose explicitly

      // Scroll thread to bottom
      React.useEffect(() => {
        try { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; } catch {}
      }, [messages, activePartnerId, view]);

      const send = async () => {
        const trimmed = String(text || '').trim();
        const isGroup = Array.isArray(activeGroupIds) && activeGroupIds.length > 0 && !activePartnerId;
        if (!trimmed || (!activePartnerId && !isGroup)) return;
        setText('');
        const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const recipients = isGroup ? activeGroupIds.slice() : [String(activePartnerId)];
        const threadId = isGroup ? `group:${recipients.slice().sort().join(',')}` : `dm:${String(activePartnerId)}`;
        const mine = { id: Date.now() + Math.random(), from: String(currentUser), to: (isGroup ? recipients : String(activePartnerId)), text: trimmed, ts: Date.now(), clientId, threadId };
        setMessages(prev => prev.concat(mine));
        try {
          await fetch(`${API_BASE}/api/v1/events/client`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'approvals:message', payload: { to: recipients, text: trimmed, clientId, threadId }, userId: currentUser }) });
        } catch {}
      };

      // Derive conversations (partner -> last message)
      const convMap = (() => {
        const map = new Map();
        for (const m of messages) {
          const me = String(currentUser);
          const toArr = Array.isArray(m.to) ? m.to : [String(m.to || '')];
          if (m.from !== me && !toArr.includes(me)) continue;
          const tid = m.threadId ? String(m.threadId) : (Array.isArray(m.to) ? `group:${toArr.slice().sort().join(',')}` : `dm:${(m.from === me ? String(m.to) : String(m.from))}`);
          const prev = map.get(tid);
          if (!prev || (m.ts || 0) > (prev.ts || 0)) map.set(tid, m);
        }
        return map;
      })();
      const conversations = Array.from(convMap.entries())
        .map(([threadId, lastMsg]) => ({ threadId, lastMsg }))
        .sort((a, b) => (b.lastMsg.ts || 0) - (a.lastMsg.ts || 0));

      const activeThreadId = (Array.isArray(activeGroupIds) && activeGroupIds.length > 0 && !activePartnerId)
        ? `group:${activeGroupIds.slice().sort().join(',')}`
        : (activePartnerId ? `dm:${String(activePartnerId)}` : '');

      const threadMessages = messages.filter(m => {
        const me = String(currentUser);
        const tid = m.threadId ? String(m.threadId) : (Array.isArray(m.to) ? `group:${(m.to||[]).slice().sort().join(',')}` : `dm:${(m.from === me ? String(m.to) : String(m.from))}`);
        return activeThreadId && tid === activeThreadId;
      });

      // Header
      const headerList = React.createElement('div', { className: 'd-flex items-center justify-end', style: { padding: '4px 8px' } }, [
        React.createElement(UIButton, { key: 'new', label: 'New Chat', variant: 'primary', onClick: () => { setActivePartnerId(''); setView('new'); } })
      ]);

      const listCards = (conversations || []).map((c, i) => {
          const tid = c.threadId;
          const isGroup = String(tid || '').startsWith('group:');
          const label = isGroup
            ? (String(tid).slice(6).split(',').map(s => userLabelById(String(s).trim())).join(', '))
            : userLabel(String(tid).slice(3));
          const preview = (c.lastMsg && c.lastMsg.text) ? c.lastMsg.text : '';
          const time = c.lastMsg && c.lastMsg.ts ? new Date(c.lastMsg.ts).toLocaleTimeString() : '';
          return React.createElement('div', { key: tid || i, onClick: () => {
              if (isGroup) { setActivePartnerId(''); setActiveGroupIds(String(tid).slice(6).split(',').filter(Boolean)); }
              else { setActiveGroupIds([]); setActivePartnerId(String(tid).slice(3)); }
              setView('thread');
            },
            className: 'd-flex items-center',
            style: { border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', background: '#fff' } }, [
              React.createElement('div', { key: 'av', className: 'avatar-initials', style: { marginRight: 10 } }, initialsOf(label)),
              React.createElement('div', { key: 'txt', className: 'd-flex flex-column', style: { flex: 1, minWidth: 0 } }, [
                React.createElement('div', { key: 'n', className: 'font-medium', style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, label),
                React.createElement('div', { key: 'p', className: 'text-sm text-gray-600', style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, preview)
              ]),
              React.createElement('div', { key: 't', className: 'text-xs text-gray-500' }, time)
            ]);
        });

      const listView = React.createElement('div', { className: 'd-flex flex-column gap-8' }, [
        headerList,
        (listCards.length
          ? React.createElement('div', { key: 'cards', className: 'd-flex flex-column gap-8' }, listCards)
          : React.createElement('div', { key: 'empty', className: 'text-gray-500', style: { padding: '8px' } }, 'No chats yet. Click New Chat to start.'))
      ]);

      // Contact picker (New Chat)
      const onToggleNewSelect = (pid) => {
        setNewSelection(prev => {
          const n = new Set(prev);
          if (n.has(pid)) n.delete(pid); else n.add(pid);
          return n;
        });
      };

      const startNewChats = () => {
        const ids = Array.from(newSelection);
        if (!ids.length) return;
        if (ids.length === 1) {
          setActiveGroupIds([]);
          setActivePartnerId(ids[0]);
        } else {
          setActivePartnerId('');
          setActiveGroupIds(ids);
        }
        setView('thread');
        setNewSelection(new Set());
      };

      const newChatView = React.createElement('div', { className: 'd-flex flex-column gap-8' }, [
        React.createElement('div', { key: 'hdr', className: 'd-flex items-center justify-between', style: { padding: '4px 8px' } }, [
          React.createElement('div', { key: 'l', className: 'd-flex items-center gap-8' }, [
            React.createElement('button', { key: 'back', onClick: () => setView('list'), style: { background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 18 } }, '⬅'),
            React.createElement('div', { key: 'lbl', className: 'font-semibold' }, 'New Chat')
          ]),
          React.createElement(UIButton, { key: 'start', label: 'Start', onClick: startNewChats, variant: 'primary', disabled: !newSelection.size })
        ]),
        React.createElement('div', { key: 'pick', style: { border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' } },
          React.createElement('div', { style: { maxHeight: 320, overflowY: 'auto', background: '#fff' } },
            (users || []).filter(u => (u?.id || u?.label) && (u.id || u.label) !== currentUser)
              .map((u, i) => {
                const pid = u.id || u.label;
                const label = userLabel(pid);
                const checked = newSelection.has(pid);
                return React.createElement('label', { key: pid || i, className: 'd-flex items-center', style: { padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' } }, [
                  React.createElement('input', { key: 'cb', type: 'checkbox', checked, onChange: () => onToggleNewSelect(pid), style: { marginRight: 10 } }),
                  React.createElement('div', { key: 'av', className: 'avatar-initials', style: { marginRight: 10 } }, initialsOf(label)),
                  React.createElement('div', { key: 'n', className: 'font-medium' }, label)
                ]);
              })
          )
        )
      ]);

      // Thread header and body
      const headerThread = React.createElement('div', { className: 'd-flex items-center gap-8', style: { padding: '4px 8px' } }, [
        React.createElement('button', { key: 'back', onClick: () => setView('list'), style: { background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 18 } }, '⬅'),
        React.createElement('div', { key: 'lbl', className: 'font-semibold' }, (activePartnerId ? userLabel(activePartnerId) : (activeGroupIds || []).map(s => userLabelById(String(s).trim())).join(', ')))
      ]);

      const isGroupThread = !!(activeThreadId && String(activeThreadId).startsWith('group:'));
      function colorClassForUser(uid) {
        try {
          const palette = ['alt-1','alt-2','alt-3','alt-4'];
          let sum = 0; const s = String(uid || '');
          for (let i = 0; i < s.length; i++) sum = (sum + s.charCodeAt(i)) | 0;
          const idx = Math.abs(sum) % palette.length;
          return palette[idx];
        } catch { return 'alt-1'; }
      }
      const threadList = threadMessages.length ? React.createElement('div', { ref: listRef, style: { padding: 8, border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' } },
        threadMessages.map(m => {
          const mine = String(m.from) === String(currentUser);
          const rowCls = 'chat-bubble-row ' + (mine ? 'mine' : 'other');
          let bubbleCls = 'chat-bubble ' + (mine ? 'mine' : 'other');
          if (!mine) {
            // DM: light gray; Group: deterministic alternating palette per participant
            if (isGroupThread) {
              bubbleCls += (' ' + colorClassForUser(m.from));
            } else {
              bubbleCls += ' other-gray';
            }
          }
          return React.createElement('div', { key: m.id, className: rowCls },
            React.createElement('div', { className: bubbleCls }, String(m.text || ''))
          );
        })
      ) : null;

      const onComposerKeyDown = (e) => {
        try {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
        } catch {}
      };
      const composer = React.createElement('div', { className: 'd-flex items-center gap-8' }, [
        React.createElement('input', { key: 'inp', type: 'text', placeholder: 'Write a message…', value: text, onChange: (e) => setText(e.target.value), onKeyDown: onComposerKeyDown, className: 'input-padding input-border input-border-radius', style: { flex: 1 } }),
        React.createElement(UIButton, { key: 'send', label: 'Send', onClick: send, variant: 'primary', disabled: (!activePartnerId && (!(Array.isArray(activeGroupIds) && activeGroupIds.length))) })
      ]);

      const threadView = React.createElement('div', { className: 'd-flex flex-column gap-8' }, [headerThread, (threadList || null), composer]);

      return (view === 'list') ? listView : (view === 'new' ? newChatView : threadView);
    }

    // Notifications bell (standard icon) that opens a modal
    function NotificationsBell() {
      const { logs, lastSeenLogCount } = React.useContext(StateContext);
      const total = (logs || []).length;
      const unseen = Math.max(0, total - (lastSeenLogCount || 0));
      const open = () => { try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'notifications' } })); } catch {} };
      const badge = unseen ? React.createElement('span', { className: 'ui-badge badge-notification' }, String(unseen)) : null;
      return React.createElement('span', { className: 'notifications-bell', onClick: open, title: 'Notifications' }, ['🔔', badge]);
    }

    function NotificationsModal(props) {
      const { onClose } = props || {};
      const { tokens } = React.useContext(ThemeContext);
      const { logs, markNotificationsSeen, renderNotification } = React.useContext(StateContext);
      const t = tokens && tokens.modal ? tokens.modal : {};

      const copy = async () => {
        try {
          const text = (logs || []).slice().reverse().map(log => {
            if (typeof log === 'string') return log;
            return `[${log.timestamp}] ${log.message}`;
          }).join('\n');
          if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(text);
        } catch {}
      };

      const list = React.createElement('div', {
        className: 'notifications-list notifications-list-modal'
      }, (logs || []).slice().reverse().map((log, index) => renderNotification(log, index)).filter(Boolean));

      const button = (label, variant, onclick) => React.createElement(UIButton, { label, onClick: onclick, variant: variant || 'primary' });
      React.useEffect(() => { try { markNotificationsSeen?.(); } catch {} }, [markNotificationsSeen]);

      return React.createElement('div', { className: 'modal-overlay', onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { className: 'modal-panel' }, [
          React.createElement('div', { key: 'h', className: 'ui-modal__header' }, [
            React.createElement('div', { key: 't', className: 'font-bold' }, 'Notifications'),
            React.createElement('button', { key: 'x', className: 'ui-modal__close', onClick: onClose }, '✕')
          ]),
          React.createElement('div', { key: 'b', className: 'ui-modal__body' }, list),
          React.createElement('div', { key: 'f', className: 'modal-footer' }, [
            button('Copy', 'secondary', copy),
            button('Close', 'primary', () => { try { markNotificationsSeen?.(); } finally { onClose?.(); } }),
          ])
        ])
      );
    }


    function ChatConsole() {
      const API_BASE = getApiBase();
      const { currentUser, isConnected, users } = React.useContext(StateContext);
      const [messages, setMessages] = React.useState([]);
      const DEFAULT_AI_GREETING = 'Shall we...contract?';
      // Helper function to detect current platform
      const getCurrentPlatform = () => {
        try { return (typeof Office !== 'undefined') ? 'word' : 'web'; } catch { return 'web'; }
      };

      const [text, setText] = React.useState('');
      // Initialize with greeting from bot on mount/user change
      React.useEffect(() => {
        try { setMessages(['[bot] ' + DEFAULT_AI_GREETING]); setText(''); } catch {}
      }, [currentUser]);
      const displayNameOf = React.useCallback((uid) => {
        try {
          if (!uid) return '';
          if (String(uid).toLowerCase() === 'bot') return 'bot';
          const u = (users || []).find(x => x && (x.id === uid || x.label === uid));
          return (u && (u.label || u.id)) || String(uid);
        } catch { return String(uid); }
      }, [users]);

      const send = async () => {
        const t = (text || '').trim();
        if (!t) return;
        setMessages((m) => { const next = (m || []).concat(`[${displayNameOf(currentUser)}] ${t}`); return next; });
        setText('');
        try {
          const platform = getCurrentPlatform();
          await fetch(`${API_BASE}/api/v1/events/client`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'chat', payload: { text: t }, userId: currentUser, platform }) });
        } catch {}
      };
      React.useEffect(() => {
        function onInboundChat(ev) {
          try {
            const d = ev.detail;
            const text = d && d.payload && d.payload.text;
            const from = d && d.userId || 'bot';
            const threadPlatform = d && d.payload && d.payload.threadPlatform;
            // Ignore messages from other platforms (isolate threads)
            try { if (typeof Office !== 'undefined') { if (threadPlatform && threadPlatform !== 'word') return; } else { if (threadPlatform && threadPlatform !== 'web') return; } } catch {}
            // Ignore echo of our own message (server broadcasts user messages too)
            if (!text || String(from) === String(currentUser)) return;
            setMessages((m) => { const next = (m || []).concat(`[${displayNameOf(from)}] ${text}`); return next; });
          } catch {}
        }
        function onChatReset(ev) {
          try {
            const d = ev.detail;
            const isGlobal = !!(d && d.payload && d.payload.all);
            const forUser = String(d && d.userId || 'default');
            const threadPlatform = d && d.payload && d.payload.threadPlatform;
            const currentPlatform = typeof Office !== 'undefined' ? 'word' : 'web';
            console.log('📨 SSE reset received:', { forUser, threadPlatform, currentPlatform, currentUser });

            if (isGlobal) {
              // Factory reset or global reset: clear completely, do NOT seed greeting
              setMessages([]);
              setText('');
              return;
            }

            // Ignore resets from other platforms
            try {
              if (typeof Office !== 'undefined') {
                if (threadPlatform && threadPlatform !== 'word') {
                  console.log('🔄 Ignoring reset - wrong platform for Word');
                  return;
                }
              } else {
                if (threadPlatform && threadPlatform !== 'web') {
                  console.log('🔄 Ignoring reset - wrong platform for Web');
                  return;
                }
              }
            } catch {}

            if (String(forUser) !== String(currentUser)) {
              console.log('🔄 Ignoring reset - wrong user');
              return;
            }

            console.log('🔄 Processing reset for current user/platform');
            setMessages(['[bot] ' + DEFAULT_AI_GREETING]);
            setText('');
          } catch (error) {
            console.error('❌ SSE reset error:', error);
          }
        }
        function onChatDelta(ev) {
          try {
            const d = ev.detail;
            const text = String(d && d.payload && d.payload.text || '');
            if (!text) return;

            // Check platform compatibility
            const threadPlatform = d && d.payload && d.payload.threadPlatform;
            try { if (typeof Office !== 'undefined') { if (threadPlatform && threadPlatform !== 'word') return; } else { if (threadPlatform && threadPlatform !== 'web') return; } } catch {}

            // For streaming, we need to handle incremental updates to the last message
            setMessages((m) => {
              const next = [...(m || [])];
              if (next.length === 0 || !next[next.length - 1].startsWith('[bot] ')) {
                // Start new bot message
                next.push('[bot] ' + text);
              } else {
                // Append to existing bot message
                next[next.length - 1] = next[next.length - 1] + text;
              }
              return next;
            });
          } catch {}
        }
        function onChatComplete(ev) {
          try {
            const d = ev.detail;
            const fullText = String(d && d.payload && d.payload.fullText || '');

            // Check platform compatibility
            const threadPlatform = d && d.payload && d.payload.threadPlatform;
            try { if (typeof Office !== 'undefined') { if (threadPlatform && threadPlatform !== 'word') return; } else { if (threadPlatform && threadPlatform !== 'web') return; } } catch {}

            // Replace the last message with the complete text
            setMessages((m) => {
              const next = [...(m || [])];
              if (next.length > 0 && next[next.length - 1].startsWith('[bot] ')) {
                next[next.length - 1] = '[bot] ' + fullText;
              } else {
                next.push('[bot] ' + fullText);
              }
              return next;
            });
          } catch {}
        }
        window.addEventListener('chat:message', onInboundChat);
        window.addEventListener('chat:delta', onChatDelta);
        window.addEventListener('chat:complete', onChatComplete);
        window.addEventListener('chat:reset', onChatReset);
        return () => {
          window.removeEventListener('chat:message', onInboundChat);
          window.removeEventListener('chat:delta', onChatDelta);
          window.removeEventListener('chat:complete', onChatComplete);
          window.removeEventListener('chat:reset', onChatReset);
        };
      }, [currentUser]);
      const box = React.createElement('div', { className: 'chat-container', style: { width: '100%' } }, messages.map((m, i) => {
        const isMine = typeof m === 'string' ? /^\[/.test(m) && m.includes(`[${displayNameOf(currentUser)}]`) : false;
        const text = typeof m === 'string' ? m.replace(/^\[[^\]]+\]\s*/, '') : String(m);
        const rowCls = 'chat-bubble-row ' + (isMine ? 'mine' : 'other');
        const bubbleCls = 'chat-bubble ' + (isMine ? 'mine' : 'other');
        return React.createElement('div', { key: i, className: rowCls }, React.createElement('div', { className: bubbleCls }, text));
      }));
      const onKeyPress = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          send();
        }
      };
      const sendIcon = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true },
        React.createElement('path', { d: 'M12 4l0 12', stroke: 'white', 'stroke-width': 2.5, 'stroke-linecap': 'round' }),
        React.createElement('path', { d: 'M7.5 9.5L12 4l4.5 5.5', stroke: 'white', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
      );
      const btn = React.createElement('button', { className: 'btn-circle-primary chat-send', onClick: send, title: 'Send' }, sendIcon);
      const input = React.createElement('div', { className: 'chat-composer' }, [
        React.createElement('textarea', {
          value: text,
          onChange: (e) => setText(e.target.value),
          onKeyPress: onKeyPress,
          placeholder: 'Type a message...',
          className: 'chat-input',
          rows: 2
        }),
        btn
      ]);
      const reset = async () => {
        try {
          console.log('🔄 Starting reset process...');
          const plat = (function(){ try { return (typeof Office !== 'undefined') ? 'word' : 'web'; } catch { return 'web'; } })();
          console.log('📤 Sending reset request:', { platform: plat, userId: currentUser });
          const r = await fetch(`${API_BASE}/api/v1/chatbot/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser, platform: plat }) });
          // Ask server and other clients to stop any in-flight streaming
          try { await fetch(`${API_BASE}/api/v1/events/client`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'chat:stop', userId: currentUser, platform: plat }) }); } catch {}
          // Optimistically clear locally; SSE chat:reset will also arrive
          try { setMessages(['[bot] ' + DEFAULT_AI_GREETING]); } catch {}
          try { setText(''); } catch {}
          console.log('✅ Reset completed locally');
          return r;
        } catch (error) {
          console.error('❌ Reset failed:', error);
        } finally {}
      };
      const refreshDoc = async () => {
        try {
          const response = await fetch(`${API_BASE}/api/v1/refresh-document`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          const result = await response.json();
          if (result.ok) {
            setMessages((m) => [...(m || []), `[system] Document context refreshed - ${result.contextLength} chars loaded`]);
          } else {
            setMessages((m) => [...(m || []), `[system] Failed to refresh document: ${result.error}`]);
          }
        } catch (error) {
          setMessages((m) => [...(m || []), `[system] Error refreshing document: ${error.message}`]);
        }
      };
      const resetBtn = React.createElement(UIButton, { label: 'Reset', onClick: reset, tone: 'secondary' });
      const refreshBtn = React.createElement(UIButton, { label: 'Refresh Doc', onClick: refreshDoc, tone: 'secondary' });
      const inputRow = React.createElement('div', { className: 'd-flex gap-8 align-items-end', style: { width: '100%' } }, [
        React.createElement('div', { style: { flex: 1 } }, input)
      ]);
      const buttonRow = React.createElement('div', { className: 'd-flex gap-8' }, [resetBtn, refreshBtn]);
      const wrap = React.createElement('div', { className: 'd-flex flex-column gap-8', style: { width: '100%' } }, [box, inputRow, buttonRow]);
      return React.createElement('div', null, [wrap]);
    }

    function LastUpdatedPrefix() {
      const { config } = React.useContext(StateContext);
      let when = '—';
      let firstName = '';
      try {
        const ts = config && config.lastSaved && config.lastSaved.timestamp;
        when = ts ? new Date(ts).toLocaleString() : '—';
        const user = config && config.lastSaved && config.lastSaved.user;
        let label = '';
        if (user) {
          if (typeof user === 'object') label = user.label || user.name || user.id || '';
          else label = String(user);
        }
        label = String(label || '').trim();
        // Only show user name if it is a real human label (not 'system' or 'Unknown User')
        if (label && !/^system$/i.test(label) && !/^unknown\s+user$/i.test(label)) {
          const parts = label.split(/\s+/);
          firstName = parts && parts.length ? parts[0] : '';
        }
      } catch {}
      const suffix = firstName ? ` by ${firstName}` : '';
      return React.createElement('span', null, `Last updated on ${when}${suffix}`);
    }

    function InlineTitleEditor() {
      const { config, addLog, currentUser } = React.useContext(StateContext);
      const API_BASE = getApiBase();
      const [title, setTitle] = React.useState(config?.title || 'Untitled Document');
      React.useEffect(() => { setTitle(config?.title || 'Untitled Document'); }, [config?.title]);
      const onBlur = async () => {
        const next = (title || '').trim();
        if (!next) return;
        try {
          const plat = (function(){ try { return (typeof Office !== 'undefined') ? 'word' : 'web'; } catch { return 'web'; } })();
          const payload = { title: next };
          try { payload.userId = currentUser || undefined; } catch {}
          payload.platform = plat;
          const r = await fetch(`${API_BASE}/api/v1/title`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!r.ok) throw new Error('title_update');
          addLog && addLog('Title updated', 'document');
        } catch {}
      };
      return React.createElement('textarea', {
        value: title,
        onChange: (e) => setTitle(e.target.value),
        onBlur,
        placeholder: 'Untitled Document',
        className: 'font-semibold w-full',
        rows: 1,
        style: {
          background: 'transparent',
          border: 'none',
          outline: 'none',
          padding: '0',
          margin: '0',
          fontSize: 'calc(var(--font-size-2xl) * 1.5)',
          lineHeight: '1.15',
          height: 'calc((var(--font-size-2xl) * 1.5) * 1.2)',
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
          overflow: 'hidden',
          resize: 'none'
        }
      });
    }

    function StatusBadge() {
      const { config, addLog } = React.useContext(StateContext);
      const API_BASE = getApiBase();
      const [status, setStatus] = React.useState((config?.status || 'draft').toLowerCase());
      React.useEffect(() => { setStatus((config?.status || 'draft').toLowerCase()); }, [config?.status]);
      const cycle = async () => {
        try { const r = await fetch(`${API_BASE}/api/v1/status/cycle`, { method: 'POST' }); if (r.ok) { const j = await r.json(); setStatus((j.status || 'draft').toLowerCase()); addLog && addLog(`Status: ${j.status}`, 'system'); } } catch {}
      };
      const label = (s => s === 'final' ? 'Final' : s === 'review' ? 'Review' : 'Draft')(status);
      const cls = (function(s){
        if (s === 'final') return 'ui-badge gray-verydark';
        if (s === 'review') return 'ui-badge gray-dark';
        return 'ui-badge gray-medium';
      })(status);
      return React.createElement('div', { className: 'mb-2' }, React.createElement('span', { className: cls, onClick: cycle, style: { cursor: 'pointer' } }, label));
    }

    function VersionsPanel() {
      const API_BASE = getApiBase();
      const { config, addLog, viewingVersion, setViewingVersion, setDocumentSource } = React.useContext(StateContext);
      const [items, setItems] = React.useState([]);
      const [confirm, setConfirm] = React.useState(null);
      const refresh = React.useCallback(async () => {
        try {
          const url = `${API_BASE}/api/v1/versions?rev=${Date.now()}`;
          const r = await fetch(url, { cache: 'no-store' });
          if (r.ok) {
            const j = await r.json();
            const arr = Array.isArray(j.items) ? j.items : [];
            setItems(arr);
          }
        } catch {}
      }, [API_BASE]);
      React.useEffect(() => { refresh(); }, [refresh]);
      React.useEffect(() => {
        const onVersionsUpdate = () => { try { refresh(); } catch {} };
        const onFactory = () => { try { setViewingVersion(1); refresh(); } catch {} };
        const onVersionView = async (ev) => {
          try {
            const d = ev && ev.detail;
            const n = Number(d && d.version);
            if (!Number.isFinite(n) || n < 1) return;
            setViewingVersion(n);
            const url = `${API_BASE}/api/v1/versions/${n}?rev=${Date.now()}`;
            if (typeof Office !== 'undefined') {
              try {
                const res = await fetch(url, { cache: 'no-store' }); if (!res.ok) throw new Error('download');
                const buf = await res.arrayBuffer();
                const b64 = (function(buf){ let bin=''; const bytes=new Uint8Array(buf); for(let i=0;i<bytes.byteLength;i++) bin+=String.fromCharCode(bytes[i]); return btoa(bin); })(buf);
                await Word.run(async (context) => { context.document.body.insertFileFromBase64(b64, Word.InsertLocation.replace); await context.sync(); });
              } catch {}
            } else {
              setDocumentSource(url);
              addLog(`doc src versions:view -> ${url}`);
            }
          } catch {}
        };
        try { window.addEventListener('versions:update', onVersionsUpdate); } catch {}
        try { window.addEventListener('factoryReset', onFactory); } catch {}
        try { window.addEventListener('version:view', onVersionView); } catch {}
        return () => {
          try { window.removeEventListener('versions:update', onVersionsUpdate); } catch {}
          try { window.removeEventListener('factoryReset', onFactory); } catch {}
          try { window.removeEventListener('version:view', onVersionView); } catch {}
        };
      }, [API_BASE, addLog, setDocumentSource, setViewingVersion]);
      const isCurrent = (v) => { try { const cur = Number(config?.documentVersion || 1); return Number(v) === cur; } catch { return false; } };
      const isViewing = (v) => { try { return Number(v) === Number(viewingVersion || 0); } catch { return false; } };
      const onClickView = (v) => {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 1) return;
        setConfirm({ title: 'View this version?', message: `You are about to view version ${n}. Continue?`, onConfirm: async () => {
          try {
            await fetch(`${API_BASE}/api/v1/versions/view`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: n }) });
            try { window.dispatchEvent(new CustomEvent('version:view', { detail: { version: n } })); } catch {}
          } catch {}
        } });
      };
      const card = (it, i) => {
        const v = Number(it.version || 1);
        const who = (it.savedBy && (it.savedBy.label || it.savedBy.userId)) || 'Unknown';
        const when = it.savedAt ? new Date(it.savedAt).toLocaleString() : '—';
        const isView = isViewing(v);

        const baseCardStyle = {
          border: `1px solid ${isView ? '#6366F1' : '#E5E7EB'}`,
          borderRadius: 12,
          padding: '14px 16px',
          cursor: 'pointer',
          background: isView ? '#EEF2FF' : '#FFFFFF'
        };

        const titleRow = React.createElement('div', { key: 'title-row', className: 'd-flex items-center', style: { gap: 12 } }, [
          React.createElement('div', { key: 't', style: { fontWeight: 600, fontSize: 16, color: '#111827' } }, `Version ${v}`),
          (isView ? React.createElement('span', { key: 'view', style: { fontSize: 12, color: '#374151', fontWeight: 600 } }, 'Viewing') : null)
        ]);

        const metaRow = React.createElement('div', { key: 'meta', style: { marginTop: 6, fontSize: 14, color: '#6B7280' } }, `${who} at ${when}`);

        return React.createElement('div', { key: `v-${v}-${i}`, onClick: () => onClickView(v), style: baseCardStyle }, [
          titleRow,
          metaRow
        ]);
      };
      const list = (items || []).map(card);
      const scrollBox = list.length
        ? React.createElement('div', { key: 'cards-wrap', style: { maxHeight: 360, overflowY: 'auto', padding: 0 } },
            React.createElement('div', { className: 'd-flex flex-column gap-8' }, list)
          )
        : React.createElement('div', { key: 'empty', className: 'text-gray-500', style: { padding: 8 } }, 'No versions yet.');
      return React.createElement('div', { className: 'd-flex flex-column gap-8' }, [
        scrollBox,
        (confirm ? React.createElement(ConfirmModal, { title: confirm.title, message: confirm.message, onConfirm: confirm.onConfirm, onClose: () => setConfirm(null) }) : null)
      ]);
    }

    function UserCard() {
      const { users, currentUser, currentRole, actions } = React.useContext(StateContext);
      const [selected, setSelected] = React.useState(currentUser);
      React.useEffect(() => { setSelected(currentUser); }, [currentUser]);
      const onChange = (e) => {
        const nextId = e.target.value;
        const u = (users || []).find(x => (x.id || x.label) === nextId) || {};
        try { actions.setUser(nextId, u.role || 'editor'); } catch {}
        setSelected(nextId);
      };
      const select = React.createElement('select', { value: selected || '', onChange }, (users || []).map((u, i) => {
        const name = u.label || u.id;
        const role = String(u.role || 'editor').toLowerCase();
        const optionLabel = name ? `${name} (${role})` : `(${role})`;
        return React.createElement('option', { key: i, value: u.id || u.label }, optionLabel);
      }));
      return React.createElement('div', { className: 'd-flex items-center' }, [select]);
    }

    function DocumentControls() {
      const API_BASE = getApiBase();
      const { revision, setDocumentSource, addLog, setLoadedVersion } = React.useContext(StateContext);
      const isWord = typeof Office !== 'undefined';
      const openNew = async () => {
        if (isWord) {
          const input = document.createElement('input'); input.type = 'file'; input.accept = '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          input.onchange = async (e) => {
            const file = e.target.files && e.target.files[0]; if (!file) return;
            const buf = await file.arrayBuffer(); const b64 = (function(buf){ let bin=''; const bytes=new Uint8Array(buf); for(let i=0;i<bytes.byteLength;i++) bin+=String.fromCharCode(bytes[i]); return btoa(bin); })(buf);
            try { await Word.run(async (context) => { context.document.body.insertFileFromBase64(b64, Word.InsertLocation.replace); await context.sync(); }); } catch {}
          };
          input.click();
        } else {
          const input = document.createElement('input'); input.type = 'file'; input.accept = '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          input.onchange = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; try { setDocumentSource(f); addLog('doc src set [file]'); } catch {} };
          input.click();
        }
      };
      const viewLatest = async () => {
        const w = `${API_BASE}/documents/working/default.docx`;
        const c = `${API_BASE}/documents/canonical/default.docx`;
        if (isWord) {
          try {
            let url = c;
            try {
              const h = await fetch(w, { method: 'HEAD' });
              if (h.ok) {
                const len = Number(h.headers.get('content-length') || '0');
                if (Number.isFinite(len) && len > MIN_DOCX_SIZE) url = w;
              }
            } catch {}
            const withRev = `${url}?rev=${revision || Date.now()}`;
            const res = await fetch(withRev, { cache: 'no-store' }); if (!res.ok) throw new Error('download');
            const buf = await res.arrayBuffer();
            const b64 = (function(buf){ let bin=''; const bytes=new Uint8Array(buf); for(let i=0;i<bytes.byteLength;i++) bin+=String.fromCharCode(bytes[i]); return btoa(bin); })(buf);
            await Word.run(async (context) => { context.document.body.insertFileFromBase64(b64, Word.InsertLocation.replace); await context.sync(); });
            try {
              const plat = 'word';
              const u = `${API_BASE}/api/v1/state-matrix?platform=${plat}&clientVersion=0&userId=${encodeURIComponent('user1')}`;
              const r = await fetch(u);
              const j = await r.json();
              const v = Number(j?.config?.documentVersion || 0);
              if (v > 0) setLoadedVersion(v);
            } catch {}
          } catch {}
        } else {
          try {
            let url = c;
            try {
              const h = await fetch(w, { method: 'HEAD' });
              if (h.ok) {
                const len = Number(h.headers.get('content-length') || '0');
                if (Number.isFinite(len) && len > MIN_DOCX_SIZE) url = w;
              }
            } catch {}
            const finalUrl = `${url}?rev=${revision || Date.now()}`;
            setDocumentSource(finalUrl);
            addLog(`doc src viewLatest -> ${finalUrl}`);
            try {
              const plat = 'web';
              const u = `${API_BASE}/api/v1/state-matrix?platform=${plat}&clientVersion=0&userId=${encodeURIComponent('user1')}`;
              const r = await fetch(u);
              const j = await r.json();
              const v = Number(j?.config?.documentVersion || 0);
              if (v > 0) setLoadedVersion(v);
            } catch {}
          } catch {}
        }
      };
      const btn = (label, onClick, variant) => React.createElement(UIButton, { label, onClick, variant: variant || 'primary', className: 'w-full' });
      return React.createElement('div', { className: 'd-grid grid-cols-2 column-gap-8 row-gap-6 grid-auto-rows-minmax-27' }, [btn('Open New Document', openNew), btn('View Latest', viewLatest)]);
    }

    function ErrorBanner() {
      const { lastError } = React.useContext(StateContext);
      if (!lastError) return null;
      const msg = lastError.message || 'An error occurred';
      const detail = lastError.url ? ` url=${lastError.url}` : '';
      const status = lastError.status ? ` status=${lastError.status}` : '';
      return React.createElement('div', { className: 'my-2 p-2 border border-error-200 bg-error-50 text-error-700 rounded-md' }, `Error: ${msg}${status}${detail}`);
    }

    function SuperDocHost() {
      const { documentSource, setLastError, addLog } = React.useContext(StateContext);
      const mountedRef = React.useRef(false);
      const inFlightIdRef = React.useRef(0);
      const blobUrlRef = React.useRef(null);
      React.useEffect(() => {
        if (typeof Office !== 'undefined') return; // Word path not here
        if (!documentSource) return;
        (async () => {
          const myId = ++inFlightIdRef.current;
          try {
            const hasBridge = !!(window.SuperDocBridge && typeof window.SuperDocBridge.mount === 'function');
            if (!hasBridge) throw new Error('SuperDocBridge unavailable');
            const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

            async function isValidDocx(blob) {
              try {
                if (!blob || typeof blob.size !== 'number' || blob.size < MIN_DOCX_SIZE) return false;
                const ab = await blob.slice(0, 2).arrayBuffer();
                const u8 = new Uint8Array(ab);
                return u8[0] === 0x50 && u8[1] === 0x4b; // 'PK'
              } catch { return false; }
            }

            async function fetchDocxOrNull(url) {
              try {
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok) return null;
                let blob = await res.blob();
                if (blob && blob.type !== MIME_DOCX) {
                  try { blob = new Blob([blob], { type: MIME_DOCX }); } catch {}
                }
                if (!(await isValidDocx(blob))) return null;
                return blob;
              } catch { return null; }
            }

            // Resolve to a valid DOCX Blob/File: try source; if working 404/invalid, try canonical.
            let finalBlob = null;
            let origin = 'file';
            const src = documentSource;
            if (src && (src instanceof Blob || src instanceof File)) {
              finalBlob = src;
              origin = 'file';
            } else if (typeof src === 'string') {
              origin = src.includes('/documents/working/') ? 'working' : (src.includes('/documents/canonical/') ? 'canonical' : 'url');
              finalBlob = await fetchDocxOrNull(src);
              if (!finalBlob && origin === 'working') {
                try {
                  const base = src.split('?')[0].replace('/documents/working/', '/documents/canonical/');
                  const rev = (src.split('rev=')[1] || Date.now()).toString();
                  const fallbackUrl = `${base}?rev=${rev}`;
                  finalBlob = await fetchDocxOrNull(fallbackUrl);
                  if (finalBlob) { origin = 'canonical'; }
                } catch {}
              }
            }

            if (inFlightIdRef.current !== myId) return; // superseded by a newer request

            if (!finalBlob) {
              setLastError({ kind: 'doc_load', message: 'Failed to load document bytes', url: String(documentSource || ''), status: null });
              addLog('doc open ERR invalid_bytes');
              return;
            }

            // Prepare a blob URL for the UMD bridge (expects URL or File/Blob; URL is most reliable)
            try { if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; } } catch {}
            const objectUrl = URL.createObjectURL(finalBlob);
            blobUrlRef.current = objectUrl;
            const docConfigUrl = { id: 'default', type: 'docx', url: objectUrl };
            // const docConfigData = { id: 'default', type: 'docx', data: finalBlob };

            if (!mountedRef.current) {
              // Use open() path which resets containers before mount, mirroring prior working behavior
              if (typeof window.SuperDocBridge.open === 'function') {
                window.SuperDocBridge.open(docConfigUrl);
              } else {
                window.SuperDocBridge.mount({ selector: '#superdoc', toolbar: '#superdoc-toolbar', document: docConfigUrl, documentMode: 'editing' });
              }
              mountedRef.current = true;
              addLog(`doc open [${origin}] url`);
            } else if (typeof window.SuperDocBridge.open === 'function') {
              window.SuperDocBridge.open(docConfigUrl);
              addLog(`doc refresh [${origin}] url`);
            }
          } catch (e) {
            setLastError({ kind: 'doc_load', message: 'Failed to open document', url: String(documentSource || ''), status: null, cause: String(e) });
            try { console.error('doc_load_error', { url: documentSource, error: e }); } catch {}
          }
        })();
        return () => {};
      }, [documentSource]);
      return null;
    }

    function SendVendorModal(props) {
      const { onClose, userId } = props || {};
      const [schema, setSchema] = React.useState(null);
      const [values, setValues] = React.useState({});
      const API_BASE = getApiBase();

      React.useEffect(() => {
        (async () => {
          try { const r = await fetch(`${API_BASE}/api/v1/ui/modal/send-vendor?userId=${encodeURIComponent(userId || 'user1')}`); if (r.ok) { const j = await r.json(); setSchema(j.schema || null); } } catch {}
        })();
      }, [API_BASE, userId]);

      if (!schema) return null;
      const t = schema.theme || {};

      const setField = (name, val) => setValues(v => ({ ...v, [name]: val }));
      const onAction = async (actionId) => {
        if (actionId === 'cancel') return onClose?.();
        if (actionId === 'save') {
          try {
            const body = { ...values, userId: userId || 'user1' };
            const r = await fetch(`${API_BASE}/api/v1/send-vendor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (!r.ok) throw new Error('send-vendor');
          } catch {}
          return onClose?.();
        }
        onClose?.();
      };

      return React.createElement('div', { className: 'modal-overlay', onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { className: 'modal-panel' }, [
          React.createElement('div', { key: 'h', className: 'modal-header' }, [
            React.createElement('div', { key: 't', className: 'font-bold' }, schema.title || 'Modal'),
            React.createElement('button', { key: 'x', className: 'ui-modal__close', onClick: () => onClose?.() }, '✕')
          ]),
          React.createElement('div', { key: 'b', className: 'modal-body' }, [
            schema.description ? React.createElement('div', { key: 'd', className: 'text-gray-500' }, schema.description) : null,
            React.createElement('div', { key: 'f', className: 'd-grid grid-cols-1 gap-12' },
              (Array.isArray(schema.fields) ? schema.fields : []).map((f, i) => React.createElement('div', { key: `r-${i}`, className: 'd-flex flex-column gap-6' }, [
                React.createElement('label', { key: 'l', className: 'text-sm text-gray-500' }, f.label || f.name),
                (f.type === 'textarea'
                  ? React.createElement('textarea', { key: 'i', rows: 4, placeholder: f.placeholder || '', defaultValue: f.value || '', maxLength: f.maxLength || undefined, className: 'input-padding input-border input-border-radius', onChange: (e) => setField(f.name, e.target.value) })
                  : React.createElement('input', { key: 'i', type: 'text', placeholder: f.placeholder || '', defaultValue: f.value || '', className: 'input-padding input-border input-border-radius', onChange: (e) => setField(f.name, e.target.value) })
                )
              ]))
            )
          ]),
          React.createElement('div', { key: 'f2', className: 'modal-footer' },
            (Array.isArray(schema.actions) ? schema.actions : []).map((a, i) => React.createElement(UIButton, { key: `a-${i}`, label: a.label || a.id, onClick: () => onAction(a.id), variant: a.variant || 'primary' }))
          )
        ])
      );
    }

    function MessageModal(props) {
      const { onClose, toUserId, toUserName } = props || {};
      const API_BASE = getApiBase();
      const { currentUser } = React.useContext(StateContext);
      const [text, setText] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const send = async () => {
        setBusy(true);
        try {
          await fetch(`${API_BASE}/api/v1/events/client`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'approvals:message', payload: { to: toUserId, text }, userId: currentUser }) });
        } catch {}
        finally { setBusy(false); onClose?.(); }
      };
      return React.createElement('div', { className: 'modal-overlay', onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { className: 'modal-panel' }, [
          React.createElement('div', { key: 'h', className: 'modal-header' }, [
            React.createElement('div', { key: 't', className: 'font-bold' }, 'Message'),
            React.createElement('button', { key: 'x', className: 'ui-modal__close', onClick: onClose }, '✕')
          ]),
          React.createElement('div', { key: 'b', className: 'modal-body' }, [
            React.createElement('div', { key: 'to', className: 'text-sm text-gray-500' }, `To: ${toUserName || toUserId}`),
            React.createElement('textarea', { key: 'm', rows: 4, placeholder: 'Write a message…', value: text, onChange: (e) => setText(e.target.value), className: 'input-padding input-border input-border-radius' })
          ]),
          React.createElement('div', { key: 'f', className: 'modal-footer' }, [
            React.createElement(UIButton, { key: 'cancel', label: 'Cancel', onClick: onClose, disabled: !!busy }),
            React.createElement(UIButton, { key: 'send', label: 'Send', onClick: send, variant: 'primary', disabled: !!busy })
          ])
        ])
      );
    }

    function RequestReviewModal(props) {
      const { onClose } = props || {};
      const API_BASE = getApiBase();
      const { currentUser } = React.useContext(StateContext);
      const [busy, setBusy] = React.useState(false);
      const notify = async () => {
        setBusy(true);
        try { await fetch(`${API_BASE}/api/v1/approvals/notify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: 'default', actorUserId: currentUser }) }); } catch {}
        finally { setBusy(false); onClose?.(); }
      };
      return React.createElement('div', { className: 'modal-overlay', onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { className: 'modal-panel' }, [
          React.createElement('div', { key: 'h', className: 'modal-header' }, [
            React.createElement('div', { key: 't', className: 'font-bold' }, 'Request review'),
            React.createElement('button', { key: 'x', className: 'ui-modal__close', onClick: onClose }, '✕')
          ]),
          React.createElement('div', { key: 'b', className: 'modal-body' }, 'Notify approvers that the document is ready for review?'),
          React.createElement('div', { key: 'f', className: 'modal-footer' }, [
            React.createElement(UIButton, { key: 'cancel', label: 'Cancel', onClick: onClose, disabled: !!busy }),
            React.createElement(UIButton, { key: 'notify', label: 'Notify', onClick: notify, variant: 'primary', disabled: !!busy })
          ])
        ])
      );
    }

    function CompileModal(props) {
      const { onClose } = props || {};
      const API_BASE = getApiBase();
      const [items, setItems] = React.useState([]);
      const [selected, setSelected] = React.useState(new Set());
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState('');
      const [resultUrl, setResultUrl] = React.useState('');
      React.useEffect(() => { (async () => { try { const r = await fetch(`${API_BASE}/api/v1/exhibits`); if (r.ok) { const j = await r.json(); setItems(Array.isArray(j.items) ? j.items.filter(it=>/\.pdf$/i.test(it.name)) : []); } } catch {} })(); }, [API_BASE]);
      const toggle = (name) => setSelected(prev => { const n = new Set(prev); if (n.has(name)) n.delete(name); else n.add(name); return n; });
      const refresh = async () => { try { const r = await fetch(`${API_BASE}/api/v1/exhibits`); if (r.ok) { const j = await r.json(); setItems(Array.isArray(j.items) ? j.items.filter(it=>/\.pdf$/i.test(it.name)) : []); } } catch {} };
      const upload = () => {
        try {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'application/pdf,.pdf';
          input.onchange = async (e) => {
            const file = e.target.files && e.target.files[0]; if (!file) return;
            const fd = new FormData();
            fd.append('file', file, file.name);
            setBusy(true); setError('');
            try {
              const r = await fetch(`${API_BASE}/api/v1/exhibits/upload`, { method: 'POST', body: fd });
              if (!r.ok) throw new Error('upload');
              await refresh();
            } catch { setError('Failed to upload'); }
            finally { setBusy(false); }
          };
          input.click();
        } catch {}
      };
      const compile = async () => {
        setBusy(true); setError(''); setResultUrl('');
        try {
          const exhibits = Array.from(selected.values());
          const r = await fetch(`${API_BASE}/api/v1/compile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exhibits }) });
          if (!r.ok) throw new Error('compile');
          const j = await r.json();
          if (j && j.url) setResultUrl(j.url);
        } catch { setError('Failed to compile'); }
        finally { setBusy(false); }
      };
      React.useEffect(() => {
        if (!resultUrl) return;
        try {
          const href = (/^https?:/i.test(resultUrl)) ? resultUrl : `${API_BASE}${resultUrl.startsWith('/') ? resultUrl : ('/' + resultUrl)}`;
          const a = document.createElement('a');
          a.href = href;
          a.download = 'packet.pdf';
          a.target = '_blank';
          a.rel = 'noopener';
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { try { document.body.removeChild(a); } catch {} }, 0);
        } catch {}
      }, [resultUrl, API_BASE]);
      return React.createElement('div', { className: 'modal-overlay', onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { className: 'modal-panel' }, [
          React.createElement('div', { key: 'h', className: 'modal-header' }, [
            React.createElement('div', { key: 't', className: 'font-bold' }, 'Compile'),
            React.createElement('button', { key: 'x', className: 'ui-modal__close', onClick: onClose }, '✕')
          ]),
          error ? React.createElement('div', { key: 'e', className: 'bg-error-50 text-error-700 p-2 border-t border-b border-error-200' }, error) : null,
          React.createElement('div', { key: 'b', className: 'modal-body d-flex flex-column gap-12' }, [
            React.createElement('div', { key: 'lbl', className: 'font-semibold' }, 'Exhibits'),
            React.createElement('div', { key: 'list', className: 'border border-gray-200 rounded-md p-2 overflow-auto max-h-50' },
              (items.length ? items.map((it, i) => React.createElement('label', { key: i, className: 'd-flex items-center gap-2 p-1' }, [
                React.createElement('input', { type: 'checkbox', checked: selected.has(it.name), onChange: () => toggle(it.name) }),
                React.createElement('span', null, it.name)
              ])) : React.createElement('div', null, '(none)'))
            ),
            resultUrl ? React.createElement('div', { key: 'ok' }, [
              React.createElement('a', { href: resultUrl, target: '_blank', rel: 'noreferrer' }, 'Open compiled PDF')
            ]) : null
          ]),
          React.createElement('div', { key: 'f', className: 'modal-footer' }, [
            React.createElement(UIButton, { key: 'upload', label: 'Upload PDF', onClick: upload, disabled: !!busy }),
            React.createElement(UIButton, { key: 'cancel', label: 'Cancel', onClick: onClose, disabled: !!busy }),
            React.createElement(UIButton, { key: 'go', label: 'Compile', onClick: compile, variant: 'primary', isLoading: !!busy, loadingLabel: 'Compiling…' }),
          ])
        ])
      );
    }

    function OpenGovModal(props) {
      const { onClose } = props || {};
      const { tokens } = React.useContext(ThemeContext);
      const t = tokens && tokens.modal ? tokens.modal : {};
      const ratioWrap = { position: 'relative', paddingTop: '56.25%', borderRadius: '8px', overflow: 'hidden' };
      const ratioInner = { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 };
      // Remove iframe on close to stop playback: unmounting this component achieves that.
      return React.createElement('div', { className: 'modal-overlay', onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { className: 'modal-panel' }, [
          React.createElement('div', { key: 'h', className: 'modal-header' }, [
            React.createElement('div', { key: 't', className: 'font-bold' }, `We're not going back. We're going forward!`),
            React.createElement('button', { key: 'x', className: 'ui-modal__close', onClick: onClose }, '✕')
          ]),
          React.createElement('div', { key: 'b', className: 'modal-body' },
            React.createElement('div', { style: ratioWrap },
              React.createElement('iframe', { style: ratioInner, src: 'https://www.youtube.com/embed/oHg5SJYRHA0?autoplay=1&rel=0&modestbranding=1', title: 'Back to OpenGov', allow: 'autoplay; encrypted-media', allowFullScreen: true })
            )
          )
        ])
      );
    }

    function ConfirmModal(props) {
      const { title, message, onConfirm, onClose } = props || {};
      const { tokens } = React.useContext(ThemeContext);
      const t = tokens && tokens.modal ? tokens.modal : {};
      const btn = (label, variant, onclick) => React.createElement(UIButton, { label, onClick: onclick, variant: variant || 'primary' });
      return React.createElement('div', { className: 'modal-overlay', onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { className: 'modal-panel' }, [
          React.createElement('div', { key: 'h', className: 'modal-header' }, [
            React.createElement('div', { key: 't', className: 'font-bold' }, title || 'Confirm'),
            React.createElement('button', { key: 'x', className: 'ui-modal__close', onClick: onClose }, '✕')
          ]),
          React.createElement('div', { key: 'b', className: 'modal-body' }, message || ''),
          React.createElement('div', { key: 'f', className: 'modal-footer' }, [
            btn('Cancel', 'secondary', onClose),
            btn('Confirm', 'primary', async () => { try { await onConfirm?.(); } finally { onClose?.(); } }),
          ])
        ])
      );
    }

    function ApprovalsPill() {
      const { approvalsSummary } = React.useContext(StateContext);
      if (!approvalsSummary) return null;
      const text = `${approvalsSummary.approved || 0}/${approvalsSummary.total || 0} approved`;
      const open = () => { try { setTimeout(() => { try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'approvals' } })); } catch {} }, 200); } catch {} };
      return React.createElement('button', { className: 'approvals-pill mb-3', onClick: open, title: 'Approvals', type: 'button' }, text);
    }

    function ApprovalsModal(props) {
      const { onClose } = props || {};
      const { currentUser, currentRole, approvalsRevision } = React.useContext(StateContext);
      const API_BASE = getApiBase();
      const [rows, setRows] = React.useState(null);
      const [hdr, setHdr] = React.useState({ approved: 0, total: 0 });
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState('');
      const [prompt, setPrompt] = React.useState(null);
      const load = React.useCallback(async () => {
        try {
          const r = await fetch(`${API_BASE}/api/v1/approvals`);
          if (!r.ok) throw new Error('load');
          const j = await r.json();
          setRows(Array.isArray(j.approvers) ? j.approvers : []);
          setHdr(j.summary || { approved: 0, total: 0 });
        } catch { setError('Failed to load approvals'); }
      }, [API_BASE]);
      React.useEffect(() => { load(); }, [load]);
      React.useEffect(() => { if (approvalsRevision) load(); }, [approvalsRevision, load]);
      const setSelf = async (targetUserId, approved, notes) => {
        setBusy(true); setError('');
        try {
          const body = { documentId: 'default', actorUserId: currentUser, targetUserId, approved: !!approved };
          if (notes !== undefined) body.notes = String(notes);
          const r = await fetch(`${API_BASE}/api/v1/approvals/set`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (!r.ok) throw new Error('set');
          const j = await r.json();
          setRows(Array.isArray(j.approvers) ? j.approvers : []);
          setHdr(j.summary || { approved: 0, total: 0 });
        } catch { setError('Failed to update'); }
        finally { setBusy(false); }
      };
      const doNotify = async () => {
        setBusy(true); setError('');
        try {
          const r = await fetch(`${API_BASE}/api/v1/approvals/notify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: 'default', actorUserId: currentUser }) });
          if (!r.ok) throw new Error('notify');
        } catch { setError('Failed to notify'); }
        finally { setBusy(false); }
      };
      const confirmReset = () => {
        setPrompt({ title: 'Factory reset?', message: 'Reset approvals and working overlays?', onConfirm: async () => {
          setBusy(true); setError('');
          try {
            const r = await fetch(`${API_BASE}/api/v1/factory-reset`, { method: 'POST' });
            if (!r.ok) throw new Error('reset');
            await load();
          } catch { setError('Failed to reset'); }
          finally { setBusy(false); }
        }});
      };
      const btn = (label, onClick, variant) => React.createElement(UIButton, { label, onClick, variant: variant || 'primary' });
      const canOverride = (String(currentRole || '').toLowerCase() === 'editor');
      const canToggle = (row) => canOverride || String(row.userId) === String(currentUser);
      const onToggle = async (row, next) => {
        if (!canToggle(row)) return; // Non-editors cannot toggle others
        if (row.userId !== currentUser && canOverride) {
          setPrompt({ title: 'Override approval?', message: `Override approval for ${row.name}?`, onConfirm: async () => { await setSelf(row.userId, next); } });
          return;
        }
        await setSelf(row.userId, next);
      };
      return React.createElement('div', { className: 'modal-overlay', onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { className: 'modal-panel' }, [
          React.createElement('div', { key: 'h', className: 'modal-header' }, [
            React.createElement('div', { key: 't', className: 'font-bold' }, `Approvals (${hdr.approved}/${hdr.total} approved)`),
            React.createElement('div', { key: 'tb' }, [
              btn('Refresh', load),
              btn('Factory reset', confirmReset),
              btn('Close', onClose),
            ])
          ]),
          error ? React.createElement('div', { key: 'e', className: 'bg-error-50 text-error-700 p-3 border-t border-b border-error-200' }, error) : null,
          React.createElement('div', { key: 'b', className: 'modal-body p-3' }, [
            !rows ? React.createElement('div', null, 'Loading...') :
              React.createElement('table', { className: 'w-full table-collapse' }, [
                React.createElement('thead', { key: 'th' }, React.createElement('tr', null, [
                  React.createElement('th', { key: 'o', className: 'text-left table-cell-padding' }, '#'),
                  React.createElement('th', { key: 'n', className: 'text-left table-cell-padding' }, 'Human'),
                  React.createElement('th', { key: 'a', className: 'text-left table-cell-padding' }, 'Approved'),
                  React.createElement('th', { key: 'm', className: 'text-left table-cell-padding' }, 'Message'),
                  React.createElement('th', { key: 't', className: 'text-left table-cell-padding' }, 'Notes'),
                ])),
                React.createElement('tbody', { key: 'tb' }, (rows||[]).map((r, i) => React.createElement('tr', { key: r.userId || i, className: 'border-t border-gray-200' }, [
                  React.createElement('td', { key: 'o', className: 'table-cell-padding' }, String(r.order || i+1)),
                  React.createElement('td', { key: 'n', className: 'table-cell-padding' }, r.name || r.userId),
                  React.createElement('td', { key: 'a', className: 'table-cell-padding' }, React.createElement('input', { type: 'checkbox', disabled: (!!busy) || (!canToggle(r)), checked: !!r.approved, title: (!canToggle(r) ? 'Only editors can override others' : undefined), onChange: (e) => onToggle(r, !!e.target.checked) })),
                  React.createElement('td', { key: 'm', className: 'table-cell-padding' }, React.createElement(UIButton, { label: 'Message', onClick: () => { try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'message', options: { toUserId: r.userId, toUserName: r.name || r.userId } } })); } catch {} } })),
                  React.createElement('td', { key: 't', className: 'table-cell-padding' }, React.createElement('input', { type: 'text', defaultValue: r.notes || '', onBlur: (e) => setSelf(r.userId, r.approved, e.target.value), className: 'w-full' })),
                ])))
              ])
          ]),
          prompt ? React.createElement(ConfirmModal, { title: prompt.title, message: prompt.message, onConfirm: async () => { try { await prompt.onConfirm?.(); } finally { setPrompt(null); } }, onClose: () => setPrompt(null) }) : null,
        ])
      );
    }

    // Inline Workflow approvals panel (reuses modal logic)
    function WorkflowApprovalsPanel() {
      const { currentUser, currentRole, approvalsRevision, users } = React.useContext(StateContext);
      const API_BASE = getApiBase();
      const [rows, setRows] = React.useState(null);
      const [hdr, setHdr] = React.useState({ approved: 0, total: 0 });
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState('');
      const [prompt, setPrompt] = React.useState(null);
      const load = React.useCallback(async () => {
        try {
          const r = await fetch(`${API_BASE}/api/v1/approvals`);
          if (!r.ok) throw new Error('load');
          const j = await r.json();
          setRows(Array.isArray(j.approvers) ? j.approvers : []);
          setHdr(j.summary || { approved: 0, total: 0 });
        } catch { setError('Failed to load approvals'); }
      }, [API_BASE]);
      React.useEffect(() => { load(); }, [load]);
      React.useEffect(() => { if (approvalsRevision) load(); }, [approvalsRevision, load]);

      const roleOf = (uid) => {
        try { const u = (users || []).find(x => (x && (x.id === uid || x.label === uid))); return (u && (u.role || 'editor')) || 'editor'; } catch { return 'editor'; }
      };
      const titleOf = (uid) => {
        try { const u = (users || []).find(x => (x && (x.id === uid || x.label === uid))); return (u && (u.title || '')) || ''; } catch { return ''; }
      };
      const initialsOf = (label) => {
        try {
          const parts = String(label || '').trim().split(/\s+/).filter(Boolean);
          if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
          if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
          return '';
        } catch { return ''; }
      };

      const canOverride = (String(currentRole || '').toLowerCase() === 'editor');
      const canToggle = (row) => canOverride || String(row.userId) === String(currentUser);
      const setSelf = async (targetUserId, approved, notes) => {
        setBusy(true); setError('');
        try {
          const body = { documentId: 'default', actorUserId: currentUser, targetUserId, approved: !!approved };
          if (notes !== undefined) body.notes = String(notes);
          const r = await fetch(`${API_BASE}/api/v1/approvals/set`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (!r.ok) throw new Error('set');
          const j = await r.json();
          setRows(Array.isArray(j.approvers) ? j.approvers : []);
          setHdr(j.summary || { approved: 0, total: 0 });
        } catch { setError('Failed to update'); }
        finally { setBusy(false); }
      };

      const onToggle = async (row, next) => {
        if (!canToggle(row)) return;
        if (row.userId !== currentUser && canOverride) {
          setPrompt({ title: 'Override approval?', message: `Override approval for ${row.name}?`, onConfirm: async () => { await setSelf(row.userId, next); } });
          return;
        }
        await setSelf(row.userId, next);
      };

      const notify = async () => {
        setBusy(true); setError('');
        try {
          const r = await fetch(`${API_BASE}/api/v1/approvals/notify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: 'default', actorUserId: currentUser }) });
          if (!r.ok) throw new Error('notify');
        } catch { setError('Failed to notify'); }
        finally { setBusy(false); }
      };

      const header = null;

      const list = !rows ? React.createElement('div', null, 'Loading...') : React.createElement('div', { className: 'd-flex flex-column gap-8' },
        rows.map((r, i) => React.createElement('div', { key: r.userId || i, className: 'workflow-card d-flex items-center justify-between' }, [
          React.createElement('div', { key: 'lwrap', className: 'd-flex items-center' }, [
            React.createElement('div', { key: 'av', className: 'avatar-initials', style: { marginRight: 10 } }, initialsOf(r.name || r.userId)),
            React.createElement('div', { key: 'txt', className: 'd-flex flex-column' }, [
              React.createElement('div', { key: 'n', className: 'font-medium' }, r.name || r.userId),
              React.createElement('div', { key: 'tr', className: 'text-sm text-gray-600' }, [titleOf(r.userId), titleOf(r.userId) ? ' • ' : '', (roleOf(r.userId) || '').toString()])
            ])
          ]),
          React.createElement('input', { key: 'c', type: 'checkbox', disabled: (!!busy) || (!canToggle(r)), checked: !!r.approved, onChange: (e) => onToggle(r, !!e.target.checked), title: (!canToggle(r) ? 'Only editors can override others' : undefined) })
        ]))
      );

      return React.createElement('div', null, [
        error ? React.createElement('div', { className: 'bg-error-50 text-error-700 p-2 mb-2 border border-error-200 rounded' }, error) : null,
        header,
        list,
        (prompt ? React.createElement(ConfirmModal, { title: prompt.title, message: prompt.message, onConfirm: async () => { try { await prompt.onConfirm?.(); } finally { setPrompt(null); } }, onClose: () => setPrompt(null) }) : null)
      ]);
    }

    function App(props) {
      console.log('App render');
      const [modal, setModal] = React.useState(null);
      const { config } = props;
      console.log('App props, config:', config);
      const { documentSource, actions, approvalsSummary } = React.useContext(StateContext);
      React.useEffect(() => {
        function onOpen(ev) { try { const d = ev.detail || {}; if (d && (d.id === 'send-vendor' || d.id === 'sendVendor')) setModal({ id: 'send-vendor', userId: d.options?.userId || 'user1' }); if (d && d.id === 'approvals') setModal({ id: 'approvals' }); if (d && d.id === 'compile') setModal({ id: 'compile' }); if (d && d.id === 'notifications') setModal({ id: 'notifications' }); if (d && d.id === 'request-review') setModal({ id: 'request-review' }); if (d && d.id === 'message') setModal({ id: 'message', toUserId: d.options?.toUserId, toUserName: d.options?.toUserName }); if (d && (d.id === 'open-gov' || d.id === 'openGov')) setModal({ id: 'open-gov' }); } catch {} }
        window.addEventListener('react:open-modal', onOpen);
        return () => window.removeEventListener('react:open-modal', onOpen);
      }, []);
  
      const [confirm, setConfirm] = React.useState(null);
      const ask = (kind) => {
        if (kind === 'finalize') setConfirm({ title: 'Finalize?', message: 'This will lock the document.', onConfirm: actions.finalize });
        if (kind === 'unfinalize') setConfirm({ title: 'Unlock?', message: 'This will unlock the document.', onConfirm: actions.unfinalize });
        if (kind === 'reset') setConfirm({ title: 'Factory reset?', message: 'This will clear working data.', onConfirm: actions.factoryReset });
      };

      const onClose = () => setModal(null);
      const onConfirmClose = () => setConfirm(null);

      const renderModal = () => {
        if (!modal) return null;
        switch (modal.id) {
          case 'send-vendor':
            return React.createElement(SendVendorModal, { userId: modal.userId, onClose });
          case 'approvals':
            return React.createElement(ApprovalsModal, { onClose });
          case 'compile':
            return React.createElement(CompileModal, { onClose });
          case 'notifications':
            return React.createElement(NotificationsModal, { onClose });
          case 'request-review':
            return React.createElement(RequestReviewModal, { onClose });
          case 'message':
            return React.createElement(MessageModal, { toUserId: modal.toUserId, toUserName: modal.toUserName, onClose });
          case 'open-gov':
            return React.createElement(OpenGovModal, { onClose });
          default:
            return null;
        }
      };

      const isWordHost = (typeof Office !== 'undefined');
      const topRowStyle = { gap: 5, paddingTop: (isWordHost ? 0 : 8) };
      const topPanel = React.createElement('div', { className: 'panel panel--top' }, [
        React.createElement('div', { className: 'd-flex items-center', style: topRowStyle }, [
          React.createElement(StatusBadge, { key: 'status' }),
          (isWordHost ? React.createElement(UIButton, { key: 'open-og', label: 'Open in OpenGov ↗', onClick: () => { try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'open-gov' } })); } catch {} }, variant: 'tertiary', style: { marginLeft: 'auto' } }) : null),
        ]),
        React.createElement(InlineTitleEditor, { key: 'title' }),
        React.createElement(ErrorBanner, null),
        (typeof Office === 'undefined' ? React.createElement(SuperDocHost, { key: 'host', src: documentSource }) : null),
        React.createElement('div', { className: '', style: { marginTop: 8 } }, [
          React.createElement('div', { className: 'd-flex items-center gap-8 flex-wrap' }, [
            React.createElement(LastUpdatedPrefix, { key: 'last' }),
            React.createElement(UserCard, { key: 'user' }),
          ]),
        ]),
        React.createElement('div', { className: 'pt-2', style: { paddingTop: 8, marginTop: 0 } }, [
          React.createElement(ActionButtons, { key: 'actions' }),
        ]),
      ]);

      // Bottom section: two tabs - AI and Workflow
      const [activeTab, setActiveTab] = React.useState('AI');
      const [underline, setUnderline] = React.useState({ left: 0, width: 0 });
      const tabbarRef = React.useRef(null);
      const aiLabelRef = React.useRef(null);
      const wfLabelRef = React.useRef(null);
      const msgLabelRef = React.useRef(null);
      const verLabelRef = React.useRef(null);
      const actLabelRef = React.useRef(null);

      const recalcUnderline = React.useCallback(() => {
        try {
          const bar = tabbarRef.current;
          const labelEl = (activeTab === 'AI'
            ? aiLabelRef.current
            : (activeTab === 'Workflow'
              ? wfLabelRef.current
              : (activeTab === 'Messaging'
                ? msgLabelRef.current
                : (activeTab === 'Versions' ? verLabelRef.current : actLabelRef.current))));
          if (!bar || !labelEl) return;
          const barRect = bar.getBoundingClientRect();
          const labRect = labelEl.getBoundingClientRect();
          const width = Math.max(24, Math.round(labRect.width));
          const left = Math.round((labRect.left - barRect.left) + (labRect.width / 2) - (width / 2));
          setUnderline({ left, width });
        } catch {}
      }, [activeTab]);

      React.useEffect(() => { recalcUnderline(); }, [recalcUnderline]);
      // Recalculate underline if the Workflow tab label width changes due to summary updates
      React.useEffect(() => { recalcUnderline(); }, [approvalsSummary, recalcUnderline]);
      React.useEffect(() => {
        const onResize = () => recalcUnderline();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
      }, [recalcUnderline]);

      const Tabs = React.createElement('div', { className: 'mt-3 pt-2' }, [
        React.createElement('div', { key: 'tabbar', ref: tabbarRef, className: 'd-flex items-center gap-16 border-b border-gray-200', style: { position: 'relative', padding: '0 8px' } }, [
          React.createElement('button', {
            key: 'tab-ai',
            className: activeTab === 'AI' ? 'tab tab--active' : 'tab',
            onClick: () => setActiveTab('AI'),
            style: { background: 'transparent', border: 'none', padding: '10px 8px', cursor: 'pointer', color: activeTab === 'AI' ? '#111827' : '#6B7280', fontWeight: 600 }
          }, React.createElement('span', { ref: aiLabelRef, style: { display: 'inline-block' } }, 'AI')),
          React.createElement('button', {
            key: 'tab-workflow',
            className: activeTab === 'Workflow' ? 'tab tab--active' : 'tab',
            onClick: () => setActiveTab('Workflow'),
            style: { background: 'transparent', border: 'none', padding: '10px 8px', cursor: 'pointer', color: activeTab === 'Workflow' ? '#111827' : '#6B7280', fontWeight: 600 }
          }, React.createElement('span', { ref: wfLabelRef, style: { display: 'inline-block' } }, [
            'Workflow',
            (approvalsSummary && typeof approvalsSummary.total === 'number'
              ? ` (${approvalsSummary.approved || 0}/${approvalsSummary.total})`
              : '')
          ])),
          React.createElement('button', {
            key: 'tab-messaging',
            className: activeTab === 'Messaging' ? 'tab tab--active' : 'tab',
            onClick: () => setActiveTab('Messaging'),
            style: { background: 'transparent', border: 'none', padding: '10px 8px', cursor: 'pointer', color: activeTab === 'Messaging' ? '#111827' : '#6B7280', fontWeight: 600 }
          }, React.createElement('span', { ref: msgLabelRef, style: { display: 'inline-block' } }, 'Messaging')),
          React.createElement('button', {
            key: 'tab-versions',
            className: activeTab === 'Versions' ? 'tab tab--active' : 'tab',
            onClick: () => setActiveTab('Versions'),
            style: { background: 'transparent', border: 'none', padding: '10px 8px', cursor: 'pointer', color: activeTab === 'Versions' ? '#111827' : '#6B7280', fontWeight: 600 }
          }, React.createElement('span', { ref: verLabelRef, style: { display: 'inline-block' } }, 'Versions')),
          React.createElement('button', {
            key: 'tab-activity',
            className: activeTab === 'Activity' ? 'tab tab--active' : 'tab',
            onClick: () => setActiveTab('Activity'),
            style: { background: 'transparent', border: 'none', padding: '10px 8px', cursor: 'pointer', color: activeTab === 'Activity' ? '#111827' : '#6B7280', fontWeight: 600 }
          }, React.createElement('span', { ref: actLabelRef, style: { display: 'inline-block' } }, 'Activity')),
          React.createElement('div', { key: 'underline', style: { position: 'absolute', bottom: -1, left: underline.left, width: underline.width, height: 2, background: '#6d5ef1', transition: 'left 150ms ease, width 150ms ease' } })
        ]),
        React.createElement('div', { key: 'tabbody', className: 'mt-3' }, [
          React.createElement('div', { key: 'wrap-ai', style: { display: (activeTab === 'AI' ? 'block' : 'none') } }, React.createElement(ChatConsole, { key: 'chat' })),
          React.createElement('div', { key: 'wrap-workflow', style: { display: (activeTab === 'Workflow' ? 'block' : 'none') } }, React.createElement(WorkflowApprovalsPanel, { key: 'workflow' })),
          React.createElement('div', { key: 'wrap-messaging', style: { display: (activeTab === 'Messaging' ? 'block' : 'none') } }, React.createElement(MessagingPanel, { key: 'messaging' })),
          React.createElement('div', { key: 'wrap-versions', style: { display: (activeTab === 'Versions' ? 'block' : 'none') } }, React.createElement(VersionsPanel, { key: 'versions' })),
          React.createElement('div', { key: 'wrap-activity', style: { display: (activeTab === 'Activity' ? 'block' : 'none') } }, React.createElement(ActivityPanel, { key: 'activity' })),
        ])
      ]);

      const assistantPanel = React.createElement('div', { className: 'panel panel--assistant' }, [
        Tabs,
        renderModal(),
        (confirm ? React.createElement(ConfirmModal, { title: confirm.title, message: confirm.message, onConfirm: confirm.onConfirm, onClose: onConfirmClose }) : null)
      ]);

      return React.createElement(ThemeProvider, null, React.createElement(React.Fragment, null, [topPanel, assistantPanel]));
    }

    const root = ReactDOM.createRoot(rootEl);
    root.render(React.createElement(StateProvider, null));
  }

  try {
    win.mountReactApp = mountReactApp;
    win.openReactModal = function(id, options) {
      try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id, options: options || {} } })); } catch {}
    };
  } catch (_) {}
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));


