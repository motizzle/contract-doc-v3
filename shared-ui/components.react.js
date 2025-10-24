// React entry (UMD) for shared UI. Safe to include even if React is missing.
// Exposes window.mountReactApp({ rootSelector }) for progressive migration.

(function (global) {
  const win = typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this);

  function getApiBase() {
    // In production (deployed): use current domain (no port)
    // In development: use localhost:4001 (API server)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocalhost) {
    // Always use the API server port (4001), not the dev server port (4000)
    // The dev server (4000) is for serving the add-in HTML/JS
    // The API server (4001) is for all backend API calls
    return 'https://localhost:4001';
    } else {
      // Production: API is served from same domain
      return window.location.origin;
    }
  }

  // ====================================================================
  // JWT Authentication - Global fetch() Override
  // ====================================================================
  
  // Global token storage
  let authToken = null;
  let isInitializingAuth = false;

  // Initialize authentication on app load
  async function initializeAuth() {
    if (isInitializingAuth) {
      // Prevent concurrent initialization
      while (isInitializingAuth) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return authToken;
    }

    isInitializingAuth = true;
    try {
      // ALWAYS generate and store fingerprint (for persistent computer linking)
      const fingerprint = generateFingerprint();
      localStorage.setItem('wordftw_fingerprint', fingerprint);
      
      // Try to retrieve existing token
      authToken = localStorage.getItem('wordftw_auth_token');
      
      if (!authToken) {
        // Request new token from server
        console.log('🔐 No token found, requesting new session...');
        authToken = await requestNewToken();
      } else {
        console.log('🔐 Using existing authentication token');
      }
      
      return authToken;
    } finally {
      isInitializingAuth = false;
    }
  }

  // Generate machine fingerprint for session sharing between browser and Word
  function generateFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('wordftw', 2, 2);
      const canvasData = canvas.toDataURL();
      
      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        canvasData.substring(0, 50)
      ].join('|');
      
      // Simple hash function
      let hash = 0;
      for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return 'fp_' + Math.abs(hash).toString(36);
    } catch (e) {
      console.warn('Fingerprint generation failed, using fallback');
      return 'fp_' + Math.random().toString(36).substr(2, 9);
    }
  }

  // Request new token from server
  async function requestNewToken() {
    try {
      const API_BASE = getApiBase();
      // Get fingerprint from localStorage (already generated in getAuthToken)
      const fingerprint = localStorage.getItem('wordftw_fingerprint');
      console.log(`🔑 Machine fingerprint: ${fingerprint}`);
      
      // Use original fetch to avoid infinite recursion
      const response = await window._originalFetch(`${API_BASE}/api/v1/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }
      
      const data = await response.json();
      authToken = data.token;
      localStorage.setItem('wordftw_auth_token', authToken);
      
      // Store link code if provided (for browser to share with Word)
      if (data.linkCode) {
        localStorage.setItem('wordftw_link_code', data.linkCode);
        console.log(`🔗 Link code generated: ${data.linkCode}`);
      }
      
      console.log(`✅ New session created: ${data.sessionId}`);
      console.log(`🕐 Token expires in: ${data.expiresIn}`);
      if (data.linked) {
        console.log(`🔗 Session is linked to another device`);
      }
      
      return authToken;
    } catch (err) {
      console.error('❌ Failed to initialize session:', err);
      throw err;
    }
  }

  // Submit link code to create permanent link (Word add-in → Browser)
  async function submitLinkCode(linkCode) {
    try {
      const API_BASE = getApiBase();
      const fingerprint = localStorage.getItem('wordftw_fingerprint');
      
      const response = await window._originalFetch(`${API_BASE}/api/v1/session/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkCode, fingerprint })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to link sessions');
      }
      
      const data = await response.json();
      
      // Update our token to the linked session
      authToken = data.token;
      localStorage.setItem('wordftw_auth_token', data.token);
      localStorage.removeItem('wordftw_link_code'); // We're linked now
      
      console.log(`🔗 Successfully linked to browser session: ${data.sessionId}`);
      
      // Force a full page reload to use the new session
      window.location.reload();
      
      return data;
    } catch (err) {
      console.error('❌ Failed to link sessions:', err);
      throw err;
    }
  }
  
  // Expose link functions globally for Word add-in
  window.wordFTW_getLinkCode = () => localStorage.getItem('wordftw_link_code');
  window.wordFTW_submitLinkCode = submitLinkCode;

  // Store original fetch before overriding
  if (!window._originalFetch) {
    window._originalFetch = window.fetch;
  }

  // Override global fetch() to automatically add JWT to API calls
  window.fetch = async function(url, options = {}) {
    // Ensure we have a token
    if (!authToken && !isInitializingAuth) {
      await initializeAuth();
    }
    
    // Check if this is an API call to our backend
    const urlString = typeof url === 'string' ? url : (url instanceof URL ? url.href : '');
    const isApiCall = urlString.startsWith('/api/') || 
                     urlString.includes('/api/v1/') ||
                     urlString.startsWith(getApiBase());
    
    // Skip auth for session creation endpoint (avoid recursion)
    const isSessionEndpoint = urlString.includes('/api/v1/session/start');
    
    // Add JWT token to API calls
    if (isApiCall && !isSessionEndpoint && authToken) {
      options.headers = {
        'Authorization': `Bearer ${authToken}`,
        ...options.headers
      };
    }
    
    // Call original fetch
    const response = await window._originalFetch(url, options);
    
    // Auto-refresh expired tokens
    if (isApiCall && !isSessionEndpoint && (response.status === 401 || response.status === 403)) {
      const errorData = await response.clone().json().catch(() => ({}));
      
      if (errorData.action === 'refresh_token' || errorData.action === 'request_new_token' || errorData.action === 'request_token') {
        console.warn('🔄 Token expired or invalid, requesting new session...');
        localStorage.removeItem('wordftw_auth_token');
        authToken = null;
        await initializeAuth();
        
        // Retry with new token
        options.headers = {
          'Authorization': `Bearer ${authToken}`,
          ...options.headers
        };
        return window._originalFetch(url, options);
      }
    }
    
    return response;
  };

  // Initialize auth when the module loads
  setTimeout(() => initializeAuth(), 100);

  // ====================================================================
  // End JWT Authentication
  // ====================================================================

  function mountReactApp(opts) {
    const options = opts || {};
    const selector = options.rootSelector || '#app-root';
    const rootEl = document.querySelector(selector);
    if (!rootEl) { try { console.warn('[react-entry] root not found', selector); } catch (_) {} return; }
    if (!win.React || !win.ReactDOM || !win.ReactDOM.createRoot || win.React.__placeholder || win.ReactDOM.__placeholder) {
      try { console.warn('[react-entry] React/ReactDOM not available; did you preload /vendor/react/*?'); } catch (_) {}
      return; // Graceful no-op
    }

    // Web-only: eliminate page-level scrollbar; let document and sidebar own scrolling
    try {
      if (typeof Office === 'undefined') {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.style.height = '100vh';
        // Lock any scrollable ancestors of the app root to avoid a second right-side scrollbar
        (function lockScrollableAncestors() {
          try {
            const root = rootEl;
            if (!root) return;
            let node = root.parentElement;
            const changed = [];
            while (node && node !== document.body && node !== document.documentElement) {
              const cs = getComputedStyle(node);
              const isScrollable = /(auto|scroll)/.test(cs.overflowY) || node.scrollHeight > node.clientHeight;
              if (isScrollable) {
                node.setAttribute('data-og-prev-overflow-y', node.style.overflowY || '');
                node.style.overflowY = 'hidden';
                changed.push(node);
              }
              node = node.parentElement;
            }
            window.addEventListener('unload', () => {
              try { changed.forEach(n => { const prev = n.getAttribute('data-og-prev-overflow-y') || ''; n.style.overflowY = prev; n.removeAttribute('data-og-prev-overflow-y'); }); } catch {}
            });
          } catch {}
        })();
      }
    } catch {}

    // Load confetti.js library
    const confettiScript = document.createElement('script');
    confettiScript.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
     confettiScript.onload = () => {};
    document.head.appendChild(confettiScript);

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
      
      // Debug: Track when viewingVersion changes
      React.useEffect(() => {
        console.log(`[DEBUG] viewingVersion changed to: ${viewingVersion}`);
      }, [viewingVersion]);
      const [isConnected, setIsConnected] = React.useState(false);
      const [lastTs, setLastTs] = React.useState(0);
      // Default user: Warren Peace (user1) for web, Kent Ucky (user2) for Word add-in
      const isWordAddin = typeof Office !== 'undefined' && Office.context && Office.context.host;
      const [userId, setUserId] = React.useState(isWordAddin ? 'user2' : 'user1');
      const [role, setRole] = React.useState('editor');
      const [users, setUsers] = React.useState([]);
      const [logs, setLogs] = React.useState([]);
      const [activities, setActivities] = React.useState([]);
      const [lastSeenActivityId, setLastSeenActivityId] = React.useState(
        typeof localStorage !== 'undefined' ? localStorage.getItem('lastSeenActivityId') || null : null
      );
      const [lastSeenLogCount, setLastSeenLogCount] = React.useState(0);
      const [documentSource, setDocumentSource] = React.useState(null);
      const [lastError, setLastError] = React.useState(null);
      const [approvalsSummary, setApprovalsSummary] = React.useState(null);
      const [approvalsRevision, setApprovalsRevision] = React.useState(0);
      const [messagingUnreadCount, setmessagingUnreadCount] = React.useState(0);
      const API_BASE = getApiBase();

      // Removed excessive logging

      // Web-only: prevent page/body from adding a third scrollbar; keep scrolling scoped to document area and sidebar
      React.useEffect(() => {
        if (typeof Office !== 'undefined') return; // Word add-in unaffected
        try {
          const prevHtml = document.documentElement.style.overflow;
          const prevBody = document.body.style.overflow;
          document.documentElement.style.overflow = 'hidden';
          document.body.style.overflow = 'hidden';
          return () => {
            document.documentElement.style.overflow = prevHtml;
            document.body.style.overflow = prevBody;
          };
        } catch {}
      }, []);

      // Sync current user state to window.userStateBridge for SuperDoc
      React.useEffect(() => {
        try {
          if (typeof window !== 'undefined' && window.userStateBridge) {
            window.userStateBridge.userId = userId;
            window.userStateBridge.role = role;
            const user = users.find(u => u.id === userId || u.label === userId);
            if (user) {
              window.userStateBridge.displayName = user.label || userId;
              window.userStateBridge.email = user.email || '';
            }
          }
        } catch {}
      }, [userId, role, users]);

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

      // Load activities from server
      const loadActivities = React.useCallback(async () => {
        try {
          console.log('🔄 [StateContext] loadActivities called');
          const response = await fetch(`${API_BASE}/api/v1/activity`);
          if (response.ok) {
            const data = await response.json();
            console.log(`📥 [StateContext] Fetched ${data.activities?.length || 0} activities`);
            setActivities(data.activities || []);
          }
        } catch (e) {
          console.error('Failed to load activities:', e);
        }
      }, [API_BASE]);

      // Mark activities as seen
      const markActivitiesSeen = React.useCallback(() => {
        try {
          const latestId = activities.length > 0 ? activities[activities.length - 1]?.id : null;
          setLastSeenActivityId(latestId);
          if (typeof localStorage !== 'undefined' && latestId) {
            localStorage.setItem('lastSeenActivityId', latestId);
          }
        } catch (e) {
          console.error('Failed to mark activities seen:', e);
        }
      }, [activities]);

      // State for expanded activity cards
      const [expandedActivities, setExpandedActivities] = React.useState({});
      
      const toggleActivity = React.useCallback((activityId) => {
        setExpandedActivities(prev => ({
          ...prev,
          [activityId]: !prev[activityId]
        }));
      }, []);

      // Render formatted notification
      const renderNotification = React.useCallback((log, index) => {
        // Standardized activity format: "<user> did <action> at <date/time> (vN)" plus context
        const toStd = (obj) => {
          try {
            const ts = obj.ts ? new Date(obj.ts).toLocaleString() : new Date().toLocaleString();
            const version = Number(obj.documentVersion || obj.payload?.documentVersion || 0);
            const vStr = version > 0 ? ` (v${version})` : '';
            const who = (function(){
              try {
                if (obj.userId === 'bot') return 'Assistant';
                const id = String(obj.userId || '');
                if (!id) return 'Unknown';
                // Try resolving from loaded users list if available on window
                try {
                  const list = (window.__ogUsers || []);
                  const match = Array.isArray(list) ? list.find(u => (u && (u.id === id || u.label === id))) : null;
                  if (match) return match.label || match.id || id;
                } catch {}
                if (id === 'user1') return 'Warren Peace';
                if (id === 'user2') return 'Fun E Guy';
                return id;
              } catch { return 'Unknown'; }
            })();
            const action = (function(){
              const t = String(obj.type || '').replace(/:/g, ' ');
              if (!t) return 'did something';
              return t;
            })();
            return { stdText: `${who} did ${action} at ${ts}${vStr}`, ts };
          } catch { return null; }
        };
        if (typeof log === 'string') {
          return React.createElement('div', { key: index, className: 'notification-item notification-legacy' }, log);
        } else if (log.formatted) {
          // Formatted notification object
          const { message, timestamp, type, style } = log;
          const dynamicStyle = {
            border: `1px solid ${style.borderColor}`,
            backgroundColor: style.bgColor,
            color: style.color
          };
          return React.createElement('div', { key: log.id || index, className: 'notification-item notification-formatted', style: dynamicStyle }, [
            React.createElement('span', { key: 'icon', className: 'notification-icon' }, style.icon),
            React.createElement('div', { key: 'content', className: 'notification-content' }, [
              React.createElement('div', { key: 'message', className: 'notification-message' }, message),
              React.createElement('div', { key: 'timestamp', className: 'notification-timestamp' }, timestamp)
            ])
          ]);
        } else if (log && typeof log === 'object' && log.message && log.timestamp) {
          // New activity format (card style with expandable details)
          const timestamp = new Date(log.timestamp).toLocaleString();
          const userLabel = log.user?.label || 'Unknown User';
          const action = log.action || 'performed action';
          const type = String(log.type || '').split(':')[0];
          const activityId = log.id || `activity-${index}`;
          const isExpanded = expandedActivities[activityId];
          
          const icon = (function(){
            switch (type) {
              case 'document': return '📄';
              case 'system': return '🔧';
              case 'workflow': return '✅';
              case 'version': return '🕘';
              case 'status': return '🏷️';
              case 'message': return '💬';
              case 'variable': return '🔤';
              default: return 'ℹ️';
            }
          })();

          const message = log.message;
          
          // Build details array from log.details object
          const details = log.details || {};
          const detailsArray = [];
          
          // Add specific details based on activity type
          if (details.messageId) detailsArray.push(`Message ID: ${details.messageId}`);
          if (details.title) detailsArray.push(`Title: ${details.title}`);
          if (details.recipients !== undefined) detailsArray.push(`Recipients: ${details.recipients}`);
          if (details.targetUserId) {
            const targetLabel = (users || []).find(u => u.id === details.targetUserId)?.label || details.targetUserId;
            detailsArray.push(`Target: ${targetLabel}`);
          }
          if (details.notes) detailsArray.push(`Notes: ${details.notes}`);
          if (details.progress) detailsArray.push(`Progress: ${details.progress.approved}/${details.progress.total} approved`);
          if (details.internal !== undefined) detailsArray.push(`Internal: ${details.internal ? 'Yes' : 'No'}`);
          if (details.external !== undefined) detailsArray.push(`External: ${details.external ? 'Yes' : 'No'}`);
          if (details.privileged !== undefined) detailsArray.push(`Attorney-Client Privilege: ${details.privileged ? 'Yes' : 'No'}`);
          if (details.varId) detailsArray.push(`Variable ID: ${details.varId}`);
          if (details.displayLabel) detailsArray.push(`Variable: ${details.displayLabel}`);
          if (details.oldValue !== undefined && details.newValue !== undefined) {
            detailsArray.push(`Changed from: "${details.oldValue}" → "${details.newValue}"`);
          } else if (details.value !== undefined) {
            detailsArray.push(`Value: ${details.value}`);
          }
          if (details.filename) detailsArray.push(`Filename: ${details.filename}`);
          if (details.size) detailsArray.push(`Size: ${Math.round(details.size / 1024)}KB`);
          if (details.version) detailsArray.push(`Version: ${details.version}`);
          if (details.autoSave !== undefined) detailsArray.push(`Auto-save: ${details.autoSave ? 'Yes' : 'No'}`);
          if (details.to && Array.isArray(details.to)) {
            const toLabels = details.to.map(id => {
              const user = (users || []).find(u => u.id === id);
              return user?.label || id;
            }).filter(Boolean);
            if (toLabels.length > 0) detailsArray.push(`To: ${toLabels.join(', ')}`);
          }
          if (details.channel) detailsArray.push(`Channel: ${details.channel}`);
          if (details.changes) {
            if (typeof details.changes === 'object' && !Array.isArray(details.changes)) {
              // New format: { field: { old: 'x', new: 'y' } }
              Object.entries(details.changes).forEach(([field, change]) => {
                if (change && typeof change === 'object' && change.old !== undefined && change.new !== undefined) {
                  detailsArray.push(`Changed ${field}: "${change.old}" → "${change.new}"`);
                } else {
                  detailsArray.push(`Changed ${field}: ${JSON.stringify(change)}`);
                }
              });
            } else {
              // Legacy format or simple array
              const changesStr = Array.isArray(details.changes) ? details.changes.join(', ') : JSON.stringify(details.changes);
              if (changesStr) detailsArray.push(`Changes: ${changesStr}`);
            }
          }
          if (details.recipientsList && Array.isArray(details.recipientsList)) {
            const recipientsStr = details.recipientsList.map(r => `${r.label}${r.email ? ` (${r.email})` : ''}`).join(', ');
            if (recipientsStr) detailsArray.push(`Recipients: ${recipientsStr}`);
          }
          if (details.participants && typeof details.participants === 'string') {
            detailsArray.push(`Participants: ${details.participants}`);
          }
          if (details.postCount !== undefined) detailsArray.push(`Messages: ${details.postCount}`);
          if (details.initialMessage) detailsArray.push(`Initial message: "${details.initialMessage}"`);
          if (details.platform) detailsArray.push(`Platform: ${details.platform}`);
          if (details.category) detailsArray.push(`Category: ${details.category}`);
          if (details.type && type !== 'variable') detailsArray.push(`Type: ${details.type}`);
          if (details.error) detailsArray.push(`Error: ${details.error}`);
          if (details.promptLength) detailsArray.push(`Prompt length: ${details.promptLength} characters`);
          
          const hasDetails = detailsArray.length > 0;

          return React.createElement('div', { 
            key: activityId, 
            className: 'activity-card' + (isExpanded ? ' activity-card--expanded' : ''),
            onClick: hasDetails ? () => toggleActivity(activityId) : undefined,
            style: hasDetails ? { cursor: 'pointer' } : {}
          }, [
            React.createElement('div', { key: 'row', className: 'activity-card__row' }, [
              React.createElement('span', { key: 'icon', className: 'activity-card__icon' }, icon),
              React.createElement('div', { key: 'body', className: 'activity-card__body' }, [
                React.createElement('div', { key: 'title', className: 'activity-card__title' }, message),
                React.createElement('div', { key: 'meta', className: 'activity-card__meta' }, `${userLabel} • ${timestamp}${hasDetails ? (isExpanded ? ' ▲' : ' ▼') : ''}`)
              ])
            ]),
            hasDetails && isExpanded ? React.createElement('div', { key: 'details', className: 'activity-card__details' }, 
              detailsArray.map((detail, idx) => React.createElement('div', { key: idx, className: 'activity-card__detail-item' }, `• ${detail}`))
            ) : null
          ]);
        } else if (log && typeof log === 'object' && (log.type || log.userId || log.ts)) {
          const std = toStd(log);
          if (std) return React.createElement('div', { key: index, className: 'notification-item notification-legacy' }, std.stdText);
        }
        return null;
      }, [expandedActivities, toggleActivity, users]);

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
              console.log('🔄 [refresh] Received config from API:', { title: j?.config?.title, status: j?.config?.status, revision: j?.revision });
              setConfig(j.config || null);
              if (typeof j.revision === 'number') setRevision(j.revision);
              try { const sum = j?.config?.approvals?.summary || null; setApprovalsSummary(sum); } catch {}
            }
        } catch {}
      }, [API_BASE, userId, loadedVersion]);

      // Refresh state-matrix when revision changes to show banners for new versions
      React.useEffect(() => {
        if (revision > 0) { // Only refresh after initial load
          refresh();
        }
      }, [revision]); // Remove refresh from deps to avoid loops

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
              // Update user state bridge for SuperDoc
              try {
                if (typeof window !== 'undefined' && window.userStateBridge) {
                  window.userStateBridge.users = items;
                }
              } catch {}
            }
          } catch {}
        })();
        refresh();
        let sse;
        try {
          // EventSource doesn't support custom headers, so pass token as query param
          const token = localStorage.getItem('wordftw_auth_token');
          const eventsUrl = token 
            ? `${API_BASE}/api/v1/events?token=${encodeURIComponent(token)}`
            : `${API_BASE}/api/v1/events`;
          
          sse = new EventSource(eventsUrl);
          window.eventSource = sse; // Expose for other components (VariablesPanel, etc.)
          sse.onopen = () => { setIsConnected(true); addLog('Connected to server', 'network'); };
          sse.onmessage = (ev) => {
            try {
              const p = JSON.parse(ev.data);
              
              // Session Isolation: Ignore events from other sessions
              // Get our session ID from localStorage
              const ourToken = localStorage.getItem('wordftw_auth_token');
              let ourSessionId = null;
              if (ourToken) {
                try {
                  const payload = JSON.parse(atob(ourToken.split('.')[1]));
                  ourSessionId = payload.sessionId;
                } catch {}
              }
              
              // If event has sessionId and it doesn't match ours, ignore it
              // (Keep backward compatibility: if no sessionId in event, process it)
              if (p.sessionId && ourSessionId && p.sessionId !== ourSessionId) {
                console.log(`🚫 [SSE] Ignoring event from different session: ${p.type} (session: ${p.sessionId})`);
                return; // Ignore this event
              }
              
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
              // Handle approval completion celebration
              if (p && p.type === 'approval:complete') {
                try {
                  window.dispatchEvent(new CustomEvent('approval:complete', { detail: p }));
                } catch {}
              }
              // Handle status changes (for banner drop celebration)
              if (p && p.type === 'status') {
                try {
                  window.dispatchEvent(new CustomEvent('status:change', { detail: p }));
                  console.log('📡 Status changed to:', p.status);
                } catch {}
              }
              // Handle variable events (both singular and plural)
              if (p && p.type && (p.type.startsWith('variable:') || p.type.startsWith('variables:'))) {
                try {
                  window.dispatchEvent(new CustomEvent(p.type, { detail: p }));
                  console.log('📡 Dispatched window event:', p.type, p);
                } catch {}
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
                  case 'checkout':
                    addLog('Document checked out', 'info');
                    refresh(); // Refresh state-matrix to update checkout status
                    break;
                  case 'checkin':
                    addLog('Document checked in', 'success');
                    refresh(); // Refresh state-matrix to update checkout status
                    break;
                  case 'checkoutCancel':
                    addLog('Checkout cancelled', 'warning');
                    refresh(); // Refresh state-matrix to update checkout status
                    break;
                  case 'overrideCheckout':
                    addLog('Checkout override performed', 'warning');
                    refresh(); // Refresh state-matrix to update checkout status
                    break;
                  // Skip logging: hello, saveProgress, chat events, sendVendor, and plain approvals:update
                }
              }
              // IMPORTANT: do not auto-refresh documentSource on SSE. User must click View Latest or reload.
              // Exception: after a Factory Reset, reload the canonical default document so the UI returns to baseline.
              if (p && p.type === 'factoryReset') {
                try {
                  if (typeof Office !== 'undefined') {
                    // Word add-in: Get version first, then load that version
                    (async () => {
                          try {
                            const plat = 'word';
                            const u = `${API_BASE}/api/v1/state-matrix?platform=${plat}&clientVersion=0&userId=${encodeURIComponent(String(userId||'user1'))}`;
                            const r = await fetch(u);
                            const j = await r.json();
                        const v = Number(j?.config?.documentVersion || 1);
                        console.log(`🔄 [Factory Reset] Loading version ${v} in Word add-in`);
                        
                        // Load the specific version, not the canonical document
                        const versionUrl = `${API_BASE}/api/v1/versions/${v}?rev=${Date.now()}`;
                        const res = await fetch(versionUrl, { cache: 'no-store' });
                        if (res && res.ok) {
                          const buf = await res.arrayBuffer();
                          const b64 = (function(buf){ let bin=''; const bytes=new Uint8Array(buf); for(let i=0;i<bytes.byteLength;i++) bin+=String.fromCharCode(bytes[i]); return btoa(bin); })(buf);
                          await Word.run(async (context) => { context.document.body.insertFileFromBase64(b64, Word.InsertLocation.replace); await context.sync(); });
                          
                              console.log(`[DEBUG] Setting viewingVersion to ${v} - Source: factoryReset (add-in)`);
                              setLoadedVersion(v); 
                              setViewingVersion(v); 
                          // Note: refresh() will be called automatically by useEffect when revision updates from SSE
                          console.log(`✅ [Factory Reset] Loaded version ${v} in Word add-in`);
                            }
                      } catch (e) {
                        console.error('❌ [Factory Reset] Failed to load version in add-in:', e);
                        }
                    })();
                  } else {
                    // Web: Get version first, then load that version
                    (async () => {
                      try {
                        const plat = 'web';
                        const u = `${API_BASE}/api/v1/state-matrix?platform=${plat}&clientVersion=0&userId=${encodeURIComponent(String(userId||'user1'))}`;
                        const r = await fetch(u);
                        const j = await r.json();
                        const v = Number(j?.config?.documentVersion || 1);
                        console.log(`🔄 [Factory Reset] Loading version ${v} on web`);
                        
                        // Load the specific version, not the canonical document
                        const versionUrl = `${API_BASE}/api/v1/versions/${v}?rev=${Date.now()}`;
                        setDocumentSource(versionUrl);
                        
                          console.log(`[DEBUG] Setting viewingVersion to ${v} - Source: factoryReset (web)`);
                          setLoadedVersion(v); 
                          setViewingVersion(v); 
                        // Note: refresh() will be called automatically by useEffect when revision updates from SSE
                        console.log(`✅ [Factory Reset] Loaded version ${v} on web`);
                      } catch (e) {
                        console.error('❌ [Factory Reset] Failed to load version on web:', e);
                        }
                    })();
                  }
                } catch {}
                try { window.dispatchEvent(new CustomEvent('factoryReset', { detail: p })); } catch {}
              }
              if (p && p.type === 'versions:update') { try { window.dispatchEvent(new CustomEvent('versions:update', { detail: p })); } catch {} }
              if (p && p.type === 'version:view') { try { window.dispatchEvent(new CustomEvent('version:view', { detail: p })); } catch {} }
              if (p && p.type === 'document:navigate') {
                try {
                  console.log('[SSE] document:navigate ←', p && p.payload ? { textLen: String(p.payload.text||'').length, changeType: p.payload.changeType, hasCtx: !!(p.payload.contextBefore||p.payload.contextAfter) } : {});
                  window.dispatchEvent(new CustomEvent('document:navigate', { detail: (p && p.payload) ? p.payload : {} }));
                } catch {}
              }
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
              }
              // Handle activity updates
              if (p && p.type === 'activity:new' && p.activity) {
                setActivities(prev => [...prev, p.activity]);
              }
              // Handle activity reset
              if (p && p.type === 'activity:reset') {
                console.log('🔄 [StateContext] Activity reset event received - reloading activities');
                setActivities([]);
                setLastSeenActivityId(null);
                if (typeof localStorage !== 'undefined') {
                  localStorage.removeItem('lastSeenActivityId');
                }
                // Reload activities from server after reset
                loadActivities();
              }
              // Do not auto-refresh document on save/revert; show banner via state-matrix
              refresh();
            } catch {}
          };
          sse.onerror = () => { setIsConnected(false); addLog('Lost connection to server', 'error'); };
        } catch {}

        // Load initial activities
        loadActivities();

        return () => { try { sse && sse.close(); } catch {} };
      }, [API_BASE, refresh, addLog, loadActivities]);

      const addError = React.useCallback((err) => {
        try { setLastError(err || null); if (err && err.message) addLog(`Error: ${err.message}`, 'error'); } catch {}
      }, [addLog]);

      // Do not auto-sync viewingVersion to server documentVersion; viewing changes only on local actions

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
                const ver = Number.isFinite(v) && v > 0 ? v : 1;
                setLoadedVersion(ver);
                
                try { setViewingVersion(ver); } catch {}
                try { window.dispatchEvent(new CustomEvent('version:view', { detail: { version: ver, payload: { messagePlatform: 'web' } } })); } catch {}
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
        // finalize/unfinalize removed
        checkout: async () => { 
          
          try { 
            const clientVersionToSend = (viewingVersion || loadedVersion || 0);
            
            const response = await fetch(`${API_BASE}/api/v1/checkout`, { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' }, 
              body: JSON.stringify({ userId, clientVersion: clientVersionToSend }) 
            });
            
            
            if (response.ok) {
              addLog('Document checked out successfully', 'success'); 
              await refresh(); 
            } else {
              const errorData = await response.json();
              if (errorData.error === 'version_outdated') {
                // Show modal for version outdated
                
                try { 
                  window.dispatchEvent(new CustomEvent('react:open-modal', { 
                    detail: { 
                      id: 'version-outdated-checkout', 
                      options: { 
                        currentVersion: errorData.currentVersion,
                        clientVersion: errorData.clientVersion,
                        viewingVersion: viewingVersion || loadedVersion || 0,
                        message: errorData.message,
                        userId: userId
                      } 
                    } 
                  })); 
                } catch (e) {
                  console.error('Error dispatching modal event:', e);
                }
              } else {
                addLog(`Failed to check out document: ${errorData.error || 'Unknown error'}`, 'error');
              }
            }
          } catch (e) { 
            addLog(`Failed to check out document: ${e?.message||e}`, 'error'); 
          } 
        },
        checkin: async () => { try { await fetch(`${API_BASE}/api/v1/checkin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); addLog('Document checked in successfully', 'success'); await refresh(); } catch (e) { addLog(`Failed to check in document: ${e?.message||e}`, 'error'); } },
        cancel: async () => { try { await fetch(`${API_BASE}/api/v1/checkout/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); addLog('Checkout cancelled successfully', 'success'); await refresh(); } catch (e) { addLog(`Failed to cancel checkout: ${e?.message||e}`, 'error'); } },
        override: async () => { try { await fetch(`${API_BASE}/api/v1/checkout/override`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); addLog('Checkout override successful', 'warning'); await refresh(); } catch (e) { addLog(`Failed to override checkout: ${e?.message||e}`, 'error'); } },
        factoryReset: async () => { try { await fetch(`${API_BASE}/api/v1/factory-reset`, { method: 'POST' }); addLog('System reset completed successfully', 'system'); try { window.dispatchEvent(new CustomEvent('versions:update')); } catch {} await refresh(); } catch (e) { addLog(`Failed to reset system: ${e?.message||e}`, 'error'); } },
        sendVendor: (opts) => { try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'send-vendor', options: { userId, ...(opts||{}) } } })); } catch {} },
        saveProgress: async () => {
          try {
            const isWordHost = (typeof Office !== 'undefined');
            if (isWordHost) { await saveProgressWord(); } else { await saveProgressWebViaDownload(); }
            addLog('Progress saved successfully', 'success');
            // Fetch updated matrix first so local version state updates before any refresh-driven banner logic
            try {
              const plat = isWordHost ? 'word' : 'web';
              const u = `${API_BASE}/api/v1/state-matrix?platform=${plat}&userId=${encodeURIComponent(userId)}`;
              const r = await fetch(u);
              if (r && r.ok) {
                const j = await r.json();
                const v = Number(j?.config?.documentVersion || 0);
                if (Number.isFinite(v) && v > 0) {
                  console.log(`[DEBUG] Setting viewingVersion to ${v} - Source: saveProgress`);
                  try { setViewingVersion(v); } catch {}
                  try { setLoadedVersion(v); } catch {}
                  try { window.dispatchEvent(new CustomEvent('version:view', { detail: { version: v, payload: { messagePlatform: plat } } })); } catch {}
                }
              }
            } catch {}
            // Now refresh other server-driven state (banners list, approvals, etc.)
            await refresh();
            return true;
          } catch (e) {
            addLog(`Failed to save progress: ${e?.message||e}`, 'error');
            return false;
          }
        },
        setUser: (nextUserId, nextRole) => {
          try {
            const plat = (typeof Office !== 'undefined') ? 'word' : 'web';
            setUserId(nextUserId);
            if (nextRole) setRole(nextRole);
            // Update user state bridge for SuperDoc
            try {
              if (typeof window !== 'undefined' && window.userStateBridge) {
                window.userStateBridge.userId = nextUserId;
                window.userStateBridge.role = nextRole || window.userStateBridge.role;
                const user = users.find(u => u.id === nextUserId || u.label === nextUserId);
                if (user) {
                  window.userStateBridge.displayName = user.label || nextUserId;
                  window.userStateBridge.email = user.email || '';
                }
              }
            } catch {}
            addLog(`Switched to user: ${nextUserId}`, 'user');
            // Reset loadedVersion to 0 when switching users to avoid stale banner state
            setLoadedVersion(0);
            // Immediately fetch matrix for the new user so buttons (override) reflect correctly
            (async () => {
              try {
                const qs = `platform=${encodeURIComponent(plat)}&userId=${encodeURIComponent(nextUserId)}&clientVersion=0`;
                const r = await fetch(`${API_BASE}/api/v1/state-matrix?${qs}`);
                if (r.ok) {
                  const j = await r.json();
                   
                  setConfig(j.config || null);
                  if (typeof j.revision === 'number') setRevision(j.revision);
                  // Update both viewingVersion and loadedVersion to the newest version for this user
                  try {
                    const v = Number(j?.config?.documentVersion || 0);
                    if (Number.isFinite(v) && v > 0) {
                      console.log(`[DEBUG] Setting viewingVersion to ${v} - Source: userSwitch`);
                      setViewingVersion(v);
                      setLoadedVersion(v); // Reset loadedVersion to current document version for new user
                      try { window.dispatchEvent(new CustomEvent('version:view', { detail: { version: v, payload: { messagePlatform: plat } } })); } catch {}
                    }
                  } catch {}
                  
                  // Load the latest document for the new user (no banner needed)
                  try {
                    const w = `${API_BASE}/documents/working/default.docx`;
                    const c = `${API_BASE}/documents/canonical/default.docx`;
                    let url = c;
                    try {
                      const h = await fetch(w, { method: 'HEAD' });
                      if (h.ok) {
                        const len = Number(h.headers.get('content-length') || '0');
                        if (Number.isFinite(len) && len > 1024) url = w; // Use working if it exists and is valid
                      }
                    } catch {}
                    const finalUrl = `${url}?rev=${Date.now()}`;
                    if (plat === 'word') {
                      // Load latest document in Word
                      const res = await fetch(finalUrl, { cache: 'no-store' });
                      if (res && res.ok) {
                        const buf = await res.arrayBuffer();
                        const b64 = (function(buf){ let bin=''; const bytes=new Uint8Array(buf); for(let i=0;i<bytes.byteLength;i++) bin+=String.fromCharCode(bytes[i]); return btoa(bin); })(buf);
                        await Word.run(async (context) => { context.document.body.insertFileFromBase64(b64, Word.InsertLocation.replace); await context.sync(); });
                      }
                    } else {
                      // Load latest document in Web
                      setDocumentSource(finalUrl);
                    }
                    addLog(`Loaded latest document for user: ${nextUserId}`, 'success');
                  } catch {}
                }
              } catch {}
            })();
          } catch {}
        },
      }), [API_BASE, refresh, userId, addLog, viewingVersion]);

      return React.createElement(StateContext.Provider, { value: { config, revision, actions, isConnected, lastTs, currentUser: userId, currentRole: role, users, activities, lastSeenActivityId, markActivitiesSeen, logs, addLog, lastSeenLogCount, markNotificationsSeen, documentSource, setDocumentSource, lastError, setLastError: addError, loadedVersion, setLoadedVersion, dismissedVersion, setDismissedVersion, approvalsSummary, approvalsRevision, messagingUnreadCount, setmessagingUnreadCount, renderNotification, formatNotification, viewingVersion, setViewingVersion, refresh } }, React.createElement(App, { config }));
    }

    function BannerStack(props) {
      const { tokens } = React.useContext(ThemeContext);
      const { config, loadedVersion, setLoadedVersion, dismissedVersion, setDismissedVersion, revision, addLog, setDocumentSource, setViewingVersion } = React.useContext(StateContext);
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
          if (Number.isFinite(serverVersion) && serverVersion > 0) {
            console.log(`[DEBUG] Setting viewingVersion to ${serverVersion} - Source: refreshNow`);
            setLoadedVersion(serverVersion);
            try { setViewingVersion(serverVersion); } catch {}
            try {
              const plat = (function(){ try { return (typeof Office !== 'undefined') ? 'word' : 'web'; } catch { return 'web'; } })();
              window.dispatchEvent(new CustomEvent('version:view', { detail: { version: serverVersion, payload: { messagePlatform: plat } } }));
            } catch {}
          }
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
      const { config, actions, revision, setDocumentSource, addLog, setLoadedVersion, users, currentUser, viewingVersion } = React.useContext(StateContext);
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
            const withRev = `${url}?rev=${Date.now()}`;
            const res = await fetch(withRev, { cache: 'no-store' }); if (!res.ok) throw new Error('download');
            const buf = await res.arrayBuffer();
            const b64 = (function(buf){ let bin=''; const bytes=new Uint8Array(buf); for(let i=0;i<bytes.byteLength;i++) bin+=String.fromCharCode(bytes[i]); return btoa(bin); })(buf);
            await Word.run(async (context) => { context.document.body.insertFileFromBase64(b64, Word.InsertLocation.replace); await context.sync(); });
            // Note: Messaging is server-based now, AI chat persists until explicit reset
            // Only factory reset or AI reset button should clear chat history
            try {
              const plat = 'word';
              const u = `${API_BASE}/api/v1/state-matrix?platform=${plat}&clientVersion=0&userId=${encodeURIComponent(String(currentUser||'user1'))}`;
              const r = await fetch(u);
              const j = await r.json();
              const v = Number(j?.config?.documentVersion || 0);
              if (v > 0) {
                setLoadedVersion(v);
                try { setViewingVersion(v); } catch {}
                try { window.dispatchEvent(new CustomEvent('version:view', { detail: { version: v, payload: { messagePlatform: plat } } })); } catch {}
              }
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
            const finalUrl = `${url}?rev=${Date.now()}`;
            setDocumentSource(finalUrl);
            addLog(`doc src viewLatest -> ${finalUrl}`);
            // Note: Messaging is server-based now, AI chat persists until explicit reset
            // Only factory reset or AI reset button should clear chat history
            try {
              const plat = 'web';
              const u = `${API_BASE}/api/v1/state-matrix?platform=${plat}&clientVersion=0&userId=${encodeURIComponent(String(currentUser||'user1'))}`;
              const r = await fetch(u);
              const j = await r.json();
              const v = Number(j?.config?.documentVersion || 0);
              if (v > 0) {
                setLoadedVersion(v);
                try { setViewingVersion(v); } catch {}
                try { window.dispatchEvent(new CustomEvent('version:view', { detail: { version: v, payload: { messagePlatform: plat } } })); } catch {}
              }
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
      // Handler for opening a new document
      const handleOpenNewDocument = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        input.onchange = async (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          
          try {
            // Upload to server (will log activity automatically)
            const API_BASE = getApiBase();
            const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', currentUser || 'user1');
            formData.append('platform', isWord ? 'word' : 'web');
            
            const uploadResponse = await fetch(`${API_BASE}/api/v1/document/upload`, {
              method: 'POST',
              body: formData
            });
            
            if (!uploadResponse.ok) {
              console.error('Upload failed:', uploadResponse.status);
              return;
            }
            
            // Platform-specific document loading
            if (isWord) {
              // Insert document into Word
              const buf = await file.arrayBuffer();
              const b64 = (function(buf) {
                let bin = '';
                const bytes = new Uint8Array(buf);
                for (let i = 0; i < bytes.byteLength; i++) {
                  bin += String.fromCharCode(bytes[i]);
                }
                return btoa(bin);
              })(buf);
              
              try {
                await Word.run(async (context) => {
                  context.document.body.insertFileFromBase64(b64, Word.InsertLocation.replace);
                  await context.sync();
                });
              } catch (err) {
                console.error('Error inserting document into Word:', err);
              }
            } else {
              // Load document in SuperDoc
              setDocumentSource(file);
            }
          } catch (err) {
            console.error('Error opening new document:', err);
          }
        };
        input.click();
      };

      const nestedItems = [
        menuItem('Open New Document', handleOpenNewDocument, !isWord), // Hide in add-in (already has button)
        menuItem('Compile', () => { try { setTimeout(() => { try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'compile' } })); } catch {} }, 130); } catch {} }, true),
        menuItem('Override Checkout', actions.override, !!btns.overrideBtn),
        menuItem('Scenario Loader', () => { try { setTimeout(() => { try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'factory-reset' } })); } catch {} }, 130); } catch {} }, true, { danger: true }),
      ].filter(Boolean);

      // Compute special case: only checkout is available (plus menu)
      const onlyCheckout = !!btns.checkoutBtn && !btns.checkinBtn && !btns.cancelBtn && !btns.saveProgressBtn && !btns.overrideBtn;

      // Top: checkout cluster with menu immediately adjacent (default)
      const menuAnchorRef = React.useRef(null);
      const topCluster = [
        add('Checkout', actions.checkout, !!btns.checkoutBtn),
        React.createElement('div', { style: { position: 'relative' } }, [
          React.createElement('span', { key: 'anchor', ref: menuAnchorRef },
            add('⋮', () => setMenuOpen(!menuOpen), true, 'secondary', { style: { minWidth: '37px' } })
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

      // Show banner if viewing old version
      const isViewingOldVersion = (() => {
        try {
          const currentVersion = Number(config?.documentVersion || 1);
          const viewing = Number(viewingVersion || 1);
          return viewing < currentVersion;
        } catch {
          return false;
        }
      })();
      
      const showUpdateBanner = isViewingOldVersion;
      const updateBannerParts = (function(){
        try {
          if (isViewingOldVersion) {
            const currentVersion = Number(config?.documentVersion || 1);
          return {
              title: 'New Version Available',
              message: `You're viewing version ${viewingVersion}, the latest is ${currentVersion}.`
          };
          }
          return { title: '', message: '' };
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

    function FinalizeCelebration() {
      // Listen for status change to 'final' and trigger confetti
      React.useEffect(() => {
        const handleStatusChange = (event) => {
          try {
            const data = event.detail || {};
            console.log('🎉 Finalize: Status change event received:', data);
            // Check if status changed to 'final'
            if (data.status === 'final') {
              console.log('🎉 Finalize: Triggering confetti celebration!');
              
              // Trigger confetti.js celebration
              if (window.confetti) {
                // Multiple bursts for epic celebration
                const duration = 5000;
                const animationEnd = Date.now() + duration;
                
                const randomInRange = (min, max) => Math.random() * (max - min) + min;
                
                const interval = setInterval(() => {
                  const timeLeft = animationEnd - Date.now();
                  
                  if (timeLeft <= 0) {
                    clearInterval(interval);
                    return;
                  }
                  
                  // Random confetti bursts
                  const particleCount = randomInRange(50, 200);
                  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#ff4757', '#2ed573', '#ffa502'];
                  
                  window.confetti({
                    particleCount: particleCount,
                    angle: randomInRange(45, 135),
                    spread: randomInRange(50, 120),
                    origin: { x: randomInRange(0.1, 0.9), y: randomInRange(0.1, 0.3) },
                    colors: colors,
                    ticks: randomInRange(200, 400),
                    scalar: randomInRange(0.5, 2)
                  });
                  
                  // Side bursts
                  if (Math.random() > 0.7) {
                    window.confetti({
                      particleCount: randomInRange(30, 100),
                      angle: randomInRange(60, 120),
                      spread: randomInRange(30, 80),
                      origin: { x: Math.random() > 0.5 ? 0 : 1, y: randomInRange(0.3, 0.7) },
                      colors: colors,
                      ticks: randomInRange(100, 200)
                    });
                  }
                }, 250);
              }
            }
          } catch (err) {
            console.error('❌ Finalize celebration error:', err);
          }
        };

        // Listen for custom status:change events dispatched from main SSE handler
        window.addEventListener('status:change', handleStatusChange);
        return () => window.removeEventListener('status:change', handleStatusChange);
      }, []);

      return null; // No DOM elements needed - confetti.js handles everything
    }

    function ApprovalCelebration() {
      const [showCelebration, setShowCelebration] = React.useState(false);

      // Listen for approval completion events
      React.useEffect(() => {
        const handleApprovalComplete = (event) => {
          try {
            const data = event.detail || {};
            if (data.type === 'approval:complete') {
              setShowCelebration(true);
              
              // Trigger confetti.js celebration
              if (window.confetti) {
                // Multiple bursts for epic celebration
                const duration = 5000;
                const animationEnd = Date.now() + duration;
                
                const randomInRange = (min, max) => Math.random() * (max - min) + min;
                
                const interval = setInterval(() => {
                  const timeLeft = animationEnd - Date.now();
                  
                  if (timeLeft <= 0) {
                    clearInterval(interval);
                    setShowCelebration(false);
                    return;
                  }
                  
                  // Random confetti bursts
                  const particleCount = randomInRange(50, 200);
                  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#ff4757', '#2ed573', '#ffa502'];
                  
                  window.confetti({
                    particleCount: particleCount,
                    angle: randomInRange(45, 135),
                    spread: randomInRange(50, 120),
                    origin: { x: randomInRange(0.1, 0.9), y: randomInRange(0.1, 0.3) },
                    colors: colors,
                    shapes: ['circle', 'square'],
                    scalar: randomInRange(0.5, 2)
                  });
                  
                  // Side bursts
                  if (Math.random() > 0.7) {
                    window.confetti({
                      particleCount: randomInRange(30, 100),
                      angle: randomInRange(60, 120),
                      spread: randomInRange(30, 80),
                      origin: { x: Math.random() > 0.5 ? 0 : 1, y: randomInRange(0.3, 0.7) },
                      colors: colors,
                      shapes: ['circle', 'square'],
                      scalar: randomInRange(0.5, 1.5)
                    });
                  }
                }, 200);
              }
            }
          } catch {}
        };

        window.addEventListener('approval:complete', handleApprovalComplete);
        return () => window.removeEventListener('approval:complete', handleApprovalComplete);
      }, []);

      return null; // No DOM elements needed - confetti.js handles everything
    }

    function ActivityPanel(props) {
      const { isActive } = props;
      const { activities, renderNotification, markActivitiesSeen } = React.useContext(StateContext);
      // Only mark activities as seen when the tab is actually active
      React.useEffect(() => { 
        if (isActive) {
          try { markActivitiesSeen?.(); } catch {} 
        }
      }, [isActive, markActivitiesSeen]);
      const copy = async () => {
        try {
          const text = (activities || []).slice().reverse().map(activity => {
            if (typeof activity === 'string') return activity;
            const timestamp = activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'Unknown';
            return `[${timestamp}] ${activity.message || activity.action || 'Unknown activity'}`;
          }).join('\n');
          if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(text);
        } catch {}
      };
      const exportToCSV = () => {
        try {
          // Build CSV with headers
          const headers = ['Timestamp', 'Type', 'User', 'Action', 'Target', 'Message'];
          const rows = (activities || []).slice().reverse().map(activity => {
            if (typeof activity === 'string') {
              return [activity, '', '', '', '', activity];
            }
            const timestamp = activity.timestamp ? new Date(activity.timestamp).toLocaleString() : '';
            const type = activity.type || '';
            const user = activity.user || '';
            const action = activity.action || '';
            const target = activity.target || '';
            const message = activity.message || '';
            // Escape CSV values (wrap in quotes if they contain commas, quotes, or newlines)
            const escape = (val) => {
              const str = String(val || '');
              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
              }
              return str;
            };
            return [timestamp, type, user, action, target, message].map(escape);
          });
          const csv = [headers.join(',')].concat(rows.map(row => row.join(','))).join('\n');
          
          // Create download link
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', `activity-log-${new Date().toISOString().slice(0, 10)}.csv`);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error('Failed to export CSV:', err);
        }
      };
      const isAddin = typeof Office !== 'undefined';
      const list = (activities || []).length
        ? React.createElement('div', { className: 'notifications-list', style: { maxHeight: 'none', overflow: 'visible' } }, (activities || []).slice().reverse().map((activity, index) => renderNotification(activity, index)).filter(Boolean))
        : React.createElement('div', { className: 'text-gray-500', style: { padding: 8 } }, 'No activity yet.');
      
      const footerBar = React.createElement('div', { 
        className: 'd-flex flex-column gap-8', 
        style: { 
          width: '100%', 
          boxSizing: 'border-box', 
          paddingTop: 8, 
          paddingBottom: isAddin ? 8 : 12, 
          paddingLeft: isAddin ? 0 : 12, 
          paddingRight: isAddin ? 0 : 12 
        } 
      }, [
        React.createElement(UIButton, { key: 'copy', label: 'Copy', onClick: copy, variant: 'primary' }),
        React.createElement(UIButton, { key: 'export', label: 'Export to CSV', onClick: exportToCSV, variant: 'secondary' })
      ]);
      
      const wrap = React.createElement('div', { style: { width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } }, [
        React.createElement('div', { key: 'list', style: { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: isAddin ? '8px' : '12px' } }, [list]),
        React.createElement('div', { key: 'footer', style: { flexShrink: 0, background: '#fff', borderTop: '1px solid #e5e7eb' } }, [footerBar])
      ]);
      
      return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, height: '100%' } }, [wrap]);
    }

    // Word add-in: listen for navigation events and jump to text
    try {
      if (typeof window !== 'undefined') {
        window.removeEventListener && window.removeEventListener('document:navigate', window.__ogDocNavigateHandler || (()=>{}));
        const handler = async (event) => {
          try {
            const detail = event && event.detail ? event.detail : (event && event.payload ? event.payload : {});
            const text = String(detail && (detail.text || ''));
            const changeType = String(detail && (detail.changeType || 'change'));
            const contextBefore = String(detail && (detail.contextBefore || ''));
            const contextAfter = String(detail && (detail.contextAfter || ''));
            const targetVersion = Number(detail && detail.targetVersion ? detail.targetVersion : 0);
            console.log('[UI] document:navigate event', { textLen: text.length, changeType, hasCtx: !!(contextBefore || contextAfter) });
            if (!text || typeof Office === 'undefined' || typeof Word === 'undefined') return;
            // If a specific version is provided, load it first so deleted text context exists
            if (Number.isFinite(targetVersion) && targetVersion > 0) {
              try { window.dispatchEvent(new CustomEvent('version:view', { detail: { version: targetVersion } })); } catch {}
              await new Promise(res => setTimeout(res, 900));
            }
            await Word.run(async (context) => {
              const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
              const searchText = norm(text);
              const beforeNorm = norm(contextBefore);
              const afterNorm = norm(contextAfter);
              const opts = { matchCase: false, matchWholeWord: false, ignorePunct: true, ignoreSpace: true };

              let searchResults = context.document.body.search(searchText, opts);
              searchResults.load('items');
              await context.sync();
              if (!(searchResults.items && searchResults.items.length > 0) && (beforeNorm || afterNorm)) {
                const contextWindow = `${beforeNorm} ${searchText} ${afterNorm}`.slice(0, 500);
                searchResults = context.document.body.search(contextWindow, opts);
                searchResults.load('items');
                await context.sync();
              }
              if (!(searchResults.items && searchResults.items.length > 0) && beforeNorm) {
                const beforeOnly = String(beforeNorm).slice(-200);
                searchResults = context.document.body.search(beforeOnly, opts);
                searchResults.load('items');
                await context.sync();
              }
              if (!(searchResults.items && searchResults.items.length > 0) && afterNorm) {
                const afterOnly = String(afterNorm).slice(0, 200);
                searchResults = context.document.body.search(afterOnly, opts);
                searchResults.load('items');
                await context.sync();
              }
              if (!(searchResults.items && searchResults.items.length > 0)) {
                const token = (searchText.split(/\s+/).find(t => t && t.length >= 4)) || searchText;
                searchResults = context.document.body.search(token, opts);
                searchResults.load('items');
                await context.sync();
              }
              // Final fallback for very small insertions: anchor near context edges
              if (!(searchResults.items && searchResults.items.length > 0) && (beforeNorm || afterNorm)) {
                const beforeWords = beforeNorm ? beforeNorm.split(/\s+/).filter(Boolean) : [];
                const afterWords = afterNorm ? afterNorm.split(/\s+/).filter(Boolean) : [];
                const beforeAnchor = beforeWords.length ? beforeWords.slice(Math.max(0, beforeWords.length - 5)).join(' ') : '';
                const afterAnchor = afterWords.length ? afterWords.slice(0, Math.min(5, afterWords.length)).join(' ') : '';
                if (beforeAnchor) {
                  searchResults = context.document.body.search(beforeAnchor, opts);
                  searchResults.load('items');
                  await context.sync();
                }
                if (!(searchResults.items && searchResults.items.length > 0) && afterAnchor) {
                  searchResults = context.document.body.search(afterAnchor, opts);
                  searchResults.load('items');
                  await context.sync();
                }
              }
              if (searchResults.items && searchResults.items.length > 0) {
                const range = searchResults.items[0];
                range.select();
                range.scrollIntoView();
                if (changeType === 'addition') range.font.highlightColor = 'lightGreen';
                else if (changeType === 'deletion') range.font.highlightColor = 'lightPink';
                else range.font.highlightColor = 'yellow';
                await context.sync();
              } else {
                try { console.warn('[UI] document:navigate: no match found after fallbacks', { textLen: searchText.length }); } catch {}
              }
            });
          } catch {}
        };
        window.__ogDocNavigateHandler = handler;
        window.addEventListener('document:navigate', handler);
      }
    } catch {}

    // Web viewer: listen for navigation events and jump to text using SuperDoc
    try {
      if (typeof window !== 'undefined' && typeof Office === 'undefined') {
        window.removeEventListener && window.removeEventListener('document:navigate', window.__ogWebDocNavigateHandler || (()=>{}));
        const webHandler = async (event) => {
          try {
            const detail = event && event.detail ? event.detail : (event && event.payload ? event.payload : {});
            const text = String(detail && (detail.text || ''));
            const changeType = String(detail && (detail.changeType || 'change'));
            const contextBefore = String(detail && (detail.contextBefore || ''));
            const contextAfter = String(detail && (detail.contextAfter || ''));
            const targetVersion = Number(detail && detail.targetVersion ? detail.targetVersion : 0);
            console.log('[UI Web] document:navigate event', { textLen: text.length, changeType, hasCtx: !!(contextBefore || contextAfter) });
            
            if (!text || !window.superdocInstance || !window.superdocInstance.editor) return;
            
            // If a specific version is provided, load it first
            if (Number.isFinite(targetVersion) && targetVersion > 0) {
              try { window.dispatchEvent(new CustomEvent('version:view', { detail: { version: targetVersion } })); } catch {}
              await new Promise(res => setTimeout(res, 900));
            }
            
            const editor = window.superdocInstance.editor;
            const state = editor.view.state;
            const doc = state.doc;
            
            // Normalize text for comparison
            const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim().toLowerCase();
            const searchText = norm(text);
            const beforeNorm = norm(contextBefore);
            const afterNorm = norm(contextAfter);
            
            let foundPos = null;
            let foundSize = 0;
            
            // Search through document for matching text
            doc.descendants((node, pos) => {
              if (foundPos !== null) return false; // Already found
              if (!node.isText) return;
              
              const nodeText = norm(node.text);
              
              // Try exact match first
              if (nodeText.includes(searchText)) {
                foundPos = pos + nodeText.indexOf(searchText);
                foundSize = text.length;
                return false;
              }
              
              // Try with context
              if (beforeNorm || afterNorm) {
                const contextWindow = norm(`${contextBefore} ${text} ${contextAfter}`);
                if (nodeText.includes(contextWindow)) {
                  foundPos = pos + nodeText.indexOf(searchText);
                  foundSize = text.length;
                  return false;
                }
              }
            });
            
            if (foundPos !== null) {
              // Create selection at found position
              const tr = state.tr;
              const $pos = doc.resolve(foundPos);
              const selection = state.selection.constructor.near($pos);
              tr.setSelection(selection);
              
              // Apply highlighting decoration
              const highlightColor = changeType === 'addition' ? '#c6f6d5' : (changeType === 'deletion' ? '#fed7d7' : '#fef3c7');
              const from = foundPos;
              const to = foundPos + foundSize;
              
              // Dispatch transaction
              editor.view.dispatch(tr.scrollIntoView());
              
              // Add temporary highlight by wrapping in a mark (if marks are available)
              console.log('[UI Web] Found and scrolled to text at position:', foundPos);
              
              // Find the DOM element and add temporary CSS class
              setTimeout(() => {
                try {
                  const domAtPos = editor.view.domAtPos(foundPos);
                  if (domAtPos && domAtPos.node) {
                    let element = domAtPos.node;
                    if (element.nodeType === Node.TEXT_NODE) {
                      element = element.parentElement;
                    }
                    if (element) {
                      element.style.backgroundColor = highlightColor;
                      element.style.transition = 'background-color 2s ease-out';
                      setTimeout(() => {
                        element.style.backgroundColor = '';
                      }, 2000);
                    }
                  }
                } catch (e) {
                  console.warn('[UI Web] Could not highlight text:', e);
                }
              }, 100);
            } else {
              console.warn('[UI Web] document:navigate: no match found', { searchText, textLen: text.length });
            }
          } catch (e) {
            console.error('[UI Web] document:navigate error:', e);
          }
        };
        window.__ogWebDocNavigateHandler = webHandler;
        window.addEventListener('document:navigate', webHandler);
      }
    } catch {}

    // Messages Panel (full-page messaging with Attorney-Client Privilege/internal flags)
    function MessagingPanel() {
      const API_BASE = getApiBase();
      const { currentUser: userId, users, setmessagingUnreadCount } = React.useContext(StateContext);
      
      const [messages, setMessages] = React.useState([]);
      const [view, setView] = React.useState('list'); // 'list' or 'conversation'
      const [activeMessageId, setActiveMessageId] = React.useState(null);
      const [filter, setFilter] = React.useState({ states: ['open'], internal: false, external: false, privileged: false, unread: false, search: '' });
      const [showNewMessage, setShowNewMessage] = React.useState(false);
      const [showExportModal, setShowExportModal] = React.useState(false);
      const [summary, setSummary] = React.useState({ messages: { open: 0, unreadForMe: 0, privileged: 0, internal: 0, external: 0, archived: 0 } });
      
      // Compute message title from current user's perspective
      // Show names of other participants (excluding current user)
      function getMessageTitle(message) {
        if (!message || !message.participants) return 'Unknown';
        const otherParticipants = message.participants.filter(p => p.userId !== userId);
        if (otherParticipants.length === 0) return 'Me';
        return otherParticipants.map(p => p.label).join(', ');
      }
      
      // Toggle state filter (open, archived)
      function toggleStateFilter(state) {
        const currentStates = filter.states || ['open'];
        let newStates;
        if (currentStates.includes(state)) {
          // Remove if present
          newStates = currentStates.filter(s => s !== state);
          // Ensure at least one state is selected
          if (newStates.length === 0) newStates = [state];
        } else {
          // Add if not present
          newStates = [...currentStates, state];
        }
        setFilter({ ...filter, states: newStates });
      }
      
      // Toggle flag filters (internal, external, privileged)
      function toggleFlagFilter(flag) {
        setFilter({ ...filter, [flag]: !filter[flag] });
      }
      
      // Open conversation view
      function openConversation(messageId) {
        setActiveMessageId(messageId);
        setView('conversation');
      }
      
      // Load messages
      const loadMessages = React.useCallback(async () => {
        try {
          console.log('🔄 [MessagingPanel] loadMessages called');
          // Fetch messages for each selected state and combine
          const states = filter.states || ['open'];
          const allMessages = [];
          
          for (const state of states) {
            const params = new URLSearchParams({
              userId,
              state,
              search: filter.search
            });
            
            const r = await fetch(`${API_BASE}/api/v1/messages?${params}`);
            if (r.ok) {
              const data = await r.json();
              console.log(`📥 [MessagingPanel] Fetched ${data.messages?.length || 0} messages for state "${state}"`);
              allMessages.push(...(data.messages || []));
            }
          }
          
          // Remove duplicates
          let uniqueMessages = Array.from(new Map(allMessages.map(m => [m.messageId, m])).values());
          
          // Apply client-side flag filters
          if (filter.internal) {
            uniqueMessages = uniqueMessages.filter(m => m.internal === true);
          }
          if (filter.external) {
            uniqueMessages = uniqueMessages.filter(m => m.external === true);
          }
          if (filter.privileged) {
            uniqueMessages = uniqueMessages.filter(m => m.privileged === true);
          }
          if (filter.unread) {
            uniqueMessages = uniqueMessages.filter(m => m.unreadBy && m.unreadBy.includes(userId));
          }
          
          // Sort by lastPostAt
          uniqueMessages.sort((a, b) => b.lastPostAt - a.lastPostAt);
          console.log(`✅ [MessagingPanel] Set ${uniqueMessages.length} messages after filtering`);
          setMessages(uniqueMessages);
        } catch (e) {
          console.error('Failed to load messages:', e);
        }
      }, [API_BASE, userId, filter]);
      
      // Load summary
      const loadSummary = React.useCallback(async () => {
        try {
          const r = await fetch(`${API_BASE}/api/v1/discussion/summary?userId=${userId}`);
          if (r.ok) {
            const data = await r.json();
            setSummary(data);
            // Update global unread count for tab badge
            if (setmessagingUnreadCount && data.messages && data.messages.unreadForMe !== undefined) {
              setmessagingUnreadCount(data.messages.unreadForMe);
            }
          }
        } catch (e) {
          console.error('Failed to load summary:', e);
        }
      }, [API_BASE, userId, setmessagingUnreadCount]);
      
      React.useEffect(() => {
        loadMessages();
        loadSummary();
      }, [loadMessages, loadSummary]);
      
      // SSE listener
      React.useEffect(() => {
        const handler = (ev) => {
          const data = ev.detail || {};
          if (data.type && data.type.startsWith('message:')) {
            loadMessages();
            loadSummary();
          }
        };
        window.addEventListener('message:created', handler);
        window.addEventListener('message:post-added', handler);
        window.addEventListener('message:state-changed', handler);
        window.addEventListener('message:flags-updated', handler);
        window.addEventListener('message:read', handler);
        window.addEventListener('message:deleted', handler);
        return () => {
          window.removeEventListener('message:created', handler);
          window.removeEventListener('message:post-added', handler);
          window.removeEventListener('message:state-changed', handler);
          window.removeEventListener('message:flags-updated', handler);
          window.removeEventListener('message:read', handler);
          window.removeEventListener('message:deleted', handler);
        };
      }, [loadMessages, loadSummary]);
      
      // Factory reset handler
      React.useEffect(() => {
        const onFactoryReset = () => {
          console.log('🔄 [MessagingPanel] Factory reset event received - reloading messages');
          setMessages([]);
          setView('list');
          setActiveMessageId(null);
          setSummary({ messages: { open: 0, unreadForMe: 0, privileged: 0, internal: 0, external: 0, archived: 0 } });
          loadMessages();
          loadSummary();
        };
        const onMessagingReset = () => {
          console.log('🔄 [MessagingPanel] Messaging reset event received - reloading messages');
          setMessages([]);
          setView('list');
          setActiveMessageId(null);
          setSummary({ messages: { open: 0, unreadForMe: 0, privileged: 0, internal: 0, external: 0, archived: 0 } });
          loadMessages();
          loadSummary();
        };
        window.addEventListener('factoryReset', onFactoryReset);
        window.addEventListener('messaging:reset', onMessagingReset);
        return () => {
          window.removeEventListener('factoryReset', onFactoryReset);
          window.removeEventListener('messaging:reset', onMessagingReset);
        };
      }, [loadMessages, loadSummary]);
      
      // If viewing conversation, show conversation page
      if (view === 'conversation' && activeMessageId) {
        return React.createElement(ConversationView, {
          messageId: activeMessageId,
          userId: userId,
          getMessageTitle: getMessageTitle,
          onBack: () => { setView('list'); setActiveMessageId(null); },
          onUpdate: () => { loadMessages(); loadSummary(); }
        });
      }
      
      // Otherwise show list view
      const currentStates = filter.states || ['open'];
      return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 0 } }, [
        // Search + New + Export buttons
        React.createElement('div', { key: 'filters', style: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } }, [
          React.createElement('input', { 
            key: 'search', 
            placeholder: 'Search…', 
            value: filter.search, 
            onChange: e => setFilter({ ...filter, search: e.target.value }),
            style: { flex: 1, minWidth: 100, padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #e5e7eb' }
          }),
          React.createElement('button', {
            key: 'new',
            onClick: () => setShowNewMessage(true),
            style: { padding: '6px 12px', fontSize: 13, background: '#6d5ef1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 500 }
          }, 'New'),
          React.createElement('button', {
            key: 'export',
            onClick: () => setShowExportModal(true),
            style: { padding: '6px 12px', fontSize: 13, background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 6, cursor: 'pointer' }
          }, 'Export to CSV')
        ]),
        
        // Filter badges (order: Unread, Archived, Attorney-Client Privilege, Internal, External)
        // All badges always visible - no conditional rendering
        // Unread and Archived use same grey palette
        React.createElement('div', { key: 'badges', style: { display: 'flex', gap: 8, fontSize: 13, flexWrap: 'wrap' } }, [
          // 1. Unread - Grey (active: #d1d5db, inactive: #e5e7eb)
          React.createElement('button', { 
            key: 'unread',
            onClick: () => toggleFlagFilter('unread'),
            style: { 
              padding: '4px 10px', 
              fontSize: 12,
              background: filter.unread ? '#d1d5db' : '#e5e7eb',
              color: '#000',
              border: 'none',
              borderRadius: 4, 
              cursor: 'pointer'
            } 
          }, `Unread: ${summary.messages.unreadForMe || 0}`),
          // 2. Archived - Grey (active: #d1d5db, inactive: #e5e7eb)
          React.createElement('button', { 
            key: 'archived',
            onClick: () => toggleStateFilter('archived'),
            style: { 
              padding: '4px 10px', 
              fontSize: 12,
              background: currentStates.includes('archived') ? '#d1d5db' : '#e5e7eb',
              color: '#000',
              border: 'none',
              borderRadius: 4, 
              cursor: 'pointer'
            } 
          }, `Archived: ${summary.messages.archived || 0}`),
          // 4. Attorney-Client Privilege - Pink (active: #fce7f3, inactive: #fdf2f8)
          React.createElement('button', { 
            key: 'priv',
            onClick: () => toggleFlagFilter('privileged'),
            style: { 
              padding: '4px 10px', 
              fontSize: 12,
              background: filter.privileged ? '#fce7f3' : '#fdf2f8',
              color: '#000',
              border: 'none',
              borderRadius: 4, 
              cursor: 'pointer'
            } 
          }, `Attorney-Client Privilege: ${summary.messages.privileged || 0}`),
          // 5. Internal - Blue (active: #e0f2fe, inactive: #f0f9ff)
          React.createElement('button', { 
            key: 'internal',
            onClick: () => toggleFlagFilter('internal'),
            style: { 
              padding: '4px 10px', 
              fontSize: 12,
              background: filter.internal ? '#e0f2fe' : '#f0f9ff',
              color: '#000',
              border: 'none',
              borderRadius: 4, 
              cursor: 'pointer'
            } 
          }, `Internal: ${summary.messages.internal || 0}`),
          // 6. External - Yellow (active: #fef3c7, inactive: #fefce8)
          React.createElement('button', { 
            key: 'external',
            onClick: () => toggleFlagFilter('external'),
            style: { 
              padding: '4px 10px', 
              fontSize: 12,
              background: filter.external ? '#fef3c7' : '#fefce8',
              color: '#000',
              border: 'none',
              borderRadius: 4, 
              cursor: 'pointer'
            } 
          }, `External: ${summary.messages.external || 0}`)
        ]),
        
        // Message list
        React.createElement('div', { key: 'list', style: { flex: 1, overflow: 'auto', minHeight: 0 } }, 
          messages.length === 0 
            ? React.createElement('div', { style: { padding: 40, textAlign: 'center', color: '#6b7280' } }, 'No messages')
            : messages.map(msg => {
                const isUnread = msg.unreadBy && msg.unreadBy.includes(userId);
                const displayTitle = getMessageTitle(msg);
                return React.createElement('div', {
                  key: msg.messageId,
                  onClick: () => openConversation(msg.messageId),
                  style: { 
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    marginBottom: 8,
                    background: '#fff',
                    padding: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'background 0.15s ease'
                  },
                  onMouseEnter: (e) => { e.currentTarget.style.background = '#f9fafb'; },
                  onMouseLeave: (e) => { e.currentTarget.style.background = '#fff'; }
                }, [
                  React.createElement('div', { key: 'left', style: { flex: 1, minWidth: 0 } }, [
                    React.createElement('div', { key: 'title', style: { fontWeight: 600, fontSize: 14, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 } }, [
                      React.createElement('span', { key: 'text' }, displayTitle),
                      isUnread ? React.createElement('span', { key: 'dot', style: { width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 } }) : null
                    ]),
                    React.createElement('div', { key: 'meta', style: { fontSize: 12, color: '#6b7280' } }, `${msg.postCount || 0} message${msg.postCount !== 1 ? 's' : ''} • ${new Date(msg.lastPostAt).toLocaleDateString()}`)
                  ]),
                  React.createElement('div', { key: 'right', style: { display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: 12 } }, [
                    msg.privileged ? React.createElement('span', { key: 'priv', style: { padding: '3px 8px', fontSize: 11, background: '#fce7f3', borderRadius: 4, whiteSpace: 'nowrap' } }, 'Attorney-Client Privilege') : null,
                    msg.internal ? React.createElement('span', { key: 'int', style: { padding: '3px 8px', fontSize: 11, background: '#e0f2fe', borderRadius: 4, whiteSpace: 'nowrap' } }, 'Internal') : null,
                    msg.external ? React.createElement('span', { key: 'ext', style: { padding: '3px 8px', fontSize: 11, background: '#fef3c7', borderRadius: 4, whiteSpace: 'nowrap' } }, 'External') : null
                  ])
                ]);
              })
        ),
        
        // New Message Modal
        showNewMessage ? React.createElement(NewMessageModal, { 
          key: 'newmsg',
          onClose: () => setShowNewMessage(false),
          onCreate: () => { setShowNewMessage(false); loadMessages(); loadSummary(); }
        }) : null,
        
        // Export Modal
        showExportModal ? React.createElement(ExportModal, {
          key: 'exportmodal',
          messages: messages,
          getMessageTitle: getMessageTitle,
          onClose: () => setShowExportModal(false),
          userId: userId
        }) : null
      ]);
    }
    
    // Export Modal - select conversations to export
    function ExportModal(props) {
      const { messages, getMessageTitle, onClose, userId } = props;
      const API_BASE = getApiBase();
      const [selectedIds, setSelectedIds] = React.useState([]);
      
      function toggleSelection(messageId) {
        if (selectedIds.includes(messageId)) {
          setSelectedIds(selectedIds.filter(id => id !== messageId));
        } else {
          setSelectedIds([...selectedIds, messageId]);
        }
      }
      
      function selectAll() {
        setSelectedIds(messages.map(m => m.messageId));
      }
      
      function clearAll() {
        setSelectedIds([]);
      }
      
      function doExport() {
        if (selectedIds.length === 0) {
          alert('Please select at least one conversation to export');
          return;
        }
        const messageIdsParam = selectedIds.join(',');
        const url = `${API_BASE}/api/v1/messages/export.csv?scope=multiple&messageIds=${messageIdsParam}&includePosts=true`;
        window.open(url, '_blank');
        onClose();
      }
      
      return React.createElement('div', {
        style: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        },
        onClick: onClose
      }, [
        React.createElement('div', {
          key: 'modal',
          onClick: (e) => e.stopPropagation(),
          style: {
            background: '#fff',
            borderRadius: 8,
            padding: 24,
            maxWidth: 600,
            width: '90%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }
        }, [
          // Header
          React.createElement('div', { key: 'header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            React.createElement('h3', { key: 'title', style: { margin: 0, fontSize: 16, fontWeight: 600 } }, 'Export Conversations to CSV'),
            React.createElement('button', {
              key: 'close',
              onClick: onClose,
              style: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1 }
            }, '×')
          ]),
          
          // Actions
          React.createElement('div', { key: 'actions', style: { display: 'flex', gap: 8, fontSize: 13 } }, [
            React.createElement('button', {
              key: 'selectall',
              onClick: selectAll,
              style: { padding: '6px 12px', background: '#f3f4f6', border: 'none', borderRadius: 6, cursor: 'pointer' }
            }, 'Select All'),
            React.createElement('button', {
              key: 'clearall',
              onClick: clearAll,
              style: { padding: '6px 12px', background: '#f3f4f6', border: 'none', borderRadius: 6, cursor: 'pointer' }
            }, 'Clear All'),
            React.createElement('span', { key: 'count', style: { marginLeft: 'auto', color: '#6b7280', alignSelf: 'center' } }, `${selectedIds.length} selected`)
          ]),
          
          // List of conversations
          React.createElement('div', { key: 'list', style: { flex: 1, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 6, padding: 8 } },
            messages.length === 0
              ? React.createElement('div', { style: { padding: 20, textAlign: 'center', color: '#6b7280' } }, 'No conversations available')
              : messages.map(msg => {
                  const isChecked = selectedIds.includes(msg.messageId);
                  const displayTitle = getMessageTitle(msg);
                  return React.createElement('label', {
                    key: msg.messageId,
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: isChecked ? '#f0f9ff' : 'transparent'
                    },
                    onMouseEnter: (e) => { if (!isChecked) e.currentTarget.style.background = '#f9fafb'; },
                    onMouseLeave: (e) => { if (!isChecked) e.currentTarget.style.background = 'transparent'; }
                  }, [
                    React.createElement('input', {
                      key: 'checkbox',
                      type: 'checkbox',
                      checked: isChecked,
                      onChange: () => toggleSelection(msg.messageId),
                      style: { cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }
                    }),
                    React.createElement('div', { key: 'info', style: { flex: 1, minWidth: 0 } }, [
                      React.createElement('div', { key: 'title', style: { fontWeight: 600, fontSize: 13, marginBottom: 2 } }, displayTitle),
                      React.createElement('div', { key: 'meta', style: { fontSize: 11, color: '#6b7280' } }, `${msg.postCount || 0} message${msg.postCount !== 1 ? 's' : ''}`)
                    ])
                  ]);
                })
          ),
          
          // Footer buttons
          React.createElement('div', { key: 'footer', style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } }, [
            React.createElement('button', {
              key: 'cancel',
              onClick: onClose,
              style: { padding: '8px 16px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }
            }, 'Cancel'),
            React.createElement('button', {
              key: 'export',
              onClick: doExport,
              disabled: selectedIds.length === 0,
              style: {
                padding: '8px 16px',
                background: selectedIds.length === 0 ? '#d1d5db' : '#6d5ef1',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 500
              }
            }, 'Export')
          ])
        ])
      ]);
    }
    
    // Message Conversation View (full-page view for a single thread)
    function ConversationView(props) {
      const { messageId, userId: propsUserId, getMessageTitle, onBack, onUpdate } = props || {};
      const API_BASE = getApiBase();
      const { currentUser: contextUserId } = React.useContext(StateContext);
      const userId = propsUserId || contextUserId;
      
      const [message, setMessage] = React.useState(null);
      const [composeText, setComposeText] = React.useState('');
      const [showConfirmModal, setShowConfirmModal] = React.useState(null); // 'archive' or 'delete'
      const listRef = React.useRef(null);
      const isAddin = typeof Office !== 'undefined';
      
      // Load message details
      React.useEffect(() => {
        const loadMessage = async () => {
          try {
            const r = await fetch(`${API_BASE}/api/v1/messages?userId=${userId}`);
            if (r.ok) {
              const data = await r.json();
              const foundMessage = data.messages.find(t => t.messageId === messageId);
              if (foundMessage) {
                setMessage(foundMessage);
                // Mark as read when opened
                markRead();
              }
            }
          } catch (e) {
            console.error('Failed to load message:', e);
          }
        };
        loadMessage();
      }, [API_BASE, userId, messageId]);
      
      // Auto-scroll to bottom when messages change
      React.useEffect(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      }, [message?.posts]);
      
      async function markRead() {
        try {
          // Mark as read (unread=false)
          await fetch(`${API_BASE}/api/v1/messages/${messageId}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ unread: false, userId })
          });
          if (onUpdate) onUpdate();
        } catch (e) {
          console.error('Failed to mark read:', e);
        }
      }
      
      async function sendPost() {
        const text = composeText.trim();
        if (!text) return;
        try {
          await fetch(`${API_BASE}/api/v1/messages/${messageId}/post`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, userId })
          });
          setComposeText('');
          // Reload message
          const r = await fetch(`${API_BASE}/api/v1/messages?userId=${userId}`);
          if (r.ok) {
            const data = await r.json();
            const foundMessage = data.messages.find(t => t.messageId === messageId);
            if (foundMessage) setMessage(foundMessage);
          }
          if (onUpdate) onUpdate();
        } catch (e) {
          console.error('Failed to send post:', e);
        }
      }
      
      async function toggleFlag(flag, value) {
        try {
          const body = { userId };
          body[flag] = value;
          await fetch(`${API_BASE}/api/v1/messages/${messageId}/flags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          // Reload message
          const r = await fetch(`${API_BASE}/api/v1/messages?userId=${userId}`);
          if (r.ok) {
            const data = await r.json();
            const foundMessage = data.messages.find(t => t.messageId === messageId);
            if (foundMessage) setMessage(foundMessage);
          }
          if (onUpdate) onUpdate();
        } catch (e) {
          console.error('Failed to toggle flag:', e);
        }
      }
      
      async function toggleRead() {
        try {
          // Simple toggle: if currently unread, mark as read (unread=false), and vice versa
          const isCurrentlyUnread = message.unreadBy && message.unreadBy.includes(userId);
          
          await fetch(`${API_BASE}/api/v1/messages/${messageId}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ unread: !isCurrentlyUnread, userId })
          });
          
          // Reload message
          const r = await fetch(`${API_BASE}/api/v1/messages?userId=${userId}`);
          if (r.ok) {
            const data = await r.json();
            const foundMessage = data.messages.find(t => t.messageId === messageId);
            if (foundMessage) setMessage(foundMessage);
          }
          if (onUpdate) onUpdate();
        } catch (e) {
          console.error('Failed to toggle read state:', e);
        }
      }
      
      function toggleArchive() {
        setShowConfirmModal('archive');
      }
      
      async function confirmArchive() {
        try {
          const isArchived = message.archivedBy && message.archivedBy.includes(userId);
          const newState = isArchived ? 'open' : 'archived';
          
          await fetch(`${API_BASE}/api/v1/messages/${messageId}/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: newState, userId })
          });
          
          // Reload message
          const r = await fetch(`${API_BASE}/api/v1/messages?userId=${userId}`);
          if (r.ok) {
            const data = await r.json();
            const foundMessage = data.messages.find(t => t.messageId === messageId);
            if (foundMessage) {
              setMessage(foundMessage);
            } else {
              // Message is no longer visible (filtered out), go back
              if (onBack) onBack();
            }
          }
          if (onUpdate) onUpdate();
          setShowConfirmModal(null);
        } catch (e) {
          console.error('Failed to toggle archive:', e);
          setShowConfirmModal(null);
        }
      }
      
      function deleteMessage() {
        setShowConfirmModal('delete');
      }
      
      async function confirmDelete() {
        try {
          await fetch(`${API_BASE}/api/v1/messages/${messageId}/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
          });
          if (onUpdate) onUpdate();
          if (onBack) onBack();
          setShowConfirmModal(null);
        } catch (e) {
          console.error('Failed to delete:', e);
          setShowConfirmModal(null);
        }
      }
      
      function exportCSV() {
        const url = `${API_BASE}/api/v1/messages/export.csv?scope=single&messageIds=${messageId}&includePosts=true`;
        window.open(url, '_blank');
      }
      
      if (!message) {
        return React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' } }, 'Loading...');
      }
      
      const onKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendPost();
        }
      };
      
      // Send icon (matching AI tab)
      const sendIcon = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true },
        React.createElement('path', { d: 'M12 4l0 12', stroke: 'white', 'stroke-width': 2.5, 'stroke-linecap': 'round' }),
        React.createElement('path', { d: 'M7.5 9.5L12 4l4.5 5.5', stroke: 'white', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
      );
      
      // Fixed header with back button and action buttons
      const header = React.createElement('div', { 
        style: { 
          padding: '12px', 
          borderBottom: '1px solid #e5e7eb', 
          background: '#fff', 
          flexShrink: 0 
        } 
      }, [
        React.createElement('div', { key: 'top', style: { display: 'flex', alignItems: 'center', marginBottom: 8 } }, [
          React.createElement('button', { 
            key: 'back',
            onClick: onBack,
            style: { 
              background: 'transparent', 
              border: 'none', 
              fontSize: 20, 
              cursor: 'pointer', 
              padding: '4px 8px', 
              marginRight: 8,
              color: '#6b7280'
            }
          }, '←'),
          React.createElement('div', { key: 'title', style: { flex: 1 } }, [
            React.createElement('div', { key: 'name', style: { fontWeight: 600, fontSize: 15 } }, getMessageTitle ? getMessageTitle(message) : message.title),
            message.participants && message.participants.length > 0 ? React.createElement('div', { key: 'emails', style: { fontSize: 11, color: '#9ca3af', marginTop: 2 } }, 
              message.participants.filter(p => p.userId !== userId).map(p => p.email).filter(e => e).join(', ')
            ) : null
          ]),
          // Archive and Delete icons on the right
          React.createElement('div', { key: 'right-icons', style: { display: 'flex', gap: 6, alignItems: 'center' } }, [
            React.createElement('button', { 
              key: 'archive-icon', 
              onClick: toggleArchive,
              title: (message.archivedBy && message.archivedBy.includes(userId)) ? 'Unarchive' : 'Archive',
              style: { 
                background: 'transparent',
                border: 'none',
                fontSize: 18,
                cursor: 'pointer',
                padding: '4px',
                color: '#6b7280',
                lineHeight: 1
              } 
            }, '🗄️'),
            React.createElement('button', { 
              key: 'delete-icon', 
              onClick: deleteMessage,
              title: 'Delete',
              style: { 
                background: 'transparent',
                border: 'none',
                fontSize: 18,
                cursor: 'pointer',
                padding: '4px',
                color: '#dc2626',
                lineHeight: 1
              } 
            }, '🗑️')
          ])
        ]),
        React.createElement('div', { key: 'actions', style: { display: 'flex', gap: 6, flexWrap: 'wrap' } }, [
          React.createElement('button', { 
            key: 'internal', 
            onClick: () => toggleFlag('internal', !message.internal), 
            style: { 
              padding: '4px 10px', 
              fontSize: 12, 
              fontWeight: message.internal ? 600 : 400,
              color: message.internal ? '#0c4a6e' : '#6b7280',
              background: message.internal ? '#e0f2fe' : '#f3f4f6', 
              border: 'none', 
              borderRadius: 4, 
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            } 
          }, message.internal ? '✓ Internal' : 'Internal'),
          React.createElement('button', { 
            key: 'external', 
            onClick: () => toggleFlag('external', !message.external), 
            style: { 
              padding: '4px 10px', 
              fontSize: 12, 
              fontWeight: message.external ? 600 : 400,
              color: message.external ? '#78350f' : '#6b7280',
              background: message.external ? '#fef3c7' : '#f3f4f6', 
              border: 'none', 
              borderRadius: 4, 
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            } 
          }, message.external ? '✓ External' : 'External'),
          React.createElement('button', { 
            key: 'priv', 
            onClick: () => toggleFlag('privileged', !message.privileged), 
            style: { 
              padding: '4px 10px', 
              fontSize: 12, 
              fontWeight: message.privileged ? 600 : 400,
              color: message.privileged ? '#831843' : '#6b7280',
              background: message.privileged ? '#fce7f3' : '#f3f4f6', 
              border: 'none', 
              borderRadius: 4, 
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            } 
          }, message.privileged ? '✓ Attorney-Client Privilege' : 'Attorney-Client Privilege'),
          React.createElement('button', { 
            key: 'read',
            onClick: toggleRead,
            title: (message.unreadBy && message.unreadBy.includes(userId)) ? 'Mark as read' : 'Mark as unread',
            style: { 
              padding: '4px 10px', 
              fontSize: 12,
              fontWeight: 400,
              color: '#6b7280',
              background: '#f3f4f6',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            } 
          }, (message.unreadBy && message.unreadBy.includes(userId)) ? '📧 Unread' : '📬 Read'),
          React.createElement('button', { 
            key: 'export', 
            onClick: exportCSV, 
            style: { 
              padding: '4px 10px', 
              fontSize: 12, 
              background: '#f3f4f6', 
              border: 'none', 
              borderRadius: 4, 
              cursor: 'pointer' 
            } 
          }, 'Export')
        ])
      ]);
      
      // Message history (scrollable middle) - styled like AI chat
      // Helper: determine if this is a group conversation (3+ participants)
      const allParticipants = message && message.participants ? [message.createdBy, ...message.participants] : [];
      const isGroupConversation = allParticipants.length >= 3;
      
      // Helper: color class for user (for group conversations)
      function colorClassForUser(uid) {
        try {
          const palette = ['alt-1','alt-2','alt-3','alt-4'];
          let sum = 0; 
          const s = String(uid || '');
          for (let i = 0; i < s.length; i++) sum = (sum + s.charCodeAt(i)) | 0;
          const idx = Math.abs(sum) % palette.length;
          return palette[idx];
        } catch { 
          return 'alt-1'; 
        }
      }
      
      const history = React.createElement('div', { 
        ref: listRef,
        style: { 
          flex: 1, 
          minHeight: 0, 
          overflowY: 'auto', 
          overflowX: 'hidden', 
          padding: isAddin ? '8px' : '12px',
          background: '#fff'
        } 
      }, 
        (message.posts || []).map(p => {
          const mine = String(p.author.userId) === String(userId);
          const rowCls = 'chat-bubble-row ' + (mine ? 'mine' : 'other');
          let bubbleCls = 'chat-bubble ' + (mine ? 'mine' : 'other');
          
          // For other people's messages
          if (!mine) {
            if (isGroupConversation) {
              // Group: use alternating colors per participant
              bubbleCls += (' ' + colorClassForUser(p.author.userId));
            } else {
              // DM (2 people): use grey
              bubbleCls += ' other-gray';
            }
          }
          
          const ts = new Date(p.createdAt).toLocaleString();
          
          // For group conversations, show author label for other people
          const showAuthorLabel = !mine && isGroupConversation;
          
          return React.createElement('div', { key: p.postId, className: rowCls }, [
            React.createElement('div', { key: 'ts', className: 'chat-timestamp ' + (mine ? 'mine' : 'other') }, ts),
            showAuthorLabel ? React.createElement('div', { key: 'author', className: 'chat-author-label' }, p.author.label) : null,
            React.createElement('div', { key: 'b', className: bubbleCls }, String(p.text || ''))
          ].filter(Boolean));
        })
      );
      
      // Fixed footer composer (matching AI tab)
      const sendBtn = React.createElement('button', { 
        className: 'btn-circle-primary chat-send', 
        onClick: sendPost, 
        title: 'Send',
        disabled: !composeText.trim()
      }, sendIcon);
      
      const composer = React.createElement('div', { className: 'chat-composer' }, [
        React.createElement('textarea', {
          key: 'textarea',
          value: composeText,
          onChange: (e) => setComposeText(e.target.value),
          onKeyPress: onKeyPress,
          placeholder: 'Type a message...',
          className: 'chat-input',
          rows: 2
        }),
        sendBtn
      ]);
      
      const footer = React.createElement('div', { 
        style: { 
          flexShrink: 0, 
          background: '#fff', 
          borderTop: '1px solid #e5e7eb' 
        } 
      }, [
        React.createElement('div', { 
          key: 'comp',
          className: 'd-flex flex-column gap-8', 
          style: { 
            width: '100%', 
            boxSizing: 'border-box', 
            paddingTop: 8, 
            paddingBottom: isAddin ? 8 : 12, 
            paddingLeft: isAddin ? 0 : 12, 
            paddingRight: isAddin ? 0 : 12 
          } 
        }, [
          React.createElement('div', { 
            key: 'input',
            className: 'd-flex gap-8 align-items-end', 
            style: { width: '100%', boxSizing: 'border-box' } 
          }, [
            React.createElement('div', { key: 'comp', style: { flex: 1 } }, composer)
          ])
        ])
      ]);
      
      // Confirmation modal
      const confirmModal = showConfirmModal ? React.createElement('div', {
        style: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        },
        onClick: () => setShowConfirmModal(null)
      }, [
        React.createElement('div', {
          key: 'modal',
          onClick: (e) => e.stopPropagation(),
          style: {
            background: '#fff',
            borderRadius: 8,
            padding: 24,
            maxWidth: 400,
            width: '90%'
          }
        }, [
          React.createElement('h3', { key: 'title', style: { margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 } }, 
            showConfirmModal === 'archive' 
              ? (message.archivedBy && message.archivedBy.includes(userId) ? 'Unarchive Conversation?' : 'Archive Conversation?')
              : 'Delete Conversation?'
          ),
          React.createElement('p', { key: 'message', style: { margin: '0 0 20px 0', fontSize: 14, color: '#6b7280' } },
            showConfirmModal === 'archive'
              ? (message.archivedBy && message.archivedBy.includes(userId) 
                  ? 'Move this conversation back to your open messages?'
                  : 'This will move the conversation to your archived messages. You can unarchive it later.')
              : 'This will remove the conversation from your view. Other participants will still see it.'
          ),
          React.createElement('div', { key: 'actions', style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } }, [
            React.createElement('button', {
              key: 'cancel',
              onClick: () => setShowConfirmModal(null),
              style: { padding: '8px 16px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }
            }, 'Cancel'),
            React.createElement('button', {
              key: 'confirm',
              onClick: showConfirmModal === 'archive' ? confirmArchive : confirmDelete,
              style: { 
                padding: '8px 16px', 
                background: showConfirmModal === 'delete' ? '#dc2626' : '#6d5ef1', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 6, 
                cursor: 'pointer', 
                fontSize: 13,
                fontWeight: 500
              }
            }, showConfirmModal === 'archive' 
                ? (message.archivedBy && message.archivedBy.includes(userId) ? 'Unarchive' : 'Archive')
                : 'Delete')
          ])
        ])
      ]) : null;
      
      return React.createElement('div', { 
        style: { 
          display: 'flex', 
          flexDirection: 'column', 
          flex: 1, 
          height: '100%' 
        } 
      }, [header, history, footer, confirmModal]);
    }
    
    // New Message Modal
    function NewMessageModal(props) {
      const { onClose, onCreate } = props || {};
      const API_BASE = getApiBase();
      const { currentUser: userId, users } = React.useContext(StateContext);
      
      const [recipients, setRecipients] = React.useState([]);
      const [internal, setInternal] = React.useState(false);
      const [external, setExternal] = React.useState(false);
      const [privileged, setPrivileged] = React.useState(false);
      const [text, setText] = React.useState('');
      const [adHocName, setAdHocName] = React.useState('');
      const [adHocEmail, setAdHocEmail] = React.useState('');
      
      function addRecipient(user) {
        if (recipients.find(r => r.userId === user.id || (r.email === user.email && r.email))) return;
        setRecipients([...recipients, { userId: user.id, label: user.label, email: user.email || '', internal: true }]);
      }
      
      function addAdHoc() {
        if (!adHocName.trim() || !adHocEmail.trim()) return;
        if (recipients.find(r => r.email === adHocEmail.trim())) return;
        setRecipients([...recipients, { userId: null, label: adHocName.trim(), email: adHocEmail.trim(), internal: false }]);
        setAdHocName('');
        setAdHocEmail('');
      }
      
      function removeRecipient(email) {
        setRecipients(recipients.filter(r => r.email !== email));
      }
      
      async function create() {
        if (recipients.length === 0) {
          return;
        }
        try {
          // Check for existing conversation with same participants
          const checkResponse = await fetch(`${API_BASE}/api/v1/messages?userId=${userId}`);
          if (checkResponse.ok) {
            const existingData = await checkResponse.json();
            
            // Get the recipient user IDs (not including current user)
            const newRecipientIds = recipients.map(p => p.userId).filter(Boolean).sort();
            
            // Check if any existing message has the exact same participants
            // Note: server stores createdBy separately from participants array
            const duplicateMessage = existingData.messages.find(msg => {
              const msgRecipientIds = msg.participants.map(p => p.userId).filter(Boolean).sort();
              
              // Check if this is the same set of recipients (excluding creator)
              // We need to check both cases: user is creator OR user is in participants
              const msgCreator = msg.createdBy.userId;
              
              // If current user created the message, compare with message's participants
              if (msgCreator === userId) {
                return msgRecipientIds.length === newRecipientIds.length &&
                       msgRecipientIds.every((id, idx) => id === newRecipientIds[idx]);
              }
              
              // If current user is a participant, we need to check if the creator + other participants match
              // Get all participants including creator, excluding current user
              const allMsgParticipantIds = [msgCreator, ...msg.participants.map(p => p.userId)]
                .filter(Boolean)
                .filter(id => id !== userId)
                .sort();
              
              return allMsgParticipantIds.length === newRecipientIds.length &&
                     allMsgParticipantIds.every((id, idx) => id === newRecipientIds[idx]);
            });
            
            if (duplicateMessage) {
              alert('You already have a conversation with these participants. Please use the existing conversation.');
              return;
            }
            
            // ADDITIONAL VALIDATION: Prevent multiple one-on-one conversations with same person
            if (recipients.length === 1) {
              const recipientUserId = recipients[0].userId;
              
              // Look for any existing one-on-one message with this specific recipient
              const existingOneOnOne = existingData.messages.find(msg => {
                // A one-on-one has exactly 1 person in participants array
                if (msg.participants.length !== 1) return false;
                
                const msgRecipient = msg.participants[0].userId;
                const msgCreator = msg.createdBy.userId;
                
                // Check both scenarios:
                // 1. Current user created message, recipient is in participants
                // 2. Recipient created message, current user is in participants
                return (msgCreator === userId && msgRecipient === recipientUserId) ||
                       (msgCreator === recipientUserId && msgRecipient === userId);
              });
              
              if (existingOneOnOne) {
                const recipientName = recipients[0].label;
                alert(`You already have a one-on-one conversation with ${recipientName}. Please use the existing conversation or add more participants to create a group chat.`);
                return;
              }
            }
          }
          
          // Include current user in participants for sending to server
          const currentUser = users.find(u => u.id === userId);
          const allParticipants = [
            { userId, label: currentUser?.label || 'Me', email: currentUser?.email || '', internal: true },
            ...recipients
          ];
          
          // Auto-generate title from participants (excluding current user)
          const title = recipients.map(r => r.label).join(', ');
          
          const response = await fetch(`${API_BASE}/api/v1/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, recipients: allParticipants, internal, external, privileged, text, userId })
          });
          
          if (!response.ok) {
            const error = await response.json();
            alert('Failed to create message: ' + (error.error || 'Unknown error'));
            return;
          }
          
          onCreate?.();
        } catch (e) {
          console.error('Failed to create message:', e);
          alert('Failed to create message: ' + e.message);
        }
      }
      
      return React.createElement('div', { 
        onClick: onClose,
        style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }
      }, React.createElement('div', { 
        onClick: e => e.stopPropagation(),
        style: { background: '#fff', borderRadius: 8, padding: 24, width: '90%', maxWidth: 500, maxHeight: '80vh', overflow: 'auto' }
      }, [
        React.createElement('h3', { key: 'title', style: { margin: '0 0 20px 0' } }, 'New Message'),
        
        React.createElement('div', { key: 'form', style: { display: 'flex', flexDirection: 'column', gap: 16 } }, [
          React.createElement('div', { key: 'recipients' }, [
            React.createElement('div', { key: 'list', style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, minHeight: recipients.length > 0 ? 'auto' : 0 } }, 
              recipients.map(r => React.createElement('div', { 
                key: r.email, 
                style: { 
                  padding: '8px 12px', 
                  background: '#e0f2fe', 
                  border: '1px solid #bae6fd',
                  borderRadius: 6, 
                  fontSize: 13, 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: 2,
                  position: 'relative',
                  paddingRight: 32
                }
              }, [
                React.createElement('div', { key: 'name', style: { fontWeight: 600, color: '#0c4a6e' } }, r.label),
                React.createElement('div', { key: 'email', style: { fontSize: 11, color: '#0369a1' } }, r.email),
                React.createElement('button', { 
                  key: 'remove', 
                  onClick: () => removeRecipient(r.email),
                  title: 'Remove',
                  style: { 
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer', 
                    padding: '2px 6px', 
                    fontSize: 16, 
                    color: '#0369a1',
                    lineHeight: 1
                  }
                }, '×')
              ]))
            ),
            React.createElement('div', { key: 'add', style: { display: 'flex', gap: 8, marginBottom: 8 } }, [
              React.createElement('select', { 
                key: 'select',
                className: 'standard-select',
                onChange: e => { if (e.target.value) { const user = users.find(u => u.id === e.target.value); if (user) addRecipient(user); e.target.value = ''; } },
                style: { flex: 1 }
              }, [
                React.createElement('option', { key: 'default', value: '' }, 'Add from directory…'),
                ...users.filter(u => u.id !== userId && !recipients.some(r => r.userId === u.id)).map(u => React.createElement('option', { key: u.id, value: u.id }, u.label))
              ])
            ]),
            React.createElement('div', { key: 'adhoc', style: { display: 'flex', gap: 8 } }, [
              React.createElement('input', { 
                key: 'name', 
                placeholder: 'Name', 
                value: adHocName, 
                onChange: e => setAdHocName(e.target.value),
                style: { flex: 1, padding: 8, fontSize: 13, borderRadius: 4, border: '1px solid #e5e7eb' }
              }),
              React.createElement('input', { 
                key: 'email', 
                placeholder: 'Email', 
                value: adHocEmail, 
                onChange: e => setAdHocEmail(e.target.value),
                style: { flex: 1, padding: 8, fontSize: 13, borderRadius: 4, border: '1px solid #e5e7eb' }
              }),
              React.createElement('button', { 
                key: 'add', 
                onClick: addAdHoc,
                disabled: !adHocName.trim() || !adHocEmail.trim(),
                style: { padding: '0 12px', fontSize: 13, background: adHocName.trim() && adHocEmail.trim() ? '#6d5ef1' : '#e5e7eb', color: adHocName.trim() && adHocEmail.trim() ? '#fff' : '#9ca3af', border: 'none', borderRadius: 4, cursor: adHocName.trim() && adHocEmail.trim() ? 'pointer' : 'not-allowed' }
              }, 'Add')
            ])
          ]),
          
          React.createElement('div', { key: 'flags', style: { display: 'flex', gap: 16, flexWrap: 'wrap' } }, [
            React.createElement('label', { key: 'internal', style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 } }, [
              React.createElement('input', { key: 'check', type: 'checkbox', checked: internal, onChange: e => setInternal(e.target.checked) }),
              React.createElement('span', { key: 'label' }, 'Internal only')
            ]),
            React.createElement('label', { key: 'external', style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 } }, [
              React.createElement('input', { key: 'check', type: 'checkbox', checked: external, onChange: e => setExternal(e.target.checked) }),
              React.createElement('span', { key: 'label' }, 'External')
            ]),
            React.createElement('label', { key: 'privileged', style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 } }, [
              React.createElement('input', { key: 'check', type: 'checkbox', checked: privileged, onChange: e => setPrivileged(e.target.checked) }),
              React.createElement('span', { key: 'label' }, 'Attorney-Client Privilege')
            ])
          ]),
          
          React.createElement('textarea', { 
            key: 'text',
            placeholder: 'First message (optional)', 
            value: text, 
            onChange: e => setText(e.target.value),
            rows: 3,
            style: { padding: 8, fontSize: 13, borderRadius: 4, border: '1px solid #e5e7eb', resize: 'vertical' }
          })
        ]),
        
        React.createElement('div', { key: 'actions', style: { display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' } }, [
          React.createElement('button', { 
            key: 'cancel', 
            onClick: onClose,
            style: { padding: '8px 16px', fontSize: 13, background: '#f3f4f6', border: 'none', borderRadius: 4, cursor: 'pointer' }
          }, 'Cancel'),
          React.createElement('button', { 
            key: 'create', 
            onClick: create,
            disabled: recipients.length === 0,
            style: { padding: '8px 16px', fontSize: 13, background: recipients.length > 0 ? '#6d5ef1' : '#e5e7eb', color: recipients.length > 0 ? '#fff' : '#9ca3af', border: 'none', borderRadius: 4, cursor: recipients.length > 0 ? 'pointer' : 'not-allowed' }
          }, 'Start Conversation')
        ])
      ]));
    }

    // Comparison Tab
    function ComparisonTab() {
      const API_BASE = getApiBase();
      const { revision } = React.useContext(StateContext);
      const [versions, setVersions] = React.useState([]);
      const [versionA, setVersionA] = React.useState('1');
      const [versionB, setVersionB] = React.useState('');
      const [list, setList] = React.useState([]);
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState('');
      const [hasCompared, setHasCompared] = React.useState(false);
      const lastLoadedRevision = React.useRef(0);
      
      // Fetch versions list
      const loadVersions = React.useCallback(async () => {
        try {
          const url = `${API_BASE}/api/v1/versions?rev=${Date.now()}`;
          console.log(`📡 [ComparisonTab] Fetching versions from: ${url} (revision: ${revision})`);
          const r = await fetch(url, { cache: 'no-store' });
          if (r.ok) {
            const j = await r.json();
            const arr = Array.isArray(j.items) ? j.items : [];
            console.log(`✅ [ComparisonTab] Received ${arr.length} versions from server`);
            setVersions(arr);
            lastLoadedRevision.current = revision;
            // Default to version 1 and latest (only on initial load when nothing is selected)
            if (arr.length > 0 && !versionB) {
              setVersionA('1');
              setVersionB(String(arr.length));
            }
          } else {
            console.error(`❌ [ComparisonTab] Failed to fetch versions: ${r.status}`);
          }
        } catch (e) {
          console.error(`❌ [ComparisonTab] Error fetching versions:`, e);
        }
      }, [API_BASE, revision, versionB]);
      
      // Load versions on mount and when revision changes
      React.useEffect(() => {
        console.log(`🔄 [ComparisonTab] useEffect triggered - revision: ${revision}, lastLoaded: ${lastLoadedRevision.current}`);
        if (revision !== lastLoadedRevision.current) {
        loadVersions();
        }
      }, [revision, loadVersions]);
      
      // Listen for versions:update event to refresh list (still useful for non-revision-changing updates)
      React.useEffect(() => {
        const onVersionsUpdate = () => {
          console.log(`🔄 [ComparisonTab] Received versions:update event - reloading versions`);
          loadVersions();
        };
        window.addEventListener('versions:update', onVersionsUpdate);
        return () => window.removeEventListener('versions:update', onVersionsUpdate);
      }, [loadVersions]);

      const compare = async () => {
        setBusy(true); setError('');
        try {
          console.log('[UI] compare →', { versionA: Number(versionA), versionB: Number(versionB) });
          const r = await fetch(`${API_BASE}/api/v1/versions/compare?debug=true`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ versionA: Number(versionA), versionB: Number(versionB) }) });
          if (!r.ok) throw new Error('compare');
          const j = await r.json();
          const diffs = Array.isArray(j.differences) ? j.differences.filter(Boolean) : [];
          if (j && j.debug) console.log('[UI] compare debug ←', j.debug);
          console.log('[UI] compare ←', { count: diffs.length, sample: diffs.slice(0, 3) });
          setList(diffs);
          try {
            const msg = (j && j.message) ? String(j.message) : '';
            if (msg) console.log('[UI] compare info:', msg);
          } catch {}
          setHasCompared(true);
        } catch (e) { console.error('[UI] compare error:', e); setError('Comparison failed'); }
        finally { setBusy(false); }
      };

      const jump = async (diff) => {
        try {
          const body = {
            text: String(diff.text || ''),
            changeType: (diff.type === 1 ? 'addition' : (diff.type === -1 ? 'deletion' : 'change')),
            position: (typeof diff.position === 'number' ? diff.position : undefined),
            contextBefore: String(diff.contextBefore || ''),
            contextAfter: String(diff.contextAfter || ''),
            targetVersion: (typeof diff.targetVersion === 'number' ? diff.targetVersion : undefined)
          };
          console.log('[UI] jump →', body);
          const r = await fetch(`${API_BASE}/api/v1/document/navigate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          const ok = r && r.ok; let j = null; try { j = await r.json(); } catch {}
          console.log('[UI] jump ←', { ok, response: j });
        } catch (e) { console.error('[UI] jump error:', e); }
      };

      const picker = (label, val, setVal) => React.createElement('div', { className: 'd-flex flex-column gap-4', style: { flex: 1 } }, [
        React.createElement('label', { key: 'l', style: { fontSize: '13px', fontWeight: 600, color: '#374151' } }, label),
        React.createElement('select', { 
          key: 's',
          className: 'standard-select',
          value: val, 
          onChange: (e) => setVal(e.target.value)
        }, versions.slice().reverse().map((v, i) => {
          const versionNum = versions.length - i;
          return React.createElement('option', { key: i, value: String(versionNum) }, `Version ${versionNum}${v.label ? ` - ${v.label}` : ''}`);
        }))
      ]);

      const header = React.createElement('div', { className: 'd-flex flex-column gap-12', style: { padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' } }, [
        React.createElement('div', { key: 'pickers', className: 'd-flex gap-12' }, [
        picker('Version A', versionA, setVersionA),
          picker('Version B', versionB, setVersionB)
        ]),
        React.createElement('div', { key: 'btn-row', className: 'd-flex' }, [
        React.createElement(UIButton, { key: 'go', label: (busy ? 'Comparing…' : 'Compare'), onClick: compare, disabled: !!busy, variant: 'primary' })
        ])
      ]);

      const isAddin = typeof Office !== 'undefined';
      
      const items = (list || []).map((d, i) => {
        const typeLabel = d.type === 1 ? 'Added' : (d.type === -1 ? 'Removed' : 'Changed');
        const typeColor = d.type === 1 ? '#10b981' : (d.type === -1 ? '#ef4444' : '#f59e0b');
        
        return React.createElement('div', { 
          key: d.id || i, 
          className: 'difference-card', 
          style: { 
            border: '1px solid #e5e7eb', 
            borderRadius: '8px', 
            padding: '12px', 
            backgroundColor: '#ffffff',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
          } 
        }, [
          React.createElement('div', { key: 'h', className: 'd-flex items-center justify-between', style: { marginBottom: '8px' } }, [
            React.createElement('span', { 
              key: 't', 
              style: { 
                fontSize: '13px', 
                fontWeight: 600, 
                color: typeColor,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              } 
            }, typeLabel)
          ]),
          React.createElement('div', { 
            key: 'x', 
            style: { 
              fontSize: '14px', 
              color: '#4b5563', 
              lineHeight: '1.5',
              marginBottom: '12px' // Always show margin for button
            } 
          }, String(d.text || '')),
          React.createElement('div', { key: 'f', className: 'd-flex justify-end' }, 
            React.createElement(UIButton, { label: 'Jump to location', onClick: () => jump(d), variant: 'secondary' })
          )
        ].filter(Boolean));
      });

      const identicalBanner = (hasCompared && (!list || list.length === 0))
        ? React.createElement('div', { 
            style: { 
              padding: '12px 16px', 
              backgroundColor: '#f0fdf4', 
              color: '#166534', 
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500
            } 
          }, '✓ These versions are identical')
        : null;
      const hasItems = Array.isArray(list) && list.length > 0;

      const errorBanner = error ? React.createElement('div', { 
        style: { 
          padding: '12px 16px', 
          backgroundColor: '#fef2f2', 
          color: '#991b1b', 
          border: '1px solid #fecaca',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 500
        } 
      }, '⚠ ' + error) : null;

      return React.createElement('div', { className: 'd-flex flex-column gap-12' }, [
        header,
        errorBanner,
        identicalBanner,
        (hasItems ? React.createElement('div', { className: 'd-flex flex-column gap-8' }, items) : null)
      ]);
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
      const DEFAULT_AI_GREETING = 'Shall we...contract?';
      
      // Load messages from server
      const [messages, setMessages] = React.useState(['[bot] ' + DEFAULT_AI_GREETING]);
      
      // Fetch messages on mount and when user changes
      React.useEffect(() => {
        const loadMessages = async () => {
          try {
            const r = await fetch(`${API_BASE}/api/v1/chat?userId=${encodeURIComponent(currentUser)}`);
            if (r.ok) {
              const j = await r.json();
              if (Array.isArray(j.messages) && j.messages.length > 0) {
                setMessages(j.messages);
              } else {
                setMessages(['[bot] ' + DEFAULT_AI_GREETING]);
              }
            }
          } catch {
            setMessages(['[bot] ' + DEFAULT_AI_GREETING]);
          }
        };
        loadMessages();
      }, [API_BASE, currentUser, DEFAULT_AI_GREETING]);
      
      const [text, setText] = React.useState('');
      const listRef = React.useRef(null);
      // Helper function to detect current platform
      const getCurrentPlatform = () => {
        try { return (typeof Office !== 'undefined') ? 'word' : 'web'; } catch { return 'web'; }
      };
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
        setMessages((m) => { const next = (m || []).concat(`[${currentUser}] ${t}`); return next; });
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
            const messagePlatform = d && d.payload && d.payload.messagePlatform;
            // Ignore messages from other platforms (isolate threads)
            try { if (typeof Office !== 'undefined') { if (messagePlatform && messagePlatform !== 'word') return; } else { if (messagePlatform && messagePlatform !== 'web') return; } } catch {}
            // Ignore echo of our own message (server broadcasts user messages too)
            if (!text || String(from) === String(currentUser)) return;
            setMessages((m) => { const next = (m || []).concat(`[${from}] ${text}`); return next; });
          } catch {}
        }
        function onChatReset(ev) {
          try {
            const d = ev.detail;
            const isGlobal = !!(d && d.payload && d.payload.all);
            const forUser = String(d && d.userId || 'default');
            const messagePlatform = d && d.payload && d.payload.messagePlatform;
            const currentPlatform = typeof Office !== 'undefined' ? 'word' : 'web';
            
            console.log(`🔄 [ChatConsole] onChatReset - isGlobal: ${isGlobal}, currentUser: ${currentUser}, platform: ${currentPlatform}`);

            if (isGlobal) {
              // Factory reset: reload from server (should be empty after server reset)
              setMessages(['[bot] ' + DEFAULT_AI_GREETING]);
              setText('');
              // Reload from server
              (async () => {
                try {
                  const url = `${API_BASE}/api/v1/chat?userId=${encodeURIComponent(currentUser)}`;
                  console.log(`📡 [ChatConsole] Fetching chat from: ${url}`);
                  const r = await fetch(url, { cache: 'no-store' });
                  if (r.ok) {
                    const j = await r.json();
                    console.log(`✅ [ChatConsole] Received ${j.messages?.length || 0} messages from server`);
                    if (Array.isArray(j.messages) && j.messages.length > 0) {
                      setMessages(j.messages);
                    } else {
                      setMessages(['[bot] ' + DEFAULT_AI_GREETING]);
                    }
                  } else {
                    console.error(`❌ [ChatConsole] Failed to fetch chat: ${r.status}`);
                  }
                } catch (e) {
                  console.error(`❌ [ChatConsole] Error fetching chat:`, e);
                }
              })();
              return;
            }

            // Ignore resets from other platforms
            try {
              if (typeof Office !== 'undefined') {
                if (messagePlatform && messagePlatform !== 'word') {
                  return;
                }
              } else {
                if (messagePlatform && messagePlatform !== 'web') {
                  return;
                }
              }
            } catch {}

            if (String(forUser) !== String(currentUser)) {
              return;
            }

            // User-initiated reset via reset button
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
            const messagePlatform = d && d.payload && d.payload.messagePlatform;
            try { if (typeof Office !== 'undefined') { if (messagePlatform && messagePlatform !== 'word') return; } else { if (messagePlatform && messagePlatform !== 'web') return; } } catch {}

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
            const messagePlatform = d && d.payload && d.payload.messagePlatform;
            try { if (typeof Office !== 'undefined') { if (messagePlatform && messagePlatform !== 'word') return; } else { if (messagePlatform && messagePlatform !== 'web') return; } } catch {}

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
      }, [currentUser, displayNameOf, API_BASE, DEFAULT_AI_GREETING]);
      const FOOTER_HEIGHT = 140; // reserve space so content never hides behind composer/footer
      const scrollToBottom = React.useCallback(() => {
        try { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; } catch {}
      }, []);
      React.useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
      const box = React.createElement('div', { className: 'chat-container' }, messages.map((m, i) => {
        const who = (typeof m === 'string' && /^\[/.test(m)) ? (m.match(/^\[([^\]]+)\]/)?.[1] || '') : '';
        // Treat [user] prefix as "mine" for the current user, or match exact user ID
        const isMine = who && (who === 'user' || who === currentUser);
        const ts = new Date().toLocaleTimeString();
        const text = typeof m === 'string' ? m.replace(/^\[[^\]]+\]\s*/, '') : String(m);
        const rowCls = 'chat-bubble-row ' + (isMine ? 'mine' : 'other');
        const bubbleCls = 'chat-bubble ' + (isMine ? 'mine' : 'other');
        return React.createElement('div', { key: i, className: rowCls }, [
          React.createElement('div', { key: 'ts', className: 'chat-timestamp ' + (isMine ? 'mine' : 'other') }, ts),
          React.createElement('div', { key: 'b', className: bubbleCls, style: { wordBreak: 'break-word', overflowWrap: 'anywhere' } }, text)
        ]);
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
          
          const plat = (function(){ try { return (typeof Office !== 'undefined') ? 'word' : 'web'; } catch { return 'web'; } })();
          
          const r = await fetch(`${API_BASE}/api/v1/chatbot/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUser, platform: plat }) });
          // Ask server and other clients to stop any in-flight streaming
          try { await fetch(`${API_BASE}/api/v1/events/client`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'chat:stop', userId: currentUser, platform: plat }) }); } catch {}
          // Optimistically clear locally; SSE chat:reset will also arrive
          try { setMessages(['[bot] ' + DEFAULT_AI_GREETING]); } catch {}
          try { setText(''); } catch {}
          
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
      const editPromptBtn = React.createElement(UIButton, { 
        label: 'Edit Prompt', 
        onClick: () => window.dispatchEvent(new CustomEvent('react:open-modal', { 
          detail: { id: 'system-prompt-editor' } 
        })), 
        tone: 'secondary' 
      });
      const isAddin = typeof Office !== 'undefined';
      const footerBar = React.createElement('div', { className: 'd-flex flex-column gap-8', style: { width: '100%', boxSizing: 'border-box', paddingTop: 8, paddingBottom: isAddin ? 8 : 12, paddingLeft: isAddin ? 0 : 12, paddingRight: isAddin ? 0 : 12 } }, [
        React.createElement('div', { className: 'd-flex gap-8 align-items-end', style: { width: '100%', boxSizing: 'border-box' } }, [
          React.createElement('div', { style: { flex: 1 } }, input)
        ]),
        React.createElement('div', { className: 'd-flex gap-8' }, [resetBtn, refreshBtn, editPromptBtn])
      ]);
      const wrap = React.createElement('div', { style: { width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } }, [
        React.createElement('div', { ref: listRef, style: { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: isAddin ? '8px' : '12px' } }, [box]),
        React.createElement('div', { style: { flexShrink: 0, background: '#fff', borderTop: '1px solid #e5e7eb' } }, [footerBar])
      ]);
      return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, height: '100%' } }, [wrap]);
    }

    function LastUpdatedPrefix() {
      const { config, users } = React.useContext(StateContext);
      let dateStr = '';
      let timeStr = '';
      let firstName = '';
      try {
        // Check both lastSaved.timestamp and lastUpdated
        const ts = (config && config.lastSaved && config.lastSaved.timestamp) || (config && config.lastUpdated);
        if (ts) {
          const d = new Date(ts);
          // Format: "March 1, 2025"
          dateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          // Format: "1:30pm"
          timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(/\s/g, '');
        }
        
        // Check both lastSaved.user and updatedBy
        const user = (config && config.lastSaved && config.lastSaved.user) || (config && config.updatedBy);
        let label = '';
        if (user) {
          if (typeof user === 'object') {
            label = user.label || user.name || user.id || '';
          } else {
            // User is a string (like "user1"), look it up in users list
            const userId = String(user);
            const match = Array.isArray(users) ? users.find(u => u && u.id === userId) : null;
            label = (match && match.label) || userId;
          }
        }
        label = String(label || '').trim();
        // Only show user name if it is a real human label (not 'system' or 'Unknown User')
        if (label && !/^system$/i.test(label) && !/^unknown\s+user$/i.test(label)) {
          const parts = label.split(/\s+/);
          firstName = parts && parts.length ? parts[0] : '';
        }
      } catch {}
      
      if (!dateStr || !timeStr) return React.createElement('span', null, 'Last updated —');
      const byName = firstName || 'OpenGov';
      return React.createElement('span', null, `Last updated by ${byName} on ${dateStr}, at ${timeStr} PST`);
    }

    function InlineTitleEditor() {
      const { config, addLog, currentUser } = React.useContext(StateContext);
      const API_BASE = getApiBase();
      const [title, setTitle] = React.useState(config?.title || 'Untitled Document');
      React.useEffect(() => {
        console.log('🔄 [InlineTitleEditor] useEffect triggered - New title from config:', config?.title);
        setTitle(config?.title || 'Untitled Document');
      }, [config?.title]);
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
        placeholder: 'Wut Contract?',
        className: 'font-semibold w-full document-title document-title-textarea',
        rows: 1
      });
    }

    function StatusBadge() {
      const { config, addLog } = React.useContext(StateContext);
      const API_BASE = getApiBase();
      const [status, setStatus] = React.useState((config?.status || 'draft').toLowerCase());
      React.useEffect(() => {
        console.log('🔄 [StatusBadge] useEffect triggered - New status from config:', config?.status);
        setStatus((config?.status || 'draft').toLowerCase());
      }, [config?.status]);
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
          console.log('🔄 [VersionsPanel] refresh called');
          const url = `${API_BASE}/api/v1/versions?rev=${Date.now()}`;
          const r = await fetch(url, { cache: 'no-store' });
          if (r.ok) {
            const j = await r.json();
            const arr = Array.isArray(j.items) ? j.items : [];
            console.log(`📥 [VersionsPanel] Fetched ${arr.length} versions`);
            setItems(arr);
          }
        } catch {}
      }, [API_BASE]);
      React.useEffect(() => { refresh(); }, [refresh]);
      React.useEffect(() => {
        const onVersionsUpdate = () => { 
          console.log('🔄 [VersionsPanel] versions:update event received');
          try { setTimeout(() => refresh(), 100); } catch {} 
        };
        const onFactory = () => { 
          console.log('🔄 [VersionsPanel] factoryReset event received');
          try { 
            setViewingVersion(1); 
            setTimeout(() => refresh(), 100); 
          } catch {} 
        };
        const onVersionView = async (ev) => {
          try {
            const d = ev && ev.detail;
            const n = Number(d && d.version);
            if (!Number.isFinite(n) || n < 1) return;
            const messagePlatform = d && d.payload && d.payload.messagePlatform;
            
            // Keep platforms separate: ignore view events from the other platform
            try { if (typeof Office !== 'undefined') { if (messagePlatform && messagePlatform !== 'word') return; } else { if (messagePlatform && messagePlatform !== 'web') return; } } catch {}
            // Ensure the list reflects the newest versions
            try { await refresh(); } catch {}
            
            console.log(`[DEBUG] Setting viewingVersion to ${n} - Source: ComparisonTab version:view event`);
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
            const plat = (function(){ try { return (typeof Office !== 'undefined') ? 'word' : 'web'; } catch { return 'web'; } })();
            await fetch(`${API_BASE}/api/v1/versions/view`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: n, platform: plat }) });
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
      const inner = list.length
        ? React.createElement('div', { className: 'd-flex flex-column gap-8' }, list)
        : React.createElement('div', { className: 'text-gray-500', style: { padding: 8 } }, 'No versions yet.');
      // Ensure enough bottom padding so the last card isn't hidden beneath the container edge
      const containerStyle = { paddingTop: 3, paddingBottom: 16 };
      return React.createElement('div', { className: 'd-flex flex-column gap-8', style: containerStyle }, [
        inner,
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
      const select = React.createElement('select', { className: 'standard-select', value: selected || '', onChange }, (users || []).map((u, i) => {
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
              if (v > 0) {
                setLoadedVersion(v);
                try { setViewingVersion(v); } catch {}
                try { window.dispatchEvent(new CustomEvent('version:view', { detail: { version: v, payload: { messagePlatform: plat } } })); } catch {}
              }
            } catch {}
          } catch {}
        }
      };
      const btn = (label, onClick, variant) => React.createElement(UIButton, { label, onClick, variant: variant || 'primary', className: 'w-full' });
      return React.createElement('div', { className: 'd-grid grid-cols-2 column-gap-8 row-gap-6 grid-auto-rows-minmax-27' }, [btn('Open New Document', openNew), btn('View Latest', viewLatest)]);
    }

    // Link Code Banner (for syncing Word and Browser)
    function LinkCodeBanner() {
      const [linkCode, setLinkCode] = React.useState(null);
      const [showBanner, setShowBanner] = React.useState(false);
      const [dismissed, setDismissed] = React.useState(false);
      const [showInput, setShowInput] = React.useState(false);
      const [inputValue, setInputValue] = React.useState('');
      const [error, setError] = React.useState(null);
      const [loading, setLoading] = React.useState(false);
      const isWordHost = typeof Office !== 'undefined';
      
      // Check for link code on mount
      React.useEffect(() => {
        const code = localStorage.getItem('wordftw_link_code');
        console.log('[LinkCodeBanner] Link code from localStorage:', code);
        if (code) {
          setLinkCode(code);
        }
        
        // Check if banner was dismissed
        const wasDismissed = localStorage.getItem('wordftw_link_banner_dismissed') === 'true';
        console.log('[LinkCodeBanner] Banner dismissed?', wasDismissed);
        setDismissed(wasDismissed);
      }, []);
      
      // Listen for trigger event (from download button)
      React.useEffect(() => {
        const handleShow = async () => {
          console.log('[LinkCodeBanner] Show event triggered!');
          
          // Check if we have a link code, if not, get one
          let code = localStorage.getItem('wordftw_link_code');
          if (!code && !isWordHost) {
            console.log('[LinkCodeBanner] No link code found - refreshing session...');
            try {
              const fingerprint = localStorage.getItem('wordftw_fingerprint');
              const API_BASE = getApiBase();
              
              // Clear old token and request new one
              localStorage.removeItem('wordftw_auth_token');
              
              const fetchFn = window._originalFetch || fetch;
              const response = await fetchFn(`${API_BASE}/api/v1/session/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fingerprint })
              });
              
              if (response.ok) {
                const data = await response.json();
                localStorage.setItem('wordftw_auth_token', data.token);
                
                if (data.linkCode) {
                  localStorage.setItem('wordftw_link_code', data.linkCode);
                  setLinkCode(data.linkCode);
                  code = data.linkCode;
                  console.log('[LinkCodeBanner] ✅ Link code obtained after refresh:', data.linkCode);
                }
              }
            } catch (err) {
              console.error('[LinkCodeBanner] Failed to refresh session:', err);
            }
          }
          
          if (code) {
            setShowBanner(true);
            setDismissed(false);
            localStorage.removeItem('wordftw_link_banner_dismissed');
          }
        };
        
        window.addEventListener('show-link-code', handleShow);
        return () => window.removeEventListener('show-link-code', handleShow);
      }, [isWordHost]);
      
      // Handle dismissing the banner
      const handleDismiss = () => {
        setDismissed(true);
        setShowBanner(false);
        localStorage.setItem('wordftw_link_banner_dismissed', 'true');
      };
      
      // Handle link code submission (Word add-in only)
      const handleSubmitCode = async () => {
        if (!inputValue || inputValue.length !== 6) {
          setError('Please enter a 6-character code');
          return;
        }
        
        setLoading(true);
        setError(null);
        
        try {
          await window.wordFTW_submitLinkCode(inputValue.toUpperCase());
          // Page will reload after successful link
        } catch (err) {
          setError(err.message || 'Failed to link. Check the code and try again.');
          setLoading(false);
        }
      };
      
      // Browser: Show link code (only if triggered and not dismissed)
      console.log('[LinkCodeBanner] Render check:', { isWordHost, linkCode, showBanner, dismissed });
      if (!isWordHost && linkCode && showBanner && !dismissed) {
        console.log('[LinkCodeBanner] ✅ Rendering banner');
        return React.createElement('div', {
          className: 'my-2 p-3 border border-blue-200 bg-blue-50 rounded-md',
          style: { display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }
        }, [
          React.createElement('div', { key: 'text', style: { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 } }, [
            React.createElement('div', { key: 'title', style: { fontWeight: 600, color: '#1e40af', fontSize: '15px' } }, '🔗 Link Code for Word Add-in'),
            React.createElement('div', { key: 'desc', style: { fontSize: '13px', color: '#3b82f6', marginTop: '4px' } }, 'Open Word add-in and enter this code to sync:'),
            React.createElement('div', { key: 'code', style: { fontSize: '22px', fontWeight: 700, color: '#1e40af', letterSpacing: '4px', fontFamily: 'monospace', marginTop: '8px' } }, linkCode)
          ]),
          React.createElement('div', { key: 'actions', style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, [
            React.createElement('button', {
              key: 'copy',
              onClick: () => {
                navigator.clipboard.writeText(linkCode);
                const btn = document.querySelector('[data-copy-btn]');
                if (btn) {
                  const oldText = btn.textContent;
                  btn.textContent = '✓ Copied!';
                  setTimeout(() => { btn.textContent = oldText; }, 2000);
                }
              },
              'data-copy-btn': true,
              style: { padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap' }
            }, '📋 Copy'),
            React.createElement('button', {
              key: 'close',
              onClick: handleDismiss,
              style: { padding: '8px 16px', background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }
            }, 'Close')
          ])
        ]);
      }
      
      // Word add-in: Show input field
      if (isWordHost && !linkCode) {
        if (!showInput) {
          return React.createElement('div', {
            className: 'my-2 p-3 border border-purple-200 bg-purple-50 rounded-md',
            style: { display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }
          }, [
            React.createElement('div', { key: 'text', style: { fontSize: '14px', color: '#6d5ef1', fontWeight: 500 } }, '🔗 Link to browser session?'),
            React.createElement('div', { key: 'buttons', style: { display: 'flex', gap: '8px' } }, [
              React.createElement('button', {
                key: 'link',
                onClick: () => setShowInput(true),
                style: { padding: '6px 12px', background: '#6d5ef1', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }
              }, 'Enter Code'),
              React.createElement('button', {
                key: 'close',
                onClick: () => {
                  setDismissed(true);
                  // Persist dismissed state so it doesn't reappear
                  if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('linkBannerDismissed', 'true');
                  }
                },
                style: { padding: '6px 12px', background: 'transparent', color: '#6d5ef1', border: '1px solid #c4b5fd', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }
              }, '×')
            ])
          ]);
        }
        
        return React.createElement('div', {
          className: 'my-2 p-3 border border-purple-200 bg-purple-50 rounded-md',
          style: { display: 'flex', flexDirection: 'column', gap: '12px' }
        }, [
          React.createElement('div', { key: 'title', style: { fontWeight: 600, color: '#6d5ef1' } }, '🔗 Enter Link Code from Browser'),
          React.createElement('div', { key: 'input-row', style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [
            React.createElement('input', {
              key: 'input',
              type: 'text',
              maxLength: 6,
              placeholder: 'ABC123',
              value: inputValue,
              onChange: (e) => setInputValue(e.target.value.toUpperCase()),
              disabled: loading,
              style: { flex: 1, padding: '8px 12px', border: '2px solid #c4b5fd', borderRadius: '6px', fontSize: '16px', fontWeight: 600, letterSpacing: '2px', fontFamily: 'monospace', textTransform: 'uppercase' }
            }),
            React.createElement('button', {
              key: 'submit',
              onClick: handleSubmitCode,
              disabled: loading || inputValue.length !== 6,
              style: { padding: '8px 20px', background: loading || inputValue.length !== 6 ? '#ccc' : '#6d5ef1', color: 'white', border: 'none', borderRadius: '6px', cursor: loading || inputValue.length !== 6 ? 'not-allowed' : 'pointer', fontWeight: 600 }
            }, loading ? 'Linking...' : 'Link'),
            React.createElement('button', {
              key: 'cancel',
              onClick: () => { setShowInput(false); setInputValue(''); setError(null); },
              disabled: loading,
              style: { padding: '8px 16px', background: 'transparent', color: '#6d5ef1', border: '1px solid #c4b5fd', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }
            }, '×')
          ]),
          error ? React.createElement('div', { key: 'error', style: { fontSize: '13px', color: '#dc2626', fontWeight: 500 } }, error) : null
        ]);
      }
      
      return null;
    }
    
    // Install Add-in Modal (for browser only)
    function InstallAddInModal({ onClose }) {
      const [isDownloading, setIsDownloading] = React.useState(false);
      const [isGenerating, setIsGenerating] = React.useState(false);
      
      const handleInstallAndLink = async () => {
        setIsDownloading(true);
        
        // Detect OS and download appropriate installer
        const userAgent = navigator.userAgent.toLowerCase();
        const isMac = /mac|darwin/.test(userAgent);
        const isWindows = /win/.test(userAgent);
        
        let downloadUrl = '/manifest.xml';
        let filename = 'manifest.xml';
        
        if (isMac) {
          downloadUrl = '/install-addin.command';
          filename = 'install-addin.command';
        } else if (isWindows) {
          downloadUrl = '/install-addin.bat';
          filename = 'install-addin.bat';
        }
        
        // Trigger download
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        a.click();
        
        // Small delay, then show link code
        setTimeout(() => {
          setIsDownloading(false);
          window.dispatchEvent(new CustomEvent('show-link-code'));
          onClose();
        }, 500);
      };
      
      const handleGenerateCodeOnly = () => {
        setIsGenerating(true);
        // Just show link code without downloading
        window.dispatchEvent(new CustomEvent('show-link-code'));
        onClose();
      };
      
      return React.createElement('div', {
        style: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        },
        onClick: onClose
      }, 
        React.createElement('div', {
          style: {
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '480px',
            width: '90%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          },
          onClick: (e) => e.stopPropagation()
        }, [
          React.createElement('div', { key: 'header', style: { marginBottom: '20px' } }, [
            React.createElement('h2', { key: 'title', style: { margin: 0, fontSize: '20px', fontWeight: 600, color: '#111827' } }, '📥 Install Word Add-in'),
            React.createElement('p', { key: 'desc', style: { margin: '8px 0 0 0', fontSize: '14px', color: '#6b7280' } }, 'Choose how you want to set up the Word add-in:')
          ]),
          React.createElement('div', { key: 'options', style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, [
            React.createElement('button', {
              key: 'install',
              onClick: handleInstallAndLink,
              disabled: isDownloading,
              style: {
                padding: '16px',
                background: isDownloading ? '#9ca3af' : '#4B3FFF',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isDownloading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '15px',
                textAlign: 'left',
                transition: 'all 0.2s'
              }
            }, [
              React.createElement('div', { key: 'title', style: { marginBottom: '4px' } }, isDownloading ? '⏳ Downloading...' : '✅ Install & Generate Link Code'),
              React.createElement('div', { key: 'desc', style: { fontSize: '13px', opacity: 0.9, fontWeight: 400 } }, 'Download the installer and generate a code to link Word with this browser session.')
            ]),
            React.createElement('button', {
              key: 'generate',
              onClick: handleGenerateCodeOnly,
              disabled: isGenerating,
              style: {
                padding: '16px',
                background: 'white',
                color: '#4B3FFF',
                border: '2px solid #4B3FFF',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '15px',
                textAlign: 'left',
                transition: 'all 0.2s'
              }
            }, [
              React.createElement('div', { key: 'title', style: { marginBottom: '4px' } }, '🔗 Generate Link Code Only'),
              React.createElement('div', { key: 'desc', style: { fontSize: '13px', fontWeight: 400 } }, 'Already installed? Just generate a code to link Word with this browser.')
            ])
          ]),
          React.createElement('button', {
            key: 'cancel',
            onClick: onClose,
            style: {
              marginTop: '16px',
              width: '100%',
              padding: '10px',
              background: 'transparent',
              color: '#6b7280',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px'
            }
          }, 'Cancel')
        ])
      );
    }
    
    // Install Add-in Modal Manager (listens for show-install-modal event)
    function InstallAddInModalManager() {
      const [showModal, setShowModal] = React.useState(false);
      const isWordHost = typeof Office !== 'undefined' && Office.context && Office.context.host;
      
      // Don't show modal in Word add-in
      if (isWordHost) return null;
      
      // Listen for show-install-modal event
      React.useEffect(() => {
        const handleShowModal = () => setShowModal(true);
        window.addEventListener('show-install-modal', handleShowModal);
        return () => window.removeEventListener('show-install-modal', handleShowModal);
      }, []);
      
      return showModal ? React.createElement(InstallAddInModal, { onClose: () => setShowModal(false) }) : null;
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

    function FactoryResetModal(props) {
      const { onClose } = props || {};
      const API_BASE = getApiBase();
      const { currentUser } = React.useContext(StateContext);
      const [view, setView] = React.useState('main'); // 'main', 'save', 'confirm-delete', 'confirm-load'
      const [selectedScenario, setSelectedScenario] = React.useState(null);
      const [scenarios, setScenarios] = React.useState({ presets: [], scenarios: [] });
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState('');
      const [saveName, setSaveName] = React.useState('');
      const [saveDescription, setSaveDescription] = React.useState('');
      const [scenarioToDelete, setScenarioToDelete] = React.useState(null);

      // Load scenarios on mount
      React.useEffect(() => {
        loadScenarios();
      }, []);

      const loadScenarios = async () => {
        try {
          const r = await fetch(`${API_BASE}/api/v1/scenarios`);
          if (r.ok) {
            const data = await r.json();
            setScenarios(data);
          }
        } catch (e) {
          console.error('Failed to load scenarios:', e);
        }
      };

      const loadScenario = async (id, isPreset) => {
        setBusy(true); setError('');
        try {
          const r = await fetch(`${API_BASE}/api/v1/factory-reset`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ preset: id, userId: currentUser?.id || 'user1' }) 
          });
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.error || 'Failed to load scenario');
          }
          await new Promise(resolve => setTimeout(resolve, 300));
          onClose?.();
        } catch (e) { 
          setError(e.message || 'Failed to load scenario'); 
        } finally { 
          setBusy(false); 
        }
      };

      const saveScenario = async () => {
        if (!saveName.trim() || saveName.trim().length < 3) {
          setError('Scenario name required (min 3 characters)');
          return;
        }
        setBusy(true); setError('');
        try {
          const r = await fetch(`${API_BASE}/api/v1/scenarios/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: saveName.trim(),
              description: saveDescription.trim(),
              userId: currentUser?.id || 'user1'
            })
          });
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.error || 'Failed to save scenario');
          }
          setSaveName('');
          setSaveDescription('');
          setView('main');
          await loadScenarios();
        } catch (e) {
          setError(e.message || 'Failed to save scenario');
        } finally {
          setBusy(false);
        }
      };

      const deleteScenario = async (id) => {
        setBusy(true); setError('');
        try {
          const r = await fetch(`${API_BASE}/api/v1/scenarios/${id}?userId=${currentUser?.id || 'user1'}`, {
            method: 'DELETE'
          });
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.error || 'Failed to delete scenario');
          }
          setScenarioToDelete(null);
          setView('main');
          await loadScenarios();
        } catch (e) {
          setError(e.message || 'Failed to delete scenario');
        } finally {
          setBusy(false);
        }
      };

      // Main view
      if (view === 'main') {
        return React.createElement('div', { className: 'modal-overlay', onClick: (e) => { if (e.target === e.currentTarget && !busy) onClose?.(); } },
          React.createElement('div', { className: 'modal-panel', style: { maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' } }, [
            React.createElement('div', { key: 'h', className: 'modal-header' }, [
              React.createElement('div', { key: 't', className: 'font-bold' }, 'Scenario Loader'),
              React.createElement('button', { key: 'x', className: 'ui-modal__close', onClick: onClose, disabled: busy }, '✕')
            ]),
            error ? React.createElement('div', { key: 'e', className: 'bg-error-50 text-error-700 p-2 border-t border-b border-error-200' }, error) : null,
            React.createElement('div', { key: 'b', className: 'modal-body', style: { display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' } }, [
              // Presets section
              React.createElement('div', { key: 'presets-section' }, [
                React.createElement('h3', { key: 'title', style: { fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#374151' } }, 'Preset Scenarios'),
                React.createElement('div', { key: 'cards', style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
                  scenarios.presets.map(preset => 
                    React.createElement('div', { 
                      key: preset.id, 
                      style: {
                        border: '2px solid #D1D5DB',
                        borderRadius: '8px',
                        padding: '16px',
                        cursor: busy ? 'not-allowed' : 'pointer',
                        backgroundColor: '#FFFFFF',
                        transition: 'all 0.2s'
                      },
                      onMouseEnter: (e) => { e.currentTarget.style.borderColor = '#6366F1'; },
                      onMouseLeave: (e) => { e.currentTarget.style.borderColor = '#D1D5DB'; },
                      onClick: () => !busy && loadScenario(preset.id, true)
                    }, [
                      React.createElement('div', { key: 'label', style: { fontWeight: 600, fontSize: '16px', marginBottom: '4px' } }, preset.label),
                      React.createElement('div', { key: 'desc', style: { fontSize: '14px', color: '#6B7280' } }, preset.description)
                    ])
                  )
                ),
                // Save Current Scenario card
                React.createElement('div', { 
                  key: 'save-card',
                  style: {
                    border: '2px dashed #9CA3AF',
                    borderRadius: '8px',
                    padding: '16px',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    backgroundColor: '#F9FAFB',
                    transition: 'all 0.2s',
                    marginTop: '4px'
                  },
                  onMouseEnter: (e) => { e.currentTarget.style.borderColor = '#6366F1'; e.currentTarget.style.backgroundColor = '#EEF2FF'; },
                  onMouseLeave: (e) => { e.currentTarget.style.borderColor = '#9CA3AF'; e.currentTarget.style.backgroundColor = '#F9FAFB'; },
                  onClick: () => !busy && setView('save')
                }, [
                  React.createElement('div', { key: 'label', style: { fontWeight: 600, fontSize: '16px', marginBottom: '4px', color: '#6366F1' } }, '+ Save Current Scenario'),
                  React.createElement('div', { key: 'desc', style: { fontSize: '14px', color: '#6B7280' } }, 'Capture current state as a reusable scenario.')
                ])
              ]),
              // User scenarios section
              scenarios.scenarios.length > 0 ? React.createElement('div', { key: 'user-scenarios' }, [
                React.createElement('h3', { key: 'title', style: { fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#374151' } }, 'Your Saved Scenarios'),
                React.createElement('div', { key: 'cards', style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
                  scenarios.scenarios.map(scenario => 
                    React.createElement('div', { 
                      key: scenario.id, 
                      style: {
                        border: '2px solid #D1D5DB',
                        borderRadius: '8px',
                        padding: '16px',
                        backgroundColor: '#FFFFFF',
                        transition: 'all 0.2s',
                        position: 'relative'
                      },
                      onMouseEnter: (e) => { e.currentTarget.style.borderColor = '#6366F1'; },
                      onMouseLeave: (e) => { e.currentTarget.style.borderColor = '#D1D5DB'; }
                    }, [
                      React.createElement('div', { 
                        key: 'content',
                        style: { cursor: busy ? 'not-allowed' : 'pointer', paddingRight: '40px' },
                        onClick: () => !busy && loadScenario(scenario.id, false)
                      }, [
                        React.createElement('div', { key: 'label', style: { fontWeight: 600, fontSize: '16px', marginBottom: '4px' } }, scenario.label),
                        scenario.description ? React.createElement('div', { key: 'desc', style: { fontSize: '14px', color: '#6B7280', marginBottom: '8px' } }, scenario.description) : null,
                        scenario.stats ? React.createElement('div', { key: 'stats', style: { fontSize: '12px', color: '#9CA3AF' } }, 
                          `${scenario.stats.messages || 0} messages • ${scenario.stats.variables || 0} variables • ${scenario.stats.versions || 0} versions • ${scenario.stats.activities || 0} activities`
                        ) : null
                      ]),
                      React.createElement('button', {
                        key: 'delete',
                        style: {
                          position: 'absolute',
                          top: '16px',
                          right: '16px',
                          background: 'none',
                          border: 'none',
                          cursor: busy ? 'not-allowed' : 'pointer',
                          fontSize: '18px',
                          color: '#EF4444',
                          padding: '4px 8px'
                        },
                        onClick: (e) => {
                          e.stopPropagation();
                          if (!busy) {
                            setScenarioToDelete(scenario);
                            setView('confirm-delete');
                          }
                        },
                        title: 'Delete scenario'
                      }, '🗑️')
                    ])
                  )
                )
              ]) : null
            ]),
            React.createElement('div', { key: 'f', className: 'modal-footer' }, [
              React.createElement(UIButton, { key: 'close', label: 'Close', onClick: onClose, disabled: busy })
            ])
          ])
        );
      }

      // Save dialog
      if (view === 'save') {
        return React.createElement('div', { className: 'modal-overlay', onClick: (e) => { if (e.target === e.currentTarget && !busy) setView('main'); } },
          React.createElement('div', { className: 'modal-panel', style: { maxWidth: '500px' } }, [
            React.createElement('div', { key: 'h', className: 'modal-header' }, [
              React.createElement('div', { key: 't', className: 'font-bold' }, 'Save Current Scenario'),
              React.createElement('button', { key: 'x', className: 'ui-modal__close', onClick: () => setView('main'), disabled: busy }, '✕')
            ]),
            error ? React.createElement('div', { key: 'e', className: 'bg-error-50 text-error-700 p-2 border-t border-b border-error-200' }, error) : null,
            React.createElement('div', { key: 'b', className: 'modal-body', style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, [
              React.createElement('div', { key: 'name' }, [
                React.createElement('label', { key: 'label', style: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 } }, 'Scenario Name *'),
                React.createElement('input', {
                  key: 'input',
                  type: 'text',
                  value: saveName,
                  onChange: (e) => setSaveName(e.target.value),
                  placeholder: 'e.g., Q1 Demo, Vendor Negotiation',
                  maxLength: 50,
                  disabled: busy,
                  style: { width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }
                })
              ]),
              React.createElement('div', { key: 'desc' }, [
                React.createElement('label', { key: 'label', style: { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 } }, 'Description (optional)'),
                React.createElement('textarea', {
                  key: 'input',
                  value: saveDescription,
                  onChange: (e) => setSaveDescription(e.target.value),
                  placeholder: 'Brief description of this scenario',
                  maxLength: 200,
                  rows: 2,
                  disabled: busy,
                  style: { width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }
                })
              ])
            ]),
            React.createElement('div', { key: 'f', className: 'modal-footer' }, [
              React.createElement(UIButton, { key: 'cancel', label: 'Cancel', onClick: () => setView('main'), disabled: busy }),
              React.createElement(UIButton, { 
                key: 'save', 
                label: 'Save Scenario', 
                onClick: saveScenario, 
                variant: 'primary', 
                isLoading: busy,
                loadingLabel: 'Saving…',
                disabled: !saveName.trim() || saveName.trim().length < 3
              })
            ])
          ])
        );
      }

      // Delete confirmation
      if (view === 'confirm-delete' && scenarioToDelete) {
        return React.createElement('div', { className: 'modal-overlay', onClick: (e) => { if (e.target === e.currentTarget && !busy) setView('main'); } },
          React.createElement('div', { className: 'modal-panel', style: { maxWidth: '400px' } }, [
            React.createElement('div', { key: 'h', className: 'modal-header' }, [
              React.createElement('div', { key: 't', className: 'font-bold' }, 'Delete Scenario?'),
              React.createElement('button', { key: 'x', className: 'ui-modal__close', onClick: () => setView('main'), disabled: busy }, '✕')
            ]),
            React.createElement('div', { key: 'b', className: 'modal-body' }, [
              React.createElement('p', { key: 'msg', style: { fontSize: '14px', color: '#374151' } }, 
                `Are you sure you want to delete "${scenarioToDelete.label}"? This cannot be undone.`
              )
            ]),
            React.createElement('div', { key: 'f', className: 'modal-footer' }, [
              React.createElement(UIButton, { key: 'cancel', label: 'Cancel', onClick: () => setView('main'), disabled: busy }),
              React.createElement(UIButton, { 
                key: 'delete', 
                label: 'Delete', 
                onClick: () => deleteScenario(scenarioToDelete.id), 
                danger: true,
                isLoading: busy,
                loadingLabel: 'Deleting…'
              })
            ])
          ])
        );
      }

      return null;
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

    function VersionOutdatedCheckoutModal(props) {
      const { onClose, currentVersion, clientVersion, viewingVersion, message, userId } = props || {};
      const { tokens } = React.useContext(ThemeContext);
      const { actions, addLog, refresh, setViewingVersion, setLoadedVersion } = React.useContext(StateContext);
      const t = tokens && tokens.modal ? tokens.modal : {};
      
      const handleCheckoutLatest = async () => {
        
        try {
          const response = await fetch(`${getApiBase()}/api/v1/checkout`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ userId, clientVersion: currentVersion, forceCheckout: true }) 
          });
          
          
          
          if (response.ok) {
            addLog('Document checked out successfully (latest version)', 'success'); 
            try { 
              await refresh(); 
              console.log(`[DEBUG] Setting viewingVersion to ${currentVersion} - Source: checkout (current version)`);
              try { if (typeof setViewingVersion === 'function') setViewingVersion(currentVersion); } catch {}
              try { if (typeof setLoadedVersion === 'function') setLoadedVersion(currentVersion); } catch {}
              try {
                const plat = (function(){ try { return (typeof Office !== 'undefined') ? 'word' : 'web'; } catch { return 'web'; } })();
                window.dispatchEvent(new CustomEvent('version:view', { detail: { version: currentVersion, payload: { messagePlatform: plat } } }));
              } catch {}
            } finally { onClose?.(); }
          } else {
            const errorData = await response.json();
            
            addLog(`Failed to check out document: ${errorData.error || 'Unknown error'}`, 'error');
          }
        } catch (e) { 
          console.error('handleCheckoutLatest exception:', e);
          addLog(`Failed to check out document: ${e?.message||e}`, 'error'); 
        }
      };

      const handleCheckoutCurrent = async () => {
        const versionToUse = viewingVersion || clientVersion;
        
        try {
          const response = await fetch(`${getApiBase()}/api/v1/checkout`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ userId, clientVersion: versionToUse, forceCheckout: true }) 
          });
          
          
          
          if (response.ok) {
            addLog(`Document checked out successfully (version ${versionToUse})`, 'success'); 
            try { 
              await refresh(); 
              console.log(`[DEBUG] Setting viewingVersion to ${versionToUse} - Source: checkout (specific version)`);
              try { if (typeof setViewingVersion === 'function') setViewingVersion(versionToUse); } catch {}
              try { if (typeof setLoadedVersion === 'function') setLoadedVersion(versionToUse); } catch {}
              try {
                const plat = (function(){ try { return (typeof Office !== 'undefined') ? 'word' : 'web'; } catch { return 'web'; } })();
                window.dispatchEvent(new CustomEvent('version:view', { detail: { version: versionToUse, payload: { messagePlatform: plat } } }));
              } catch {}
            } finally { onClose?.(); }
          } else {
            const errorData = await response.json();
            
            addLog(`Failed to check out document: ${errorData.error || 'Unknown error'}`, 'error');
          }
        } catch (e) { 
          console.error('handleCheckoutCurrent exception:', e);
          addLog(`Failed to check out document: ${e?.message||e}`, 'error'); 
        }
      };

      const btn = (label, variant, onclick) => React.createElement(UIButton, { label, onClick: onclick, variant: variant || 'primary' });

      return React.createElement('div', { className: 'modal-overlay', onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { className: 'modal-panel' }, [
          React.createElement('div', { key: 'h', className: 'modal-header' }, [
            React.createElement('div', { key: 't', className: 'font-bold' }, 'Document Updated'),
            React.createElement('button', { key: 'x', className: 'ui-modal__close', onClick: onClose }, '✕')
          ]),
          React.createElement('div', { key: 'b', className: 'modal-body' }, [
            React.createElement('p', { key: 'msg', style: { marginBottom: '16px' } }, 'Document has been updated. Which version would you like to check out?'),
            React.createElement('div', { key: 'info', style: { marginBottom: '20px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' } }, [
              React.createElement('div', { key: 'current', style: { marginBottom: '4px' } }, `Latest version: ${currentVersion || 'Unknown'}`),
              React.createElement('div', { key: 'viewing' }, `You're viewing version: ${viewingVersion || clientVersion || 'Unknown'}`)
            ])
          ]),
          React.createElement('div', { key: 'f', className: 'modal-footer' }, [
            btn('Cancel', 'tertiary', onClose),
            btn(`Check Out Version ${viewingVersion || clientVersion}`, 'secondary', handleCheckoutCurrent),
            btn('Check Out Latest Version', 'primary', handleCheckoutLatest)
          ])
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

    function SystemPromptEditorModal(props) {
      const { onClose } = props || {};
      const [prompt, setPrompt] = React.useState('');
      const [loading, setLoading] = React.useState(true);
      const [saving, setSaving] = React.useState(false);
      const [error, setError] = React.useState('');
      const [contextPreview, setContextPreview] = React.useState('');
      
      React.useEffect(() => {
        const API_BASE = getApiBase();
        (async () => {
          try {
            const r = await fetch(`${API_BASE}/api/v1/chat/system-prompt`);
            if (r.ok) {
              const data = await r.json();
              setPrompt(data.prompt || '');
              setContextPreview(data.documentContextPreview || '');
            } else {
              setError('Failed to load system prompt');
            }
          } catch (e) {
            setError('Error loading system prompt: ' + e.message);
          }
          setLoading(false);
        })();
      }, []);
      
      const save = async () => {
        if (prompt.trim().length < 10) {
          setError('Prompt must be at least 10 characters');
          return;
        }
        if (prompt.length > 2000) {
          setError('Prompt is too long (max 2000 characters)');
          return;
        }
        
        setSaving(true);
        setError('');
        try {
          const API_BASE = getApiBase();
          const r = await fetch(`${API_BASE}/api/v1/chat/system-prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
          });
          if (r.ok) {
            onClose?.();
          } else {
            const data = await r.json();
            setError(data.error || 'Failed to save prompt');
          }
        } catch (e) {
          setError('Error saving prompt: ' + e.message);
        }
        setSaving(false);
      };
      
      const resetToDefault = async () => {
        if (!confirm('Reset to default prompt? This will delete your custom prompt.')) return;
        
        setSaving(true);
        setError('');
        try {
          const API_BASE = getApiBase();
          const r = await fetch(`${API_BASE}/api/v1/chat/system-prompt/reset`, {
            method: 'POST'
          });
          if (r.ok) {
            // Reload prompt
            const r2 = await fetch(`${API_BASE}/api/v1/chat/system-prompt`);
            if (r2.ok) {
              const data = await r2.json();
              setPrompt(data.prompt || '');
            }
          } else {
            setError('Failed to reset prompt');
          }
        } catch (e) {
          setError('Error resetting prompt: ' + e.message);
        }
        setSaving(false);
      };
      
      const btn = (label, variant, onclick, disabled) => React.createElement(UIButton, { label, onClick: onclick, variant: variant || 'primary', disabled });
      
      return React.createElement('div', { className: 'modal-overlay', onClick: (e) => { if (e.target === e.currentTarget) onClose?.(); } },
        React.createElement('div', { className: 'modal-panel', style: { maxWidth: '700px', width: '90%' } }, [
          React.createElement('div', { key: 'h', className: 'modal-header' }, [
            React.createElement('div', { key: 't', className: 'font-bold' }, 'AI System Prompt'),
            React.createElement('button', { key: 'x', className: 'ui-modal__close', onClick: onClose }, '✕')
          ]),
          React.createElement('div', { key: 'b', className: 'modal-body d-flex flex-column gap-16' }, [
            loading ? React.createElement('div', { key: 'loading' }, 'Loading...') : null,
            !loading ? React.createElement('div', { key: 'info', className: 'text-sm text-gray-500 p-3 bg-gray-50 rounded border border-gray-200' }, [
              React.createElement('div', { key: 'label', className: 'font-semibold mb-1' }, 'How it works:'),
              React.createElement('div', { key: 'text' }, 'The {DOCUMENT_CONTEXT} placeholder will be automatically replaced with the current document content. This prompt guides how the AI responds to your questions.')
            ]) : null,
            !loading && contextPreview ? React.createElement('div', { key: 'preview', className: 'd-flex flex-column gap-4' }, [
              React.createElement('label', { key: 'label', className: 'text-sm font-semibold' }, 'Current Document Context (preview):'),
              React.createElement('div', { key: 'text', className: 'p-2 bg-gray-50 rounded border border-gray-200 text-xs text-gray-500', style: { fontFamily: 'monospace', maxHeight: '80px', overflow: 'auto' } }, contextPreview)
            ]) : null,
            !loading ? React.createElement('div', { key: 'prompt', className: 'd-flex flex-column gap-6' }, [
              React.createElement('label', { key: 'label', className: 'text-sm font-semibold' }, 'System Prompt:'),
              React.createElement('textarea', {
                key: 'textarea',
                rows: 10,
                value: prompt,
                onChange: (e) => setPrompt(e.target.value),
                placeholder: 'Enter system prompt...',
                className: 'input-padding input-border input-border-radius',
                style: { resize: 'vertical' }
              }),
              React.createElement('div', { key: 'count', className: 'text-xs text-gray-500 text-right' }, `${prompt.length} / 2000 characters`)
            ]) : null,
            error ? React.createElement('div', { key: 'error', className: 'text-sm text-red-600 p-2 bg-red-50 rounded border border-red-200' }, error) : null
          ]),
          React.createElement('div', { key: 'f', className: 'modal-footer d-flex justify-between' }, [
            React.createElement('div', { key: 'left' }, btn('Reset to Default', 'secondary', resetToDefault, saving || loading)),
            React.createElement('div', { key: 'right', className: 'd-flex gap-8' }, [
              btn('Cancel', 'secondary', onClose, saving),
              btn('Save', 'primary', save, saving || loading)
            ])
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

      const sendToVendor = async () => {
        try {
          window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'send-vendor', options: { userId: currentUser } } }));
        } catch {}
      };

      const workflowButtons = React.createElement('div', { key: 'workflow-buttons', style: { display: 'flex', gap: '8px', marginBottom: '16px' } }, [
        React.createElement(UIButton, {
          key: 'send-vendor',
          label: 'Send to Vendor',
          onClick: sendToVendor,
          disabled: busy
        }),
        React.createElement(UIButton, {
          key: 'request-review',
          label: 'Request Review',
          onClick: () => {
            try { window.dispatchEvent(new CustomEvent('react:open-modal', { detail: { id: 'request-review' } })); } catch {}
          },
          disabled: busy,
          primary: true
        })
      ]);

      return React.createElement('div', null, [
        error ? React.createElement('div', { className: 'bg-error-50 text-error-700 p-2 mb-2 border border-error-200 rounded' }, error) : null,
        workflowButtons,
        header,
        list,
        (prompt ? React.createElement(ConfirmModal, { title: prompt.title, message: prompt.message, onConfirm: async () => { try { await prompt.onConfirm?.(); } finally { setPrompt(null); } }, onClose: () => setPrompt(null) }) : null)
      ]);
    }

    // Variables Panel - Phase 3: Full implementation with inline value editing
    function VariablesPanel() {
      const API_BASE = getApiBase();
      const { currentUser, revision } = React.useContext(StateContext);
      const [showModal, setShowModal] = React.useState(false);
      const [variableName, setVariableName] = React.useState('');
      const [variableType, setVariableType] = React.useState('value');
      const [variableEmail, setVariableEmail] = React.useState('');
      const [isCreating, setIsCreating] = React.useState(false);
      const [variables, setVariables] = React.useState({});
      const [isLoading, setIsLoading] = React.useState(true);
      const [editingValues, setEditingValues] = React.useState({});
      const [editingNames, setEditingNames] = React.useState({});
      const [filterType, setFilterType] = React.useState('all'); // 'all', 'value', 'signature'
      const saveTimeouts = React.useRef({});
      const lastLoadedRevision = React.useRef(0);

      // Helper: Get variable colors from CSS variables
      const getVariableColors = () => {
        try {
          const styles = getComputedStyle(document.documentElement);
          return {
            borderColor: styles.getPropertyValue('--variable-border-color').trim() || '#0E6F7F',
            highlightColor: styles.getPropertyValue('--variable-highlight-color').trim() || '#F1FAFC'
          };
        } catch (error) {
          // Fallback to hardcoded values if CSS variables aren't available
          return {
            borderColor: '#0E6F7F',
            highlightColor: '#F1FAFC'
          };
        }
      };

      // Load variables from backend
      const loadVariables = React.useCallback(async () => {
          try {
          console.log(`📡 [VariablesPanel] Loading variables (revision: ${revision})`);
          const response = await fetch(`${API_BASE}/api/v1/variables?rev=${Date.now()}`, { cache: 'no-store' });
            if (response.ok) {
              const data = await response.json();
            const varCount = Object.keys(data.variables || {}).length;
            console.log(`✅ [VariablesPanel] Loaded ${varCount} variables from server`);
              setVariables(data.variables || {});
            lastLoadedRevision.current = revision;
          } else {
            console.error(`❌ [VariablesPanel] Failed to load variables: ${response.status}`);
            }
          } catch (error) {
          console.error('❌ [VariablesPanel] Error loading variables:', error);
          } finally {
            setIsLoading(false);
          }
      }, [API_BASE, revision]);

      // Load variables on mount and when revision changes
      React.useEffect(() => {
        console.log(`🔄 [VariablesPanel] useEffect triggered - revision: ${revision}, lastLoaded: ${lastLoadedRevision.current}`);
        // Load on initial mount (revision 0) or when revision changes
        if (revision !== lastLoadedRevision.current) {
        loadVariables();
        }
      }, [revision, loadVariables]);

      // Listen for SSE variable events
      React.useEffect(() => {
        console.log('🔧 Variables SSE useEffect is running');
        console.log('🔧 window.eventSource available?', !!window.eventSource);
        
        const handleVariableCreated = (event) => {
          try {
            const data = event.detail || {};
            console.log('📡 SSE variable:created received:', data);
            if (data.variable) {
              setVariables(prev => {
                const updated = { ...prev, [data.variable.varId]: data.variable };
                console.log('🔄 Variables state updated (created):', updated);
                return updated;
              });
            }
          } catch (error) {
            console.error('Failed to handle variable:created event:', error);
          }
        };

        const handleVariableUpdated = (event) => {
          try {
            const data = event.detail || {};
            console.log('📡 SSE variable:updated received:', data);
            if (data.variable) {
              const updatedVariable = data.variable;
              setVariables(prev => {
                const updated = { ...prev, [updatedVariable.varId]: updatedVariable };
                console.log('🔄 Variables state updated:', updated);
                return updated;
              });
              // For signature variables, update document when label changes
              // (signatures have no value, so they display the label)
              if (updatedVariable.type === 'signature') {
                console.log('🔄 Signature label updated - updating document to show new label:', updatedVariable.displayLabel);
                // Use the variable data from SSE event (which has the new label), not from state
                updateVariableInDocument(updatedVariable);
              }
              // For value variables, name is metadata and doesn't affect document display
            }
          } catch (error) {
            console.error('Failed to handle variable:updated event:', error);
          }
        };

        const handleVariableValueChanged = (event) => {
          try {
            console.log('📡 SSE variable:valueChanged received:', event.detail);
            const data = event.detail || {};
            if (data.variable) {
              console.log('🔄 Updating variable in state and document:', data.variable.varId, data.variable.value);
              setVariables(prev => ({ ...prev, [data.variable.varId]: data.variable }));
              // Update the editing value to reflect the change in the input field
              setEditingValues(prev => ({ ...prev, [data.variable.varId]: data.variable.value }));
              // Value changed - update document to show new value
              updateVariableInDocument(data.variable);
            }
          } catch (error) {
            console.error('Failed to handle variable:valueChanged event:', error);
          }
        };

        const handleVariableDeleted = (event) => {
          try {
            const data = event.detail || {};
            if (data.varId) {
              setVariables(prev => {
                const updated = { ...prev };
                delete updated[data.varId];
                return updated;
              });
            }
          } catch (error) {
            console.error('Failed to handle variable:deleted event:', error);
          }
        };

        const handleVariablesReset = async () => {
          console.log('🔄 Variables reset event received - reloading from backend');
          setVariables({});
          setEditingValues({});
          setEditingNames({});
          
          // Reload variables from backend (they should be restored from seed)
          try {
            const response = await fetch(`${API_BASE}/api/v1/variables?rev=${Date.now()}`, { cache: 'no-store' });
            if (response.ok) {
              const data = await response.json();
              setVariables(data.variables || {});
              console.log('✅ Variables reloaded after reset:', Object.keys(data.variables || {}).length);
            } else {
              console.error('❌ Failed to reload variables after reset');
            }
          } catch (error) {
            console.error('❌ Error reloading variables after reset:', error);
          }
        };

        const handleFactoryReset = async () => {
          console.log('🔄 [VariablesPanel] Factory reset event received - reloading variables from preset');
          setVariables({});
          setEditingValues({});
          setEditingNames({});
          
          // Reload variables from backend (they should now contain preset variables)
          try {
            const url = `${API_BASE}/api/v1/variables?rev=${Date.now()}`;
            console.log(`📡 [VariablesPanel] Fetching variables from: ${url}`);
            const response = await fetch(url, { cache: 'no-store' });
            if (response.ok) {
              const data = await response.json();
              const varCount = Object.keys(data.variables || {}).length;
              console.log(`✅ [VariablesPanel] Received ${varCount} variables from server after factory reset`);
              setVariables(data.variables || {});
            } else {
              console.error(`❌ [VariablesPanel] Failed to reload variables after factory reset: ${response.status}`);
            }
          } catch (error) {
            console.error('❌ [VariablesPanel] Error reloading variables after factory reset:', error);
          }
        };

        // Listen to window custom events dispatched by main SSE handler
        console.log('✅ Attaching variable window event listeners');
        window.addEventListener('variable:created', handleVariableCreated);
        window.addEventListener('variable:updated', handleVariableUpdated);
        window.addEventListener('variable:valueChanged', handleVariableValueChanged);
        window.addEventListener('variable:deleted', handleVariableDeleted);
        window.addEventListener('variables:reset', handleVariablesReset);
        window.addEventListener('factoryReset', handleFactoryReset);

        return () => {
          window.removeEventListener('variable:created', handleVariableCreated);
          window.removeEventListener('variable:updated', handleVariableUpdated);
          window.removeEventListener('variable:valueChanged', handleVariableValueChanged);
          window.removeEventListener('variable:deleted', handleVariableDeleted);
          window.removeEventListener('variables:reset', handleVariablesReset);
          window.removeEventListener('factoryReset', handleFactoryReset);
        };
      }, [API_BASE]);

      // Helper: Update variable value in document when it changes
      const updateVariableInDocument = async (variable) => {
        const isWordAddin = typeof Office !== 'undefined' && Office.context && Office.context.host;
        
        if (isWordAddin) {
          // Word add-in: Update Content Controls with matching tag
          try {
            await Word.run(async (context) => {
              const contentControls = context.document.contentControls;
              contentControls.load('items');
              await context.sync();
              
              let updated = false;
              for (let i = 0; i < contentControls.items.length; i++) {
                const cc = contentControls.items[i];
                cc.load('tag,title,text');
                await context.sync();
                
                if (cc.tag === variable.varId) {
                  // For signatures, use displayLabel; for values, use value (or label as fallback)
                  const displayText = variable.type === 'signature' 
                    ? variable.displayLabel 
                    : (variable.value || variable.displayLabel);
                  console.log(`🔄 Updating Word CC (type: ${variable.type}): "${cc.text}" → "${displayText}"`);
                  
                  // Load lock status - only cannotEdit and cannotDelete exist in Word JS API
                  cc.load(['cannotEdit', 'cannotDelete']);
                  await context.sync();
                  
                  const wasLocked = cc.cannotEdit;
                  
                  // Temporarily unlock if locked
                  if (wasLocked) {
                    cc.cannotEdit = false;
                    await context.sync();
                  }
                  
                  // Clear existing text and insert new text (preserves Content Control)
                  cc.clear();
                  cc.insertText(displayText, Word.InsertLocation.start);
                  await context.sync();
                  
                  // Re-lock (always lock after update to ensure consistency)
                  cc.cannotEdit = true;
                  cc.cannotDelete = false; // Allow deletion via delete button
                  await context.sync();
                  
                  console.log('✅ Updated Word Content Control:', displayText);
                  updated = true;
                }
              }
              
              if (!updated) {
                console.log(`⚠️ No Content Control found with tag: ${variable.varId}`);
              }
            });
          } catch (error) {
            console.error('❌ Failed to update Word Content Control:', error);
          }
        } else {
          // Web viewer: Update SuperDoc field annotations
          console.log('🔍 Attempting to update SuperDoc field:', variable.varId, variable.value);
          if (!window.superdocInstance) {
            console.error('❌ window.superdocInstance is not available');
            return;
          }
          if (!window.superdocInstance.editor) {
            console.error('❌ window.superdocInstance.editor is not available');
            return;
          }
          
          const editor = window.superdocInstance.editor;
          console.log('🔍 Editor available:', !!editor);
          console.log('🔍 Editor.commands:', !!editor.commands);
          
          // SuperDoc field annotation update: Manually walk ProseMirror document
          // Helpers aren't exposed in UMD build, so we access editor.view.state.doc directly
          
          if (editor.view && editor.view.state && editor.commands) {
            try {
              // For signatures, use displayLabel; for values, use value (or label as fallback)
              const displayText = variable.type === 'signature' 
                ? variable.displayLabel 
                : (variable.value || variable.displayLabel);
              console.log(`🔄 Attempting to update field ${variable.varId} (type: ${variable.type}) with new text: "${displayText}"`);
              
              const doc = editor.view.state.doc;
              const annotations = [];
              const contentControls = [];
              const allNodes = [];
              
              // Manually walk the document to find BOTH field annotations AND content controls
              doc.descendants((node, pos) => {
                // Debug: collect all node types
                allNodes.push({ type: node.type.name, attrs: node.attrs, pos });
                
                // Find Field Annotations (web-created variables)
                if (node.type.name === 'fieldAnnotation' && node.attrs.fieldId === variable.varId) {
                  annotations.push({ node, pos, source: 'fieldAnnotation' });
                }
                
                // Find Content Controls (Word-created variables)
                if (node.type.name === 'structuredContent') {
                  // Extract varId from w:tag in sdtPr.elements
                  let ccVarId = null;
                  if (node.attrs?.sdtPr?.elements) {
                    for (const elem of node.attrs.sdtPr.elements) {
                      if (elem.name === 'w:tag' && elem.attributes?.['w:val']) {
                        ccVarId = elem.attributes['w:val'];
                        break;
                      }
                    }
                  }
                  
                  if (ccVarId === variable.varId) {
                    contentControls.push({ node, pos, source: 'contentControl' });
                  }
                }
              });
              
              const totalFound = annotations.length + contentControls.length;
              console.log(`🔍 Document contains ${allNodes.length} total nodes`);
              console.log(`🔍 Node types in document:`, [...new Set(allNodes.map(n => n.type))]);
              console.log(`🔍 Found ${annotations.length} Field Annotations + ${contentControls.length} Content Controls = ${totalFound} total for ${variable.varId}`);
              
              // Update Field Annotations (web-created variables)
              if (annotations.length > 0) {
                for (let i = annotations.length - 1; i >= 0; i--) {
                  const { node, pos } = annotations[i];
                  const oldLabel = node.attrs.displayLabel;
                  
                  console.log(`📝 Updating Field Annotation ${i + 1}/${annotations.length} at pos ${pos}: "${oldLabel}" → "${displayText}"`);
                  
                  const colors = getVariableColors();
                  editor.commands.deleteFieldAnnotation({ node, pos });
                  editor.commands.addFieldAnnotation(pos, {
                    fieldId: variable.varId,
                    displayLabel: displayText,
                    fieldType: 'TEXTINPUT',
                    fieldColor: colors.borderColor,
                    type: variable.type
                  });
                  
                  console.log(`✅ Replaced Field Annotation ${i + 1}/${annotations.length}`);
                }
              }
              
              // Update Content Controls (Word-created variables)
              if (contentControls.length > 0) {
                console.log(`ℹ️ Found ${contentControls.length} Content Control(s) to update`);
                
                for (let i = 0; i < contentControls.length; i++) {
                  const { node, pos } = contentControls[i];
                  
                  console.log(`🔄 Updating Content Control ${i + 1}/${contentControls.length} at pos ${pos}`);
                  console.log(`   Old text: "${node.textContent}"`);
                  console.log(`   New text: "${displayText}"`);
                  
                  try {
                    // Create a transaction to update the text content
                    // Content Controls have a complex structure with sdtContent inside
                    // We need to find and replace the text nodes within
                    const { state, dispatch } = editor.view;
                    const tr = state.tr;
                    
                    // Find the text node(s) inside the structuredContent node
                    // The structure is: structuredContent > (possibly other nodes) > text
                    let textStart = null;
                    let textEnd = null;
                    
                    node.descendants((childNode, childPos) => {
                      if (childNode.isText || childNode.type.name === 'text') {
                        if (textStart === null) {
                          // First text node - calculate absolute position
                          textStart = pos + childPos + 1; // +1 because pos is before the node
                        }
                        textEnd = pos + childPos + 1 + childNode.nodeSize;
                      }
                    });
                    
                    if (textStart !== null && textEnd !== null) {
                      // Replace the text content
                      tr.replaceWith(textStart, textEnd, state.schema.text(displayText));
                      dispatch(tr);
                      console.log(`✅ Content Control text updated: ${textStart} → ${textEnd}`);
                    } else {
                      // If no text found, try to insert at the beginning of the content
                      console.log(`⚠️ No text nodes found in Content Control, attempting to insert text`);
                      
                      // Try to find sdtContent and insert text there
                      let insertPos = null;
                      node.descendants((childNode, childPos) => {
                        if (insertPos === null && childNode.type.name === 'paragraph') {
                          insertPos = pos + childPos + 2; // +1 for node boundary, +1 to get inside
                        }
                      });
                      
                      if (insertPos !== null) {
                        tr.insertText(displayText, insertPos);
                        dispatch(tr);
                        console.log(`✅ Content Control text inserted at pos ${insertPos}`);
                      } else {
                        console.error(`❌ Could not find insertion point in Content Control`);
                      }
                    }
                  } catch (error) {
                    console.error(`❌ Failed to update Content Control:`, error, error.stack);
                  }
                }
              }
              
              if (totalFound === 0) {
                console.log(`ℹ️ Variable ${variable.varId} not found in document (not yet inserted)`);
              }
            } catch (error) {
              console.error('❌ Failed to update SuperDoc field:', error, error.stack);
            }
          } else {
            console.warn('⚠️ SuperDoc editor.view or commands not available');
            console.log('🔍 editor.view:', !!editor.view);
            console.log('🔍 editor.commands:', !!editor.commands);
          }
        }
      };

      // Helper: Debounced save of variable value
      const handleValueChange = (varId, newValue) => {
        // Update local state immediately
        setEditingValues(prev => ({ ...prev, [varId]: newValue }));
        
        // Clear existing timeout for this variable
        if (saveTimeouts.current[varId]) {
          clearTimeout(saveTimeouts.current[varId]);
        }
        
        // Debounce save (500ms after last keystroke)
        saveTimeouts.current[varId] = setTimeout(async () => {
          try {
            const response = await fetch(`${API_BASE}/api/v1/variables/${varId}/value`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                value: newValue,
                userId: currentUser || 'user1'
              })
            });
            
            if (response.ok) {
              console.log('✅ Variable value saved:', varId, newValue);
              // Update the document to show the new value
              const updatedVariable = variables[varId];
              if (updatedVariable) {
                await updateVariableInDocument({ ...updatedVariable, value: newValue });
              }
            } else {
              console.error('❌ Failed to save variable value');
            }
          } catch (error) {
            console.error('❌ Error saving variable value:', error);
          }
        }, 500);
      };

      // Helper: Rename variable
      const handleRename = async (varId, newName) => {
        if (!newName.trim()) return;
        
        try {
          const response = await fetch(`${API_BASE}/api/v1/variables/${varId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              displayLabel: newName.trim(),
              userId: currentUser || 'user1'
            })
          });
          
          if (response.ok) {
            console.log('✅ Variable renamed:', newName);
            setEditingNames(prev => {
              const updated = { ...prev };
              delete updated[varId];
              return updated;
            });
          } else {
            console.error('❌ Failed to rename variable');
          }
        } catch (error) {
          console.error('❌ Error renaming variable:', error);
        }
      };

      // Helper: Delete variable
      const handleDelete = async (varId, displayLabel) => {
        // Note: Using console log instead of confirm() for Office add-in compatibility
        console.log('🗑️ Deleting variable:', displayLabel);
        
        try {
          const response = await fetch(`${API_BASE}/api/v1/variables/${varId}?userId=${currentUser || 'user1'}`, {
            method: 'DELETE'
          });
          
          if (response.ok) {
            console.log('✅ Variable deleted:', displayLabel);
          } else {
            console.error('❌ Failed to delete variable');
          }
        } catch (error) {
          console.error('❌ Error deleting variable:', error);
        }
      };

      const handleCreate = async () => {
        const name = variableName.trim();
        const email = variableEmail.trim();
        if (!name) return;
        
        // Validate email for signatures
        if (variableType === 'signature' && !email) {
          console.error('❌ Email is required for signatures');
          return;
        }

        setIsCreating(true);
        try {
          // Create variable via API (server will generate varId if not provided)
          const body = {
            displayLabel: name,
            type: variableType,
            value: '',
            userId: currentUser || 'user1'
          };
          
          // Add email for signatures
          if (variableType === 'signature') {
            body.email = email;
          }
          
          const response = await fetch(`${API_BASE}/api/v1/variables`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });

          if (!response.ok) {
            throw new Error('Failed to create variable');
          }

          const result = await response.json();
          console.log('✅ Variable created:', result.variable.displayLabel);

          // Note: Variable is now created and will appear in the list
          // User must click "Insert" button to add it to the document

        } catch (error) {
          console.error('❌ Error creating variable:', error);
        } finally {
          // Always close modal and reset, even on error
          setShowModal(false);
          setVariableName('');
          setVariableEmail('');
          setVariableType('value');
          setIsCreating(false);
        }
      };

      const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
          handleCreate();
        } else if (e.key === 'Escape') {
          setShowModal(false);
          setVariableName('');
          setVariableEmail('');
        }
      };

      // Modal
      const modal = showModal ? React.createElement('div', {
        className: 'd-flex items-center justify-center',
        style: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 10000
        },
        onClick: () => {
          setShowModal(false);
          setVariableName('');
          setVariableEmail('');
        }
      }, React.createElement('div', {
        className: 'bg-white rounded-lg',
        style: {
          padding: '24px',
          width: '400px',
          maxWidth: '90%',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        },
        onClick: (e) => e.stopPropagation()
      }, [
        React.createElement('h3', {
          key: 'title',
          className: 'text-lg font-semibold mb-16'
        }, 'Create Variable'),
        React.createElement('div', {
          key: 'type-selector',
          className: 'mb-12'
        }, [
          React.createElement('label', {
            key: 'label',
            className: 'd-block mb-6 text-sm font-medium'
          }, 'Type'),
          React.createElement('div', {
            key: 'types',
            className: 'd-flex gap-8'
          }, [
            React.createElement('button', {
              key: 'value',
              onClick: () => setVariableType('value'),
              className: 'flex-1 text-sm input-border-radius',
              style: {
                padding: '8px',
                border: variableType === 'value' ? '2px solid var(--btn-primary-bg)' : '1px solid var(--color-gray-300)',
                background: variableType === 'value' ? 'var(--color-indigo-50)' : 'var(--color-white)',
                cursor: 'pointer',
                fontWeight: variableType === 'value' ? '600' : '400'
              }
            }, 'Variable'),
            React.createElement('button', {
              key: 'signature',
              onClick: () => setVariableType('signature'),
              className: 'flex-1 text-sm input-border-radius',
              style: {
                padding: '8px',
                border: variableType === 'signature' ? '2px solid var(--btn-primary-bg)' : '1px solid var(--color-gray-300)',
                background: variableType === 'signature' ? 'var(--color-indigo-50)' : 'var(--color-white)',
                cursor: 'pointer',
                fontWeight: variableType === 'signature' ? '600' : '400'
              }
            }, 'Signature')
          ])
        ]),
        React.createElement('input', {
          key: 'input-name',
          type: 'text',
          value: variableName,
          onChange: (e) => setVariableName(e.target.value),
          onKeyDown: handleKeyPress,
          placeholder: variableType === 'value' ? 'e.g., Contract Amount' : 'e.g., Party A Signature',
          autoFocus: true,
          className: 'input-padding input-border input-border-radius text-base mb-12',
          style: { 
            width: '100%',
            boxSizing: 'border-box'
          }
        }),
        // Email field for signatures (required)
        variableType === 'signature' ? React.createElement('input', {
          key: 'input-email',
          type: 'email',
          value: variableEmail,
          onChange: (e) => setVariableEmail(e.target.value),
          onKeyDown: handleKeyPress,
          placeholder: 'Email address (required)',
          required: true,
          className: 'input-padding input-border input-border-radius text-base mb-16',
          style: { 
            width: '100%',
            boxSizing: 'border-box'
          }
        }) : null,
        React.createElement('div', {
          key: 'buttons',
          className: 'd-flex gap-8 justify-end'
        }, [
          React.createElement(UIButton, {
            key: 'cancel',
            label: 'Cancel',
            variant: 'secondary',
            onClick: () => {
              setShowModal(false);
              setVariableName('');
              setVariableEmail('');
            },
            disabled: isCreating
          }),
          React.createElement(UIButton, {
            key: 'create',
            label: isCreating ? 'Creating...' : 'Create',
            variant: 'primary',
            onClick: handleCreate,
            disabled: !variableName.trim() || (variableType === 'signature' && !variableEmail.trim()) || isCreating,
            isLoading: isCreating
          })
        ])
      ])) : null;

      // Main panel UI - container style matches Versions panel
      return React.createElement('div', { className: 'd-flex flex-column gap-8 pt-3 pb-16' }, [
        modal,
        React.createElement('div', {
          key: 'header',
          className: 'd-flex justify-between items-center gap-8'
        }, [
          // Filter dropdown
          React.createElement('select', {
            key: 'filter',
            className: 'standard-select',
            value: filterType,
            onChange: (e) => setFilterType(e.target.value)
          }, [
            React.createElement('option', { key: 'all', value: 'all' }, 'All'),
            React.createElement('option', { key: 'value', value: 'value' }, 'Variables'),
            React.createElement('option', { key: 'signature', value: 'signature' }, 'Signatures')
          ]),
          // Create button
          React.createElement(UIButton, {
            key: 'add',
            label: '+ Create Variable',
            onClick: () => setShowModal(true),
            variant: 'primary'
          })
        ]),
        (() => {
          if (isLoading) {
            return React.createElement('div', {
              className: 'text-gray-500 p-8'
            }, 'Loading variables...');
          }

          let variablesList = Object.values(variables);
          
          // Apply filter
          if (filterType !== 'all') {
            variablesList = variablesList.filter(v => v.type === filterType);
          }
          
          if (variablesList.length === 0) {
            return React.createElement('div', {
              className: 'text-gray-500 p-8'
            }, filterType === 'all' ? 'No variables yet.' : `No ${filterType === 'signature' ? 'signatures' : 'variables'} yet.`);
          }

          // Show variables list with inline value editing - card style matches Versions panel
          return React.createElement('div', { className: 'd-flex flex-column gap-8' }, variablesList.map((variable) => React.createElement('div', {
            key: variable.varId,
            className: 'border border-gray-200 rounded-xl bg-white',
            style: { padding: '14px 16px' }
          }, [
            // EDIT MODE - Show editable fields
            editingNames[variable.varId] !== undefined
              ? React.createElement('div', {
                  key: 'edit-mode',
                  className: 'd-flex flex-column gap-12'
                }, [
                  // Name input
                  React.createElement('div', { key: 'name-field' }, [
                    React.createElement('label', {
                      key: 'label',
                      className: 'd-block text-sm text-gray-500 mb-4 font-medium'
                    }, variable.type === 'signature' ? 'Signature Name' : 'Variable Name'),
                    React.createElement('input', {
                      key: 'input',
                      type: 'text',
                      value: editingNames[variable.varId],
                      onChange: (e) => setEditingNames(prev => ({ ...prev, [variable.varId]: e.target.value })),
                      onClick: (e) => e.stopPropagation(),
                      className: 'w-full font-mono text-base input-padding input-border input-border-radius'
                    })
                  ]),
                  // Value input
                  React.createElement('div', { key: 'value-field' }, [
                    // Only show label for signatures (Email Address), no label for value types
                    variable.type === 'signature' ? React.createElement('label', {
                      key: 'label',
                      className: 'd-block text-sm text-gray-500 mb-4 font-medium'
                    }, 'Email Address') : null,
                    React.createElement('input', {
                      key: 'input',
                      type: 'text',
                      value: editingValues[variable.varId] !== undefined 
                        ? editingValues[variable.varId] 
                        : (variable.type === 'signature' ? (variable.email || '') : (variable.value || '')),
                      onChange: (e) => setEditingValues(prev => ({ ...prev, [variable.varId]: e.target.value })),
                      onClick: (e) => e.stopPropagation(),
                      className: 'w-full font-mono text-base input-padding input-border input-border-radius',
                      placeholder: variable.type === 'signature' ? 'Enter email address...' : 'Enter value...'
                    })
                  ]),
                  // Buttons
                  React.createElement('div', {
                    key: 'buttons',
                    className: 'd-flex gap-8 justify-end'
                  }, [
                    React.createElement(UIButton, {
                      key: 'cancel',
                      label: 'Cancel',
                      variant: 'secondary',
                      onClick: (e) => {
                        e?.stopPropagation?.();
                        setEditingNames(prev => {
                          const updated = { ...prev };
                          delete updated[variable.varId];
                          return updated;
                        });
                        setEditingValues(prev => {
                          const updated = { ...prev };
                          delete updated[variable.varId];
                          return updated;
                        });
                      }
                    }),
                    React.createElement(UIButton, {
                      key: 'save',
                      label: 'Save',
                      variant: 'primary',
                      onClick: async (e) => {
                        e?.stopPropagation?.();
                        
                        // Save name if changed
                        if (editingNames[variable.varId] !== variable.displayLabel) {
                          await handleRename(variable.varId, editingNames[variable.varId]);
                        }
                        
                        const currentValue = editingValues[variable.varId];
                        
                        // For signatures, the "value" field is actually the email
                        if (variable.type === 'signature') {
                          if (currentValue !== undefined && currentValue !== variable.email) {
                            try {
                              const response = await fetch(`${API_BASE}/api/v1/variables/${variable.varId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  email: currentValue,
                                  userId: currentUser || 'user1'
                                })
                              });
                              
                              if (response.ok) {
                                console.log('✅ Signature email updated:', currentValue);
                              } else {
                                console.error('❌ Failed to update signature email');
                              }
                            } catch (error) {
                              console.error('❌ Error updating signature email:', error);
                            }
                          }
                        } else {
                          // For value types, save the value
                          if (currentValue !== undefined && currentValue !== variable.value) {
                            await handleValueChange(variable.varId, currentValue);
                          }
                        }
                        
                        // Exit edit mode
                        setEditingNames(prev => {
                          const updated = { ...prev };
                          delete updated[variable.varId];
                          return updated;
                        });
                      }
                    })
                  ])
                ])
              // READ-ONLY MODE - Show display with buttons
              : React.createElement('div', {
                  key: 'read-mode',
                  className: 'd-flex flex-column gap-8'
                }, [
                  // Header with name and buttons
                  React.createElement('div', {
                    key: 'header',
                    className: 'd-flex justify-between items-center'
                  }, [
                    React.createElement('div', {
                      key: 'info',
                      className: 'flex-1 min-w-0'
                    }, [
                      React.createElement('div', {
                        key: 'name',
                        className: 'font-semibold text-lg mb-2',
                        style: {
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }
                      }, variable.displayLabel),
                      variable.type === 'signature' ? React.createElement('div', {
                        key: 'meta',
                        className: 'text-sm text-gray-500'
                      }, `Signature${variable.email ? ' • ' + variable.email : ''}`) : null
                    ]),
                    React.createElement('div', {
                      key: 'buttons',
                      className: 'd-flex gap-8 items-center'
                    }, [
                      React.createElement(UIButton, {
                        key: 'edit',
                        label: 'Edit',
                        variant: 'tertiary',
                        onClick: (e) => {
                          e?.stopPropagation?.();
                          setEditingNames(prev => ({ ...prev, [variable.varId]: variable.displayLabel }));
                          // For signatures, load email; for values, load value
                          const editValue = variable.type === 'signature' ? (variable.email || '') : (variable.value || '');
                          setEditingValues(prev => ({ ...prev, [variable.varId]: editValue }));
                        }
                      }),
                      React.createElement(UIButton, {
                        key: 'delete',
                        label: 'Delete',
                        variant: 'tertiary',
                        onClick: (e) => {
                          e?.stopPropagation?.();
                          handleDelete(variable.varId, variable.displayLabel);
                        }
                      }),
                      React.createElement(UIButton, {
                        key: 'insert',
                        label: 'Insert',
                        variant: 'primary',
                        onClick: async (e) => {
                          e?.stopPropagation?.();
                          
                          // Get fresh data from state to avoid stale closure issues
                          const freshVariable = variables[variable.varId];
                          if (!freshVariable) {
                            console.error('❌ Variable not found in state:', variable.varId);
                            return;
                          }
                          
                          console.log('🔵 Insert variable clicked:', freshVariable.displayLabel);
                          
                          // For signatures, use displayLabel; for values, use value (or label as fallback)
                          const displayText = freshVariable.type === 'signature' 
                            ? freshVariable.displayLabel 
                            : (freshVariable.value || freshVariable.displayLabel);
                          
                          const isWordAddin = typeof Office !== 'undefined' && Office.context && Office.context.host;
                          
                          if (isWordAddin) {
                            try {
                              await Word.run(async (context) => {
                                const range = context.document.getSelection();
                                const contentControl = range.insertContentControl();
                                const colors = getVariableColors();
                                contentControl.title = freshVariable.displayLabel;
                                contentControl.tag = freshVariable.varId;
                                contentControl.appearance = 'BoundingBox';
                                contentControl.color = colors.borderColor;
                                contentControl.insertText(displayText, 'Replace');
                                contentControl.font.highlightColor = colors.highlightColor;
                                contentControl.font.bold = true;
                                
                                await context.sync();
                                
                                contentControl.cannotEdit = true;
                                contentControl.cannotDelete = false;
                                
                                await context.sync();
                                console.log('✅ Variable inserted and LOCKED in Word document:', displayText);
                              });
                            } catch (error) {
                              console.error('❌ Failed to insert into Word document:', error);
                            }
                          } else {
                            if (!window.superdocInstance || !window.superdocInstance.editor) {
                              console.error('❌ SuperDoc not available');
                              return;
                            }
                            
                            const editor = window.superdocInstance.editor;
                            if (!editor.commands || typeof editor.commands.addFieldAnnotationAtSelection !== 'function') {
                              console.error('❌ Field Annotation plugin not loaded');
                              return;
                            }
                            
                            try {
                              const colors = getVariableColors();
                              editor.commands.addFieldAnnotationAtSelection({
                                fieldId: freshVariable.varId,
                                displayLabel: displayText,
                                fieldType: 'TEXTINPUT',
                                fieldColor: colors.borderColor,
                                type: freshVariable.type
                              });
                              console.log('✅ Variable inserted into SuperDoc:', freshVariable.displayLabel);
                            } catch (error) {
                              console.error('❌ Failed to insert into SuperDoc:', error);
                            }
                          }
                        }
                      })
                    ])
                  ]),
                  // Value display (read-only) - show email for signatures, value for value types
                  React.createElement('div', {
                    key: 'value',
                    className: 'text-sm text-gray-600 font-mono',
                    style: {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }
                  }, variable.type === 'signature' ? (variable.email || '') : (variable.value || variable.displayLabel))
                ])
          ])));
        })()
      ]);
    }

    function App(props) {
      const [modal, setModal] = React.useState(null);
      const { config } = props;
      const { documentSource, actions, approvalsSummary, messagingUnreadCount, activities, lastSeenActivityId, viewingVersion } = React.useContext(StateContext);
      React.useEffect(() => {
        function onOpen(ev) { 
          
          try { 
            const d = ev.detail || {}; 
            if (d && (d.id === 'send-vendor' || d.id === 'sendVendor')) setModal({ id: 'send-vendor', userId: d.options?.userId || 'user1' }); 
            if (d && d.id === 'approvals') setModal({ id: 'approvals' }); 
            if (d && d.id === 'compile') setModal({ id: 'compile' }); 
            if (d && d.id === 'notifications') setModal({ id: 'notifications' }); 
            if (d && d.id === 'request-review') setModal({ id: 'request-review' }); 
            if (d && d.id === 'message') setModal({ id: 'message', toUserId: d.options?.toUserId, toUserName: d.options?.toUserName }); 
            if (d && (d.id === 'open-gov' || d.id === 'openGov')) setModal({ id: 'open-gov' }); 
            if (d && d.id === 'system-prompt-editor') setModal({ id: 'system-prompt-editor' }); 
            if (d && d.id === 'factory-reset') setModal({ id: 'factory-reset' }); 
            if (d && d.id === 'version-outdated-checkout') {
              
              setModal({ 
                id: 'version-outdated-checkout', 
                currentVersion: d.options?.currentVersion, 
                clientVersion: d.options?.clientVersion, 
                viewingVersion: d.options?.viewingVersion, 
                message: d.options?.message, 
                userId: d.options?.userId 
              });
            }
          } catch (e) {
            console.error('Error in modal onOpen:', e);
          }
        }
        window.addEventListener('react:open-modal', onOpen);
        return () => window.removeEventListener('react:open-modal', onOpen);
      }, []);
  
      const [confirm, setConfirm] = React.useState(null);
      const ask = (kind) => {
        
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
          case 'version-outdated-checkout':
            return React.createElement(VersionOutdatedCheckoutModal, { currentVersion: modal.currentVersion, clientVersion: modal.clientVersion, viewingVersion: modal.viewingVersion, message: modal.message, userId: modal.userId, onClose });
          case 'system-prompt-editor':
            return React.createElement(SystemPromptEditorModal, { onClose });
          case 'factory-reset':
            return React.createElement(FactoryResetModal, { onClose });
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
        React.createElement(LinkCodeBanner, null),
        React.createElement(ErrorBanner, null),
        React.createElement(InstallAddInModalManager, { key: 'install-modal' }),
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
      
      // Factory reset: navigate back to AI tab
      React.useEffect(() => {
        const onFactoryReset = () => {
          setActiveTab('AI');
        };
        window.addEventListener('factoryReset', onFactoryReset);
        return () => window.removeEventListener('factoryReset', onFactoryReset);
      }, []);
      const verLabelRef = React.useRef(null);
      const actLabelRef = React.useRef(null);
      const cmpLabelRef = React.useRef(null);
      const variablesLabelRef = React.useRef(null);
      const prevTabRef = React.useRef(activeTab);
      
      // Reload document when leaving Comparison tab to remove comparison highlights
      React.useEffect(() => {
        const wasOnComparison = prevTabRef.current === 'Comparison';
        const nowOnComparison = activeTab === 'Comparison';
        
        if (wasOnComparison && !nowOnComparison) {
          // Switching away from Comparison - reload current version
          try {
            const version = viewingVersion || 1;
            window.dispatchEvent(new CustomEvent('version:view', { 
              detail: { version, source: 'tab-switch' } 
            }));
          } catch {}
        }
        
        prevTabRef.current = activeTab;
      }, [activeTab, viewingVersion]);

      const recalcUnderline = React.useCallback(() => {
        try {
          const bar = tabbarRef.current;
          const labelEl = (activeTab === 'AI'
            ? aiLabelRef.current
            : (activeTab === 'Workflow'
              ? wfLabelRef.current
              : (activeTab === 'Messages'
                  ? msgLabelRef.current
                  : (activeTab === 'Versions'
                    ? verLabelRef.current
                    : (activeTab === 'Activity'
                      ? actLabelRef.current
                      : (activeTab === 'Comparison'
                        ? cmpLabelRef.current
                        : variablesLabelRef.current))))));
          if (!bar || !labelEl) return;
          const barRect = bar.getBoundingClientRect();
          const labRect = labelEl.getBoundingClientRect();
          const width = Math.max(24, Math.round(labRect.width));
          const left = Math.round((labRect.left - barRect.left) + (labRect.width / 2) - (width / 2));
          setUnderline({ left, width });
        } catch {}
      }, [activeTab]);

      React.useEffect(() => { recalcUnderline(); }, [recalcUnderline]);
      // Recalculate underline if the Workflow, Messages, or Activity tab label width changes due to count updates
      React.useEffect(() => { recalcUnderline(); }, [approvalsSummary, messagingUnreadCount, activities, lastSeenActivityId, recalcUnderline]);
      React.useEffect(() => {
        const onResize = () => recalcUnderline();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
      }, [recalcUnderline]);

      const Tabs = React.createElement('div', { className: 'mt-3 pt-2', style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } }, [
        React.createElement('div', { key: 'tabbar', ref: tabbarRef, className: 'd-flex gap-8 border-b border-gray-200', style: { position: 'relative', padding: '0 8px', alignItems: 'flex-end' } }, [
          React.createElement('button', {
            key: 'tab-ai',
            className: activeTab === 'AI' ? 'tab tab--active' : 'tab',
            onClick: () => setActiveTab('AI'),
            style: { background: 'transparent', border: 'none', padding: '8px 6px', cursor: 'pointer', color: activeTab === 'AI' ? '#111827' : '#6B7280', fontWeight: 600 }
          }, React.createElement('span', { ref: aiLabelRef, style: { display: 'inline-block' } }, 'AI')),
          React.createElement('button', {
            key: 'tab-workflow',
            className: activeTab === 'Workflow' ? 'tab tab--active' : 'tab',
            onClick: () => setActiveTab('Workflow'),
            style: { background: 'transparent', border: 'none', padding: '8px 6px 8px 6px', cursor: 'pointer', color: activeTab === 'Workflow' ? '#111827' : '#6B7280', fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }
          }, [
            (approvalsSummary && typeof approvalsSummary.total === 'number'
              ? React.createElement('span', { key: 'count', style: { fontSize: '11px', lineHeight: '1' } }, `(${approvalsSummary.approved || 0}/${approvalsSummary.total})`)
              : null),
            React.createElement('span', { key: 'label', ref: wfLabelRef, style: { display: 'inline-block' } }, 'Workflow')
          ]),
          React.createElement('button', {
            key: 'tab-messaging',
            className: activeTab === 'Messages' ? 'tab tab--active' : 'tab',
            onClick: () => setActiveTab('Messages'),
            style: { background: 'transparent', border: 'none', padding: '8px 6px 8px 6px', cursor: 'pointer', color: activeTab === 'Messages' ? '#111827' : '#6B7280', fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }
          }, [
            messagingUnreadCount > 0 ? React.createElement('span', { key: 'count', style: { fontSize: '11px', lineHeight: '1' } }, `(${messagingUnreadCount})`) : null,
            React.createElement('span', { key: 'label', ref: msgLabelRef, style: { display: 'inline-block' } }, 'Messages')
          ]),
          React.createElement('button', {
            key: 'tab-versions',
            className: activeTab === 'Versions' ? 'tab tab--active' : 'tab',
            onClick: () => setActiveTab('Versions'),
            style: { background: 'transparent', border: 'none', padding: '8px 6px', cursor: 'pointer', color: activeTab === 'Versions' ? '#111827' : '#6B7280', fontWeight: 600 }
          }, React.createElement('span', { ref: verLabelRef, style: { display: 'inline-block' } }, 'Versions')),
          React.createElement('button', {
            key: 'tab-activity',
            className: activeTab === 'Activity' ? 'tab tab--active' : 'tab',
            onClick: () => setActiveTab('Activity'),
            style: { background: 'transparent', border: 'none', padding: '8px 6px 8px 6px', cursor: 'pointer', color: activeTab === 'Activity' ? '#111827' : '#6B7280', fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }
          }, [
            (() => {
              if (!activities || !Array.isArray(activities) || activities.length === 0) return null;
              const unseenCount = activities.filter(a => !lastSeenActivityId || a.id > lastSeenActivityId).length;
              if (unseenCount === 0) return null;
              return React.createElement('span', { key: 'count', style: { fontSize: '11px', lineHeight: '1' } }, `(${unseenCount})`);
            })(),
            React.createElement('span', { key: 'label', ref: actLabelRef, style: { display: 'inline-block' } }, 'Activity')
          ]),
          // New Comparison tab
          React.createElement('button', {
            key: 'tab-compare',
            className: activeTab === 'Comparison' ? 'tab tab--active' : 'tab',
            onClick: () => setActiveTab('Comparison'),
            style: { background: 'transparent', border: 'none', padding: '8px 6px', cursor: 'pointer', color: activeTab === 'Comparison' ? '#111827' : '#6B7280', fontWeight: 600 }
          }, React.createElement('span', { ref: cmpLabelRef, style: { display: 'inline-block' } }, 'Compare')),
          // Variables tab (Phase 3)
          React.createElement('button', {
            key: 'tab-variables',
            className: activeTab === 'Variables' ? 'tab tab--active' : 'tab',
            onClick: () => setActiveTab('Variables'),
            style: { background: 'transparent', border: 'none', padding: '8px 6px', cursor: 'pointer', color: activeTab === 'Variables' ? '#111827' : '#6B7280', fontWeight: 600 }
          }, React.createElement('span', { ref: variablesLabelRef, style: { display: 'inline-block' } }, 'Variables')),
        React.createElement('div', { key: 'underline', style: { position: 'absolute', bottom: -1, left: underline.left, width: underline.width, height: 2, background: '#6d5ef1', transition: 'left 150ms ease, width 150ms ease' } })
        ]),
        React.createElement('div', { key: 'tabbody', style: { flex: 1, minHeight: 0, overflowY: (activeTab === 'AI' || activeTab === 'Activity' || activeTab === 'Messages') ? 'hidden' : 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', padding: (activeTab === 'AI' || activeTab === 'Activity' || activeTab === 'Messages') ? '16px 0 0 0' : '16px 8px 112px 8px' } }, [
          React.createElement('div', { key: 'wrap-ai', style: { display: (activeTab === 'AI' ? 'flex' : 'none'), flex: 1, height: '100%', flexDirection: 'column' } }, React.createElement(ChatConsole, { key: 'chat' })),
          React.createElement('div', { key: 'wrap-workflow', style: { display: (activeTab === 'Workflow' ? 'block' : 'none') } }, React.createElement(WorkflowApprovalsPanel, { key: 'workflow' })),
          React.createElement('div', { key: 'wrap-messaging', style: { display: (activeTab === 'Messages' ? 'flex' : 'none'), flexDirection: 'column', height: '100%' } }, React.createElement(MessagingPanel, { key: 'messaging' })),
          React.createElement('div', { key: 'wrap-versions', style: { display: (activeTab === 'Versions' ? 'block' : 'none') } }, React.createElement(VersionsPanel, { key: 'versions' })),
          React.createElement('div', { key: 'wrap-activity', style: { display: (activeTab === 'Activity' ? 'flex' : 'none'), flex: 1, height: '100%', flexDirection: 'column' } }, React.createElement(ActivityPanel, { key: 'activity', isActive: activeTab === 'Activity' })),
          React.createElement('div', { key: 'wrap-compare', style: { display: (activeTab === 'Comparison' ? 'block' : 'none') } }, React.createElement(ComparisonTab, { key: 'compare' })),
          React.createElement('div', { key: 'wrap-variables', style: { display: (activeTab === 'Variables' ? 'block' : 'none') } }, React.createElement(VariablesPanel, { key: 'variables' }))
        ])
      ]);

      // Confine scroll to the sidebar body; header and underline remain fixed
      const assistantPanel = React.createElement('div', { className: 'panel panel--assistant', style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } }, [
        Tabs,
        renderModal(),
        (confirm ? React.createElement(ConfirmModal, { title: confirm.title, message: confirm.message, onConfirm: confirm.onConfirm, onClose: onConfirmClose }) : null)
      ]);

      const container = React.createElement('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } }, [topPanel, assistantPanel]);

      return React.createElement(ThemeProvider, null, React.createElement(React.Fragment, null, [container, React.createElement(FinalizeCelebration, { key: 'finalize' }), React.createElement(ApprovalCelebration, { key: 'celebration' })]));
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



