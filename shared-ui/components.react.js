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
    const StateContext = React.createContext({
      config: null,
      revision: 0,
      actions: {},
      isConnected: false,
      lastTs: 0,
      currentUser: 'user1',
      currentRole: 'editor',
      users: [],
      setUser: () => {},
      logs: [],
      addLog: () => {},
      lastSeenLogCount: 0,
      markNotificationsSeen: () => {},
      documentSource: null,
      setDocumentSource: () => {},
      lastError: null,
      setLastError: () => {},
      approvalsSummary: null,
      approvalsRevision: 0,
    });

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
      const { label, onClick, variant = 'primary', disabled = false, isLoading = false, style = {} } = props || {};
      const [pressed, setPressed] = React.useState(false);
      const [loading, setLoading] = React.useState(false);
      const busy = !!isLoading || loading;
      const className = `btn btn--${variant}`;
      const visual = Object.assign({ margin: '4px', opacity: disabled ? 0.6 : 1 }, style);
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

      const addLog = React.useCallback((m) => {
        try {
          const ts = new Date().toLocaleTimeString();
          setLogs((prev) => prev.concat(`[${ts}] ${m}`));
        } catch {}
      }, []);

      const markNotificationsSeen = React.useCallback(() => {
        try { setLastSeenLogCount((logs || []).length); } catch {}
      }, [logs]);

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
          addLog(`doc choose ERR ${e?.message||e}`);
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
          sse.onopen = () => { setIsConnected(true); addLog('SSE open'); };
          sse.onmessage = (ev) => {
            try {
              addLog(`SSE ${ev.data}`);
              const p = JSON.parse(ev.data);
              if (p && p.ts) setLastTs(p.ts);
              const nextRev = (typeof p.revision === 'number') ? p.revision : null;
              if (nextRev !== null) setRevision(nextRev);
              if (p && p.type === 'approvals:update') {
                if (typeof p.revision === 'number') setApprovalsRevision(p.revision);
                if (p.summary) setApprovalsSummary(p.summary);
              }
              // Do not auto-refresh document on save/revert; show banner via state-matrix
              refresh();
            } catch {}
          };
          sse.onerror = () => { setIsConnected(false); addLog('SSE error'); };
        } catch {}
        return () => { try { sse && sse.close(); } catch {} };
      }, [API_BASE, refresh, addLog]);

      const addError = React.useCallback((err) => {
        try { setLastError(err || null); if (err && err.message) addLog(`ERR ${err.message}`); } catch {}
      }, [addLog]);

      // Compute initial document source on web (prefer working overlay)
      React.useEffect(() => {
        if (typeof Office !== 'undefined') return; // Word path handles separately
        (async () => {
          try {
            const src = await choosePreferredDocUrl(Date.now());
            setDocumentSource(src);
            addLog(`doc src set ${src}`);
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
          addLog('web_save ERR export_unavailable');
          throw new Error('export_unavailable');
        }
        const b64 = await window.superdocAPI.export('docx');
        const size = (() => { try { return atob(b64 || '').length; } catch { return 0; } })();
        const pk = (() => { try { const u = new Uint8Array(atob(b64||'').split('').map(c=>c.charCodeAt(0))); return u[0]===0x50 && u[1]===0x4b; } catch { return false; } })();
        addLog(`web_save export size=${size} pk=${pk}`);
        if (!b64 || size < 1024 || !pk) {
          addLog('web_save ERR export_invalid');
          throw new Error('export_invalid');
        }
        const r = await fetch(`${API_BASE}/api/v1/save-progress`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, base64: b64, platform: 'web' }) });
        if (!r.ok) {
          let msg = '';
          try { const j = await r.json(); msg = j && (j.error || j.message) || ''; } catch { try { msg = await r.text(); } catch {} }
          addLog(`web_save ERR save-progress ${r.status} ${msg}`.trim());
          throw new Error(`save-progress ${r.status} ${msg}`.trim());
        }
        addLog('web_save OK');
      }

      const actions = React.useMemo(() => ({
        finalize: async () => { try { await fetch(`${API_BASE}/api/v1/finalize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); addLog('finalize OK'); await refresh(); } catch (e) { addLog(`finalize ERR ${e?.message||e}`); } },
        unfinalize: async () => { try { await fetch(`${API_BASE}/api/v1/unfinalize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); addLog('unfinalize OK'); await refresh(); } catch (e) { addLog(`unfinalize ERR ${e?.message||e}`); } },
        checkout: async () => { try { await fetch(`${API_BASE}/api/v1/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); addLog('checkout OK'); await refresh(); } catch (e) { addLog(`checkout ERR ${e?.message||e}`); } },
        checkin: async () => { try { await fetch(`${API_BASE}/api/v1/checkin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); addLog('checkin OK'); await refresh(); } catch (e) { addLog(`checkin ERR ${e?.message||e}`); } },
        cancel: async () => { try { await fetch(`${API_BASE}/api/v1/checkout/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); addLog('cancel checkout OK'); await refresh(); } catch (e) { addLog(`cancel checkout ERR ${e?.message||e}`); } },
        override: async () => { try { await fetch(`${API_BASE}/api/v1/checkout/override`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); addLog('override OK'); await refresh(); } catch (e) { addLog(`override ERR ${e?.message||e}`); } },
        factoryReset: async () => { try { await fetch(`${API_BASE}/api/v1/factory-reset`, { method: 'POST' }); addLog('factory reset OK'); await refresh(); } catch (e) { addLog(`factory reset ERR ${e?.message||e}`); } },
        sendVendor: (opts) => { try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'send-vendor', options: { userId, ...(opts||{}) } } })); } catch {} },
        saveProgress: async () => { try { if (typeof Office !== 'undefined') { await saveProgressWord(); } else { await saveProgressWebViaDownload(); } addLog('save progress OK'); await refresh(); return true; } catch (e) { addLog(`save progress ERR ${e?.message||e}`); return false; } },
        setUser: (nextUserId, nextRole) => { try { setUserId(nextUserId); if (nextRole) setRole(nextRole); addLog(`user set to ${nextUserId}`); } catch {} },
      }), [API_BASE, refresh, userId, addLog]);

      return React.createElement(StateContext.Provider, { value: { config, revision, actions, isConnected, lastTs, currentUser: userId, currentRole: role, users, logs, addLog, lastSeenLogCount, markNotificationsSeen, documentSource, setDocumentSource, lastError, setLastError: addError, loadedVersion, setLoadedVersion, dismissedVersion, setDismissedVersion, approvalsSummary, approvalsRevision } }, props.children);
    }

    function BannerStack() {
      const { tokens } = React.useContext(ThemeContext);
      const { config, loadedVersion, setLoadedVersion, dismissedVersion, setDismissedVersion, revision, addLog, setDocumentSource } = React.useContext(StateContext);
      const banners = Array.isArray(config?.banners) ? config.banners : [];
      const API_BASE = getApiBase();
      const show = (b) => {
        if (!b || b.state !== 'update_available') return true;
        const serverVersion = Number(config?.documentVersion || 0);
        if (dismissedVersion && dismissedVersion >= serverVersion) return false;
        if (loadedVersion && loadedVersion >= serverVersion) return false;
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
      return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' } },
        banners.filter(show).map((b, i) => {
          const t = (tokens && tokens.banner && b && b.state) ? tokens.banner[b.state] : null;
          const style = {
            marginTop: '0px',
            background: (t && (t.pillBg || t.bg)) || '#eef2ff',
            color: (t && (t.pillFg || t.fg)) || '#1e3a8a',
            border: `1px solid ${((t && (t.pillBg || t.bg)) || '#c7d2fe')}`,
            borderRadius: '6px', padding: '3px 8px', fontWeight: 600, width: '90%', textAlign: 'center'
          };
          const text = (b && b.title && b.message) ? `${b.title}: ${b.message}` : (b?.title || '');
          return React.createElement('div', { key: `b-${i}`, style }, text);
        })
      );
    }

    function ConnectionBadge() {
      const { isConnected, lastTs } = React.useContext(StateContext);
      const when = lastTs ? new Date(lastTs).toLocaleTimeString() : '—';
      const style = { marginLeft: '8px', padding: '2px 6px', border: '1px solid #ddd', borderRadius: '10px', fontSize: '12px', background: isConnected ? '#f86a0b' : '#fff5f5' };
      return React.createElement('div', { style }, isConnected ? `connected • last: ${when}` : 'disconnected');
    }

    function ActionButtons() {
      const { config, actions } = React.useContext(StateContext);
      const [confirm, setConfirm] = React.useState(null);
      const { tokens } = React.useContext(ThemeContext);
      const btns = (config && config.buttons) ? config.buttons : {};
      const ask = (title, message, onConfirm) => setConfirm({ title, message, onConfirm });
      const uniformBtnStyle = { width: '100%', minHeight: '36px' };
      const add = (label, onClick, show, variant, opts = {}) => show
        ? React.createElement(UIButton, Object.assign({ key: label, label, onClick, variant: variant || (label && /^(Check\-in|Save Progress|Cancel Checkout|Override Checkout)/i.test(label) ? 'secondary' : 'primary'), style: Object.assign({}, uniformBtnStyle, opts.style || {}) }, opts))
        : null;

      // Top: checkout cluster only
      const topCluster = [
        add('Checkout', actions.checkout, !!btns.checkoutBtn),
        add('Check-in and Save', async () => { try { const ok = await actions.saveProgress(); if (ok) { await actions.checkin(); } } catch {} }, !!btns.checkinBtn),
        add('Cancel Checkout', actions.cancel, !!btns.cancelBtn),
        add('Save Progress', actions.saveProgress, !!btns.saveProgressBtn),
        add('Override Checkout', actions.override, !!btns.overrideBtn),
      ].filter(Boolean);

      // Bottom: all other actions, in a uniform grid
      const bottomGrid = [
        add('Finalize', () => ask('Finalize?', 'This will lock the document.', actions.finalize), !!btns.finalizeBtn, 'primary'),
        add('Unfinalize', () => ask('Unlock?', 'This will unlock the document.', actions.unfinalize), !!btns.unfinalizeBtn),
        add('Send to Vendor', () => { try { setTimeout(() => { try { actions.sendVendor({}); } catch {} }, 130); } catch {} }, !!btns.sendVendorBtn),
        add('Back to OpenGov', () => { try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'open-gov' } })); } catch {} }, !!btns.openGovBtn, 'primary'),
        add('Request review', () => { try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'request-review' } })); } catch {} }, true, 'primary'),
        add('Compile', () => { try { setTimeout(() => { try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'compile' } })); } catch {} }, 130); } catch {} }, true, 'primary'),
        add('Factory Reset', () => ask('Factory reset?', 'This will clear working data.', actions.factoryReset), true),
      ].filter(Boolean);

      return React.createElement(React.Fragment, null,
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' } }, topCluster),
        React.createElement('div', { style: { height: '8px' } }),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' } }, bottomGrid),
        confirm ? React.createElement(ConfirmModal, { title: confirm.title, message: confirm.message, onConfirm: confirm.onConfirm, onClose: () => setConfirm(null) }) : null
      );
    }

    function ExhibitsList() {
      const API_BASE = getApiBase();
      const [items, setItems] = React.useState([]);
      const refresh = React.useCallback(async () => { try { const r = await fetch(`${API_BASE}/api/v1/exhibits`); if (r.ok) { const j = await r.json(); setItems(Array.isArray(j.items) ? j.items : []); } } catch {} }, [API_BASE]);
      React.useEffect(() => { refresh(); }, [refresh]);
      return React.createElement('div', null,
        React.createElement('div', { style: { fontWeight: 600, marginTop: '8px' } }, 'Exhibits'),
        items.length ? React.createElement('ul', null, items.map((it, i) => React.createElement('li', { key: i }, React.createElement('a', { href: it.url, target: '_blank' }, it.name)))) : React.createElement('div', null, '(none)')
      );
    }

    function NotificationsPanel() {
      const { logs } = React.useContext(StateContext);
      const copy = async () => {
        try {
          const text = (logs || []).slice().reverse().join('\n');
          if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(text);
        } catch {}
      };
      const btn = React.createElement(UIButton, { label: 'Copy', onClick: copy, style: { alignSelf: 'flex-end', marginBottom: '4px' } });
      const box = React.createElement('div', { style: { fontFamily: 'Consolas, monospace', whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', maxHeight: '320px', overflow: 'auto' } }, (logs || []).slice().reverse().join('\n'));
      return React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } }, [btn, box]);
    }

    // Notifications bell (standard icon) that opens a modal
    function NotificationsBell() {
      const { logs, lastSeenLogCount } = React.useContext(StateContext);
      const total = (logs || []).length;
      const unseen = Math.max(0, total - (lastSeenLogCount || 0));
      const open = () => { try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'notifications' } })); } catch {} };
      const style = { position: 'relative', cursor: 'pointer', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '999px', background: '#fff' };
      const badge = unseen ? React.createElement('span', { style: { position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', color: '#fff', borderRadius: '999px', fontSize: '10px', padding: '0 6px', lineHeight: '16px', height: '16px', minWidth: '16px', textAlign: 'center' } }, String(unseen)) : null;
      return React.createElement('span', { style, onClick: open, title: 'Notifications' }, ['🔔', badge]);
    }

    function NotificationsModal(props) {
      const { onClose } = props || {};
      const { tokens } = React.useContext(ThemeContext);
      const { logs, markNotificationsSeen } = React.useContext(StateContext);
      const t = tokens && tokens.modal ? tokens.modal : {};
      const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 };
      const panelStyle = { width: '640px', maxWidth: '95vw', background: t.background || '#fff', border: `1px solid ${t.border || '#e5e7eb'}`, borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' };
      const headerStyle = { padding: '14px 16px', borderBottom: `1px solid ${t.border || '#e5e7eb'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.headerBg || '#fff', color: t.headerFg || '#111827' };
      const bodyStyle = { padding: '16px' };
      const footerStyle = { padding: '12px 16px', borderTop: `1px solid ${t.border || '#e5e7eb'}`, display: 'flex', justifyContent: 'flex-end', gap: '8px' };
      const copy = async () => { try { const text = (logs || []).slice().reverse().join('\n'); if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(text); } catch {} };
      const list = React.createElement('div', { style: { fontFamily: 'Consolas, monospace', whiteSpace: 'pre-wrap', background: '#f9fafb', padding: '8px', border: `1px solid ${t.border || '#e5e7eb'}`, borderRadius: '6px', maxHeight: '420px', overflow: 'auto' } }, (logs || []).slice().reverse().join('\n'));
      const button = (label, variant, onclick) => React.createElement(UIButton, { label, onClick: onclick, variant: variant || 'primary' });
      React.useEffect(() => { try { markNotificationsSeen?.(); } catch {} }, [markNotificationsSeen]);

      return React.createElement('div', { style: overlayStyle, onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { style: panelStyle }, [
          React.createElement('div', { key: 'h', style: headerStyle }, [
            React.createElement('div', { key: 't', style: { fontWeight: 700 } }, 'Notifications'),
            React.createElement('button', { key: 'x', onClick: onClose, style: { border: 'none', background: 'transparent' } }, '✕')
          ]),
          React.createElement('div', { key: 'b', style: bodyStyle }, list),
          React.createElement('div', { key: 'f', style: footerStyle }, [
            button('Copy', 'secondary', copy),
            button('Close', 'primary', () => { try { markNotificationsSeen?.(); } finally { onClose?.(); } }),
          ])
        ])
      );
    }

    function ChatConsole() {
      const API_BASE = getApiBase();
      const { currentUser } = React.useContext(StateContext);
      const [messages, setMessages] = React.useState(["Hi, I'm OG Assist. How can I help you?"]);
      const [text, setText] = React.useState('');
      const send = async () => {
        const t = (text || '').trim();
        if (!t) return;
        setMessages((m) => m.concat(t));
        setText('');
        try {
          await fetch(`${API_BASE}/api/v1/events/client`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'chat', payload: { text: t }, userId: currentUser, platform: 'web' }) });
        } catch {}
      };
      const box = React.createElement('div', { style: { border: '1px solid #ddd', borderRadius: '6px', padding: '8px', height: '120px', overflow: 'auto', background: '#fff' } }, messages.map((m, i) => React.createElement('div', { key: i, style: { marginTop: i ? '6px' : 0 } }, m)));
      const input = React.createElement('input', { type: 'text', value: text, onChange: (e) => setText(e.target.value), placeholder: 'Type a message...', style: { flex: 1, padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' } });
      const btn = React.createElement(UIButton, { label: 'Send', onClick: send });
      const row = React.createElement('div', { style: { display: 'flex', gap: '8px' } }, [input, btn]);
      const wrap = React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, [box, row]);
      return React.createElement('div', null, [React.createElement('div', { key: 'hdr', style: { fontWeight: 600 } }, 'Assistant'), wrap]);
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
      const pill = React.createElement('span', { className: 'ui-pill' }, (currentRole || 'editor').toUpperCase());
      const select = React.createElement('select', { value: selected || '', onChange, style: { marginLeft: '8px' } }, (users || []).map((u, i) => React.createElement('option', { key: i, value: u.id || u.label }, u.label || u.id)));
      return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [pill, select]);
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
      const btn = (label, onClick, variant) => React.createElement(UIButton, { label, onClick, variant: variant || 'primary', style: { width: '100%', minHeight: '36px' } });
      return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' } }, [btn('Open New Document', openNew), btn('View Latest', viewLatest)]);
    }

    function ErrorBanner() {
      const { lastError } = React.useContext(StateContext);
      if (!lastError) return null;
      const msg = lastError.message || 'An error occurred';
      const detail = lastError.url ? ` url=${lastError.url}` : '';
      const status = lastError.status ? ` status=${lastError.status}` : '';
      return React.createElement('div', { style: { margin: '8px 0', padding: '8px', border: '1px solid #fca5a5', background: '#fee2e2', color: '#7f1d1d', borderRadius: '6px' } }, `Error: ${msg}${status}${detail}`);
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
      const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 };
      const panelStyle = { width: (schema.style?.width || 720) + 'px', maxWidth: '95vw', background: t.background || '#fff', border: `1px solid ${t.border || '#e5e7eb'}`, borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' };
      const headerStyle = { padding: '14px 16px', borderBottom: `1px solid ${t.border || '#e5e7eb'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.headerBg || '#fff', color: t.headerFg || '#111827' };
      const bodyStyle = { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' };
      const footerStyle = { padding: '12px 16px', borderTop: `1px solid ${t.border || '#e5e7eb'}`, display: 'flex', justifyContent: 'flex-end', gap: '8px' };

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

      return React.createElement('div', { style: overlayStyle, onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { style: panelStyle }, [
          React.createElement('div', { key: 'h', style: headerStyle }, [
            React.createElement('div', { key: 't', style: { fontWeight: 700 } }, schema.title || 'Modal'),
            React.createElement('button', { key: 'x', onClick: () => onClose?.(), style: { border: 'none', background: 'transparent' } }, '✕')
          ]),
          React.createElement('div', { key: 'b', style: bodyStyle }, [
            schema.description ? React.createElement('div', { key: 'd', style: { color: t.muted || '#6b7280' } }, schema.description) : null,
            React.createElement('div', { key: 'f', style: { display: 'grid', gridTemplateColumns: '1fr', gap: '12px' } },
              (Array.isArray(schema.fields) ? schema.fields : []).map((f, i) => React.createElement('div', { key: `r-${i}`, style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, [
                React.createElement('label', { key: 'l', style: { fontSize: '12px', color: t.muted || '#6b7280' } }, f.label || f.name),
                (f.type === 'textarea'
                  ? React.createElement('textarea', { key: 'i', rows: 4, placeholder: f.placeholder || '', defaultValue: f.value || '', maxLength: f.maxLength || undefined, style: { padding: '8px', border: `1px solid ${t.border || '#e5e7eb'}`, borderRadius: '6px' }, onChange: (e) => setField(f.name, e.target.value) })
                  : React.createElement('input', { key: 'i', type: 'text', placeholder: f.placeholder || '', defaultValue: f.value || '', style: { padding: '8px', border: `1px solid ${t.border || '#e5e7eb'}`, borderRadius: '6px' }, onChange: (e) => setField(f.name, e.target.value) })
                )
              ]))
            )
          ]),
          React.createElement('div', { key: 'f2', style: footerStyle },
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
      const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 };
      const panelStyle = { width: '520px', maxWidth: '95vw', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' };
      const headerStyle = { padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', color: '#111827' };
      const bodyStyle = { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' };
      const footerStyle = { padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '8px' };
      const send = async () => {
        setBusy(true);
        try {
          await fetch(`${API_BASE}/api/v1/events/client`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'approvals:message', payload: { to: toUserId, text }, userId: currentUser }) });
        } catch {}
        finally { setBusy(false); onClose?.(); }
      };
      return React.createElement('div', { style: overlayStyle, onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { style: panelStyle }, [
          React.createElement('div', { key: 'h', style: headerStyle }, [
            React.createElement('div', { key: 't', style: { fontWeight: 700 } }, 'Message'),
            React.createElement('button', { key: 'x', onClick: onClose, style: { border: 'none', background: 'transparent' } }, '✕')
          ]),
          React.createElement('div', { key: 'b', style: bodyStyle }, [
            React.createElement('div', { key: 'to', style: { fontSize: '12px', color: '#6b7280' } }, `To: ${toUserName || toUserId}`),
            React.createElement('textarea', { key: 'm', rows: 4, placeholder: 'Write a message…', value: text, onChange: (e) => setText(e.target.value), style: { padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' } })
          ]),
          React.createElement('div', { key: 'f', style: footerStyle }, [
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
      const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 };
      const panelStyle = { width: '520px', maxWidth: '95vw', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' };
      const headerStyle = { padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', color: '#111827' };
      const bodyStyle = { padding: '16px' };
      const footerStyle = { padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '8px' };
      const notify = async () => {
        setBusy(true);
        try { await fetch(`${API_BASE}/api/v1/approvals/notify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: 'default', actorUserId: currentUser }) }); } catch {}
        finally { setBusy(false); onClose?.(); }
      };
      return React.createElement('div', { style: overlayStyle, onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { style: panelStyle }, [
          React.createElement('div', { key: 'h', style: headerStyle }, [
            React.createElement('div', { key: 't', style: { fontWeight: 700 } }, 'Request review'),
            React.createElement('button', { key: 'x', onClick: onClose, style: { border: 'none', background: 'transparent' } }, '✕')
          ]),
          React.createElement('div', { key: 'b', style: bodyStyle }, 'Notify approvers that the document is ready for review?'),
          React.createElement('div', { key: 'f', style: footerStyle }, [
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
      const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 };
      const panelStyle = { width: '720px', maxWidth: '95vw', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' };
      const headerStyle = { padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', color: '#111827' };
      const bodyStyle = { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' };
      const footerStyle = { padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '8px' };
      return React.createElement('div', { style: overlayStyle, onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { style: panelStyle }, [
          React.createElement('div', { key: 'h', style: headerStyle }, [
            React.createElement('div', { key: 't', style: { fontWeight: 700 } }, 'Compile'),
            React.createElement('button', { key: 'x', onClick: onClose, style: { border: 'none', background: 'transparent' } }, '✕')
          ]),
          error ? React.createElement('div', { key: 'e', style: { color: '#7f1d1d', background: '#fee2e2', padding: '8px 12px', borderTop: '1px solid #fecaca', borderBottom: '1px solid #fecaca' } }, error) : null,
          React.createElement('div', { key: 'b', style: bodyStyle }, [
            React.createElement('div', { key: 'lbl', style: { fontWeight: 600 } }, 'Exhibits'),
            React.createElement('div', { key: 'list', style: { border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px', maxHeight: '200px', overflow: 'auto' } },
              (items.length ? items.map((it, i) => React.createElement('label', { key: i, style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px' } }, [
                React.createElement('input', { type: 'checkbox', checked: selected.has(it.name), onChange: () => toggle(it.name) }),
                React.createElement('span', null, it.name)
              ])) : React.createElement('div', null, '(none)'))
            ),
            resultUrl ? React.createElement('div', { key: 'ok' }, [
              React.createElement('a', { href: resultUrl, target: '_blank', rel: 'noreferrer' }, 'Open compiled PDF')
            ]) : null
          ]),
          React.createElement('div', { key: 'f', style: footerStyle }, [
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
      const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 };
      const panelStyle = { width: '720px', maxWidth: '95vw', background: t.background || '#fff', border: `1px solid ${t.border || '#e5e7eb'}`, borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' };
      const headerStyle = { padding: '14px 16px', borderBottom: `1px solid ${t.border || '#e5e7eb'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.headerBg || '#fff', color: t.headerFg || '#111827' };
      const bodyStyle = { padding: '0 16px 16px' };
      const ratioWrap = { position: 'relative', paddingTop: '56.25%', borderRadius: '8px', overflow: 'hidden' };
      const ratioInner = { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 };
      // Remove iframe on close to stop playback: unmounting this component achieves that.
      return React.createElement('div', { style: overlayStyle, onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { style: panelStyle }, [
          React.createElement('div', { key: 'h', style: headerStyle }, [
            React.createElement('div', { key: 't', style: { fontWeight: 700 } }, `We're not going back. We're going forward!`),
            React.createElement('button', { key: 'x', onClick: onClose, style: { border: 'none', background: 'transparent' } }, '✕')
          ]),
          React.createElement('div', { key: 'b', style: bodyStyle },
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
      const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 };
      const panelStyle = { width: '520px', maxWidth: '95vw', background: t.background || '#fff', border: `1px solid ${t.border || '#e5e7eb'}`, borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' };
      const headerStyle = { padding: '14px 16px', borderBottom: `1px solid ${t.border || '#e5e7eb'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.headerBg || '#fff', color: t.headerFg || '#111827' };
      const bodyStyle = { padding: '16px' };
      const footerStyle = { padding: '12px 16px', borderTop: `1px solid ${t.border || '#e5e7eb'}`, display: 'flex', justifyContent: 'flex-end', gap: '8px' };
      const btn = (label, variant, onclick) => React.createElement(UIButton, { label, onClick: onclick, variant: variant || 'primary' });
      return React.createElement('div', { style: overlayStyle, onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { style: panelStyle }, [
          React.createElement('div', { key: 'h', style: headerStyle }, [
            React.createElement('div', { key: 't', style: { fontWeight: 700 } }, title || 'Confirm'),
            React.createElement('button', { key: 'x', onClick: onClose, style: { border: 'none', background: 'transparent' } }, '✕')
          ]),
          React.createElement('div', { key: 'b', style: bodyStyle }, message || ''),
          React.createElement('div', { key: 'f', style: footerStyle }, [
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
      const style = { background: '#e0e7ff', color: '#1e3a8a', border: '1px solid #c7d2fe', borderRadius: '999px', padding: '2px 8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' };
      const open = () => { try { setTimeout(() => { try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'approvals' } })); } catch {} }, 200); } catch {} };
      return React.createElement('span', { style, onClick: open, title: 'Approvals' }, text);
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
      const headerStyle = { padding: '10px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' };
      const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 };
      const panelStyle = { width: '780px', maxWidth: '95vw', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' };
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
      return React.createElement('div', { style: overlayStyle, onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { style: panelStyle }, [
          React.createElement('div', { key: 'h', style: headerStyle }, [
            React.createElement('div', { key: 't', style: { fontWeight: 700 } }, `Approvals (${hdr.approved}/${hdr.total} approved)`),
            React.createElement('div', { key: 'tb' }, [
              btn('Refresh', load),
              btn('Factory reset', confirmReset),
              btn('Close', onClose),
            ])
          ]),
          error ? React.createElement('div', { key: 'e', style: { color: '#7f1d1d', background: '#fee2e2', padding: '8px 12px', borderTop: '1px solid #fecaca', borderBottom: '1px solid #fecaca' } }, error) : null,
          React.createElement('div', { key: 'b', style: { padding: '12px' } }, [
            !rows ? React.createElement('div', null, 'Loading...') :
              React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse' } }, [
                React.createElement('thead', { key: 'th' }, React.createElement('tr', null, [
                  React.createElement('th', { key: 'o', style: { textAlign: 'left', padding: '6px' } }, '#'),
                  React.createElement('th', { key: 'n', style: { textAlign: 'left', padding: '6px' } }, 'Human'),
                  React.createElement('th', { key: 'a', style: { textAlign: 'left', padding: '6px' } }, 'Approved'),
                  React.createElement('th', { key: 'm', style: { textAlign: 'left', padding: '6px' } }, 'Message'),
                  React.createElement('th', { key: 't', style: { textAlign: 'left', padding: '6px' } }, 'Notes'),
                ])),
                React.createElement('tbody', { key: 'tb' }, (rows||[]).map((r, i) => React.createElement('tr', { key: r.userId || i, style: { borderTop: '1px solid #eee' } }, [
                  React.createElement('td', { key: 'o', style: { padding: '6px' } }, String(r.order || i+1)),
                  React.createElement('td', { key: 'n', style: { padding: '6px' } }, r.name || r.userId),
                  React.createElement('td', { key: 'a', style: { padding: '6px' } }, React.createElement('input', { type: 'checkbox', disabled: (!!busy) || (!canToggle(r)), checked: !!r.approved, title: (!canToggle(r) ? 'Only editors can override others' : undefined), onChange: (e) => onToggle(r, !!e.target.checked) })),
                  React.createElement('td', { key: 'm', style: { padding: '6px' } }, React.createElement(UIButton, { label: 'Message', onClick: () => { try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'message', options: { toUserId: r.userId, toUserName: r.name || r.userId } } })); } catch {} } })),
                  React.createElement('td', { key: 't', style: { padding: '6px' } }, React.createElement('input', { type: 'text', defaultValue: r.notes || '', onBlur: (e) => setSelf(r.userId, r.approved, e.target.value), style: { width: '100%' } })),
                ])))
              ])
          ]),
          prompt ? React.createElement(ConfirmModal, { title: prompt.title, message: prompt.message, onConfirm: async () => { try { await prompt.onConfirm?.(); } finally { setPrompt(null); } }, onClose: () => setPrompt(null) }) : null,
        ])
      );
    }

    function App() {
      const [modal, setModal] = React.useState(null);
      const { documentSource } = React.useContext(StateContext);
      React.useEffect(() => {
        function onOpen(ev) { try { const d = ev.detail || {}; if (d && (d.id === 'send-vendor' || d.id === 'sendVendor')) setModal({ id: 'send-vendor', userId: d.options?.userId || 'user1' }); if (d && d.id === 'approvals') setModal({ id: 'approvals' }); if (d && d.id === 'compile') setModal({ id: 'compile' }); if (d && d.id === 'notifications') setModal({ id: 'notifications' }); if (d && d.id === 'request-review') setModal({ id: 'request-review' }); if (d && d.id === 'message') setModal({ id: 'message', toUserId: d.options?.toUserId, toUserName: d.options?.toUserName }); if (d && (d.id === 'open-gov' || d.id === 'openGov')) setModal({ id: 'open-gov' }); } catch {} }
        window.addEventListener('react:open-modal', onOpen);
        return () => window.removeEventListener('react:open-modal', onOpen);
      }, []);
      const [confirm, setConfirm] = React.useState(null);
      const { actions } = React.useContext(StateContext);
      const ask = (kind) => {
        if (kind === 'finalize') setConfirm({ title: 'Finalize?', message: 'This will lock the document.', onConfirm: actions.finalize });
        if (kind === 'unfinalize') setConfirm({ title: 'Unlock?', message: 'This will unlock the document.', onConfirm: actions.unfinalize });
        if (kind === 'reset') setConfirm({ title: 'Factory reset?', message: 'This will clear working data.', onConfirm: actions.factoryReset });
      };
      return React.createElement(ThemeProvider, null,
        React.createElement(StateProvider, null,
          React.createElement(React.Fragment, null,
            React.createElement(ErrorBanner, null),
            // SuperDoc host only on web
            (typeof Office === 'undefined' ? React.createElement(SuperDocHost, { key: 'host', src: documentSource }) : null),
            // 2 - Banners (top)
            React.createElement(BannerStack, { key: 'banners' }),
            // 1 - User selection + role pill + status
            React.createElement('div', { style: { marginTop: '8px', borderTop: '1px solid #e5e7eb', paddingTop: '8px' } }, [
              React.createElement('div', { key: 'hdr1', style: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px' } }, 'User & Role'),
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } }, [
              React.createElement(UserCard, { key: 'user' }),
              React.createElement(ConnectionBadge, { key: 'conn' }),
              React.createElement(NotificationsBell, { key: 'bell' }),
              ])
            ]),
            // 3 - Buttons (actions)
            React.createElement('div', { style: { marginTop: '10px', borderTop: '1px solid #e5e7eb', paddingTop: '8px' } }, [
              React.createElement('div', { key: 'hdr2', style: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px' } }, 'Actions'),
              React.createElement(ApprovalsPill, { key: 'approvals-pill' }),
              React.createElement(ActionButtons, { key: 'actions' }),
              React.createElement(DocumentControls, { key: 'doc' }),
            ]),
            // 4 - Chatbot (OG Assist)
            React.createElement('div', { style: { marginTop: '12px', borderTop: '1px solid #e5e7eb', paddingTop: '8px' } }, [
              React.createElement('div', { key: 'hdr3', style: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px' } }, 'Assistant'),
              React.createElement(ChatConsole, { key: 'chat' }),
            ]),
            modal ? (modal.id === 'send-vendor' ? React.createElement(SendVendorModal, { userId: modal.userId, onClose: () => setModal(null) }) : (modal.id === 'approvals' ? React.createElement(ApprovalsModal, { onClose: () => setModal(null) }) : (modal.id === 'compile' ? React.createElement(CompileModal, { onClose: () => setModal(null) }) : (modal.id === 'notifications' ? React.createElement(NotificationsModal, { onClose: () => setModal(null) }) : (modal.id === 'request-review' ? React.createElement(RequestReviewModal, { onClose: () => setModal(null) }) : (modal.id === 'message' ? React.createElement(MessageModal, { toUserId: modal.toUserId, toUserName: modal.toUserName, onClose: () => setModal(null) }) : (modal.id === 'open-gov' ? React.createElement(OpenGovModal, { onClose: () => setModal(null) }) : null))))))) : null,
            confirm ? React.createElement(ConfirmModal, { title: confirm.title, message: confirm.message, onConfirm: confirm.onConfirm, onClose: () => setConfirm(null) }) : null
          )
        )
      );
    }

    const root = ReactDOM.createRoot(rootEl);
    root.render(React.createElement(App, null));
  }

  try {
    win.mountReactApp = mountReactApp;
    win.openReactModal = function(id, options) {
      try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id, options: options || {} } })); } catch {}
    };
  } catch (_) {}
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));


