# Test Inventory

Complete catalog of tests needed for WordFTW hardening.

---

## Installation Tests (37 total)

### Dependency Tests (5 tests)
1. **Node.js availability** - Verify Node.js is installed and meets minimum version
2. **npx availability** - Verify npx is available for Office add-in tools
3. **Office installation** - Verify Office 2016+ is installed
4. **PowerShell availability** - (Windows) Verify PowerShell for cache clearing
5. **Server reachability** - Verify can connect to deployment server

### Download & Validation Tests (4 tests)
6. **Manifest downloads** - Successfully download manifest.xml from server
7. **Valid XML structure** - Downloaded manifest is valid XML
8. **Required fields present** - Manifest contains OfficeApp ID and required fields
9. **Network failure handling** - Gracefully handle download failures with retry

### Registry/Defaults Tests (6 tests)
10. **Write to registry/defaults** - Can register add-in in Office developer registry
11. **Read from registry/defaults** - Can verify registration exists
12. **Delete from registry/defaults** - Can remove registration cleanly
13. **Backup and restore** - Registry/defaults backup created and restorable
14. **Existing installation detection** - Detect if add-in already registered
15. **Permission denied handling** - Handle locked registry gracefully

### Installation Flow Tests (8 tests)
16. **Clean install succeeds** - Fresh installation completes successfully
17. **Registry entry created** - Verify registration exists after install
18. **Manifest file persisted** - Manifest file exists at expected location
19. **Cache cleared** - Office cache cleared during installation
20. **Word process closed** - Word is closed if running during install
21. **Rollback on failure** - Failed installation rolls back changes
22. **Success message shown** - User sees confirmation and next steps
23. **Installation verified** - Post-install verification confirms success

### Reinstall/Repair Tests (4 tests)
24. **Existing installation detected** - Installer detects previous installation
25. **Reinstall over existing** - Clean reinstall removes old and adds new
26. **Repair existing** - Repair mode fixes broken installation
27. **Old registration removed** - Previous registration deleted before new one added

### Uninstall Tests (4 tests)
28. **Registry entry removed** - Uninstaller removes registration
29. **Cache cleared** - Uninstaller clears Office cache
30. **Manifest files removed** - Uninstaller removes downloaded files
31. **Clean uninstall verified** - Post-uninstall verification confirms complete removal

### Cross-Platform Tests (6 tests)
32. **Windows installer flow** - Full install/uninstall on Windows
33. **macOS installer flow** - Full install/uninstall on macOS
34. **Windows manifest validation** - PowerShell XML validation works
35. **macOS manifest validation** - xmllint validation works
36. **Windows cache clearing** - PowerShell cache removal works
37. **macOS cache clearing** - Bash cache removal works

---

## Server Infrastructure Tests (25 total)

### Startup Tests (8 tests)
38. **Node version check** - Server refuses to start with old Node.js
39. **Required modules check** - Server refuses to start with missing dependencies
40. **Data directories check** - Server creates missing directories on startup
41. **Disk space check** - Server warns if low disk space
42. **Environment variables check** - Server validates/defaults environment vars
43. **State file validation** - Server validates state.json on load
44. **Corrupted state recovery** - Server creates backup and uses defaults for corrupt state
45. **Startup checks pass** - All startup checks complete before accepting requests

### Shutdown Tests (3 tests)
46. **Graceful shutdown on SIGTERM** - Server completes active requests before exit
47. **Graceful shutdown on SIGINT** - Server handles Ctrl+C gracefully
48. **Forced shutdown on double signal** - Second signal forces immediate exit

### Health Check Tests (4 tests)
49. **Health check responds** - /api/v1/health endpoint returns status
50. **Memory check works** - Health check reports memory usage
51. **Filesystem check works** - Health check verifies data directory access
52. **Degraded status on errors** - Health check returns 503 when checks fail

### Request Lifecycle Tests (10 tests)
53. **Active request tracking** - Server tracks in-flight requests
54. **Shutdown rejects new requests** - Returns 503 during shutdown
55. **Request timeout enforced** - Long requests timeout after configured limit
56. **Timeout cleanup** - Timed-out requests are properly cleaned up
57. **Error logging includes context** - Errors logged with user ID, path, timestamp
58. **Request metrics collected** - Duration and status code recorded
59. **Memory leak prevention** - No memory growth after request completion
60. **Concurrent request handling** - Multiple simultaneous requests handled correctly
61. **Request abortion handling** - Aborted requests cleaned up properly
62. **Error propagation** - Errors bubble up to error handler middleware

---

## API Endpoint Tests (45 total)

### Input Validation Tests (10 tests)
63. **userId validation** - Reject invalid userId format
64. **platform validation** - Only accept 'web' or 'word' for platform
65. **Required fields validation** - Reject requests missing required fields
66. **Type validation** - Reject wrong data types
67. **String length validation** - Reject strings exceeding max length
68. **Boolean validation** - Reject invalid boolean values
69. **Enum validation** - Reject values not in allowed list
70. **Input sanitization** - Strip unknown fields from validated input
71. **Detailed error messages** - Validation errors include field and type
72. **Multiple validation errors** - Return all validation errors, not just first

### Error Handling Tests (15 tests)
73. **Checkout conflict error** - Return 409 with resolution when document checked out
74. **Version not found error** - Return 404 when version doesn't exist
75. **Invalid session error** - Return 401 when session expired
76. **Disk full error** - Return 507 when out of disk space
77. **File too large error** - Return 413 when upload exceeds limit
78. **Permission denied error** - Return 403 when user lacks permission
79. **Rate limit error** - Return 429 when rate limit exceeded
80. **Timeout error** - Return 408 when request times out
81. **All errors have codes** - Every error includes error code
82. **All errors have messages** - Every error includes human-readable message
83. **All errors have resolutions** - Every error includes resolution steps
84. **Development mode stack traces** - Stack traces included in dev mode
85. **Production mode sanitization** - Sensitive data hidden in production
86. **Error logging** - All errors logged with context
87. **Generic error fallback** - Unknown errors return generic 500 response

### Rate Limiting Tests (5 tests)
88. **General API rate limit** - 100 requests per 15 minutes enforced
89. **Write operation rate limit** - 10 write requests per minute enforced
90. **Rate limit headers** - Rate limit info in response headers
91. **Rate limit reset** - Rate limit counter resets after window
92. **Retry-After header** - 429 responses include retry-after time

### Timeout Tests (3 tests)
93. **Default timeout enforced** - Requests timeout after 30 seconds
94. **Long operation timeout** - Document compilation gets 120 second timeout
95. **Timeout response** - Timed-out requests return 408 with helpful message

### Retry Logic Tests (5 tests)
96. **Retry on 5xx errors** - Automatic retry on server errors
97. **No retry on 4xx errors** - Client errors not retried
98. **Exponential backoff** - Retry delays increase exponentially
99. **Max retries enforced** - Give up after configured max retries
100. **Retry context logged** - Retry attempts logged with context

### Circuit Breaker Tests (7 tests)
101. **Circuit opens on failures** - Circuit opens after threshold failures
102. **Circuit rejects requests when open** - Open circuit returns 503
103. **Circuit half-opens after timeout** - Circuit tries request after timeout
104. **Circuit closes on success** - Circuit closes after successful requests in half-open
105. **Circuit stays open on failure** - Circuit reopens if half-open request fails
106. **Multiple circuits independent** - Different services have separate circuits
107. **Circuit state logged** - Circuit state changes logged

---

## State Management Tests (15 total)

### Validation Tests (5 tests)
108. **Required fields validation** - State must have revision, documentVersion, lastUpdated
109. **Type validation** - revision and documentVersion must be positive numbers
110. **Checkout state validation** - checkedOutBy must be null or string
111. **Status validation** - status must be draft/review/approved/signed
112. **Complete validation** - validateServerState catches all errors

### Corruption Detection Tests (4 tests)
113. **Corrupted state detected** - Invalid state.json detected on load
114. **Backup created** - Corrupted state backed up before recovery
115. **Defaults loaded** - Server uses default state when corruption detected
116. **Corrupted backup named** - Backup includes timestamp in filename

### Atomic Update Tests (6 tests)
117. **Transaction creates snapshot** - Original state preserved before update
118. **Transaction validates before commit** - Invalid updates rejected
119. **Transaction commits on success** - Valid updates applied to state
120. **Transaction rolls back on failure** - Failed updates revert to original state
121. **Transaction persists after commit** - State written to disk after commit
122. **Concurrent updates handled** - Multiple simultaneous updates work correctly

---

## File Operations Tests (20 total)

### File Size Tests (4 tests)
123. **File size limit enforced** - Reject uploads over 10MB
124. **Size limit error message** - Clear error for oversized files
125. **Multiple file types allowed** - Accept .docx, .doc, .pdf
126. **Invalid file type rejected** - Reject non-document files

### Disk Space Tests (3 tests)
127. **Disk space checked before write** - Check available space before operations
128. **Disk full error** - Return 507 when insufficient space
129. **Disk check failure handled** - Gracefully handle disk check errors

### Atomic Operations Tests (5 tests)
130. **Temp file created** - Write to .tmp file first
131. **Write verification** - Verify written content matches input
132. **Atomic rename** - Temp file renamed to final path
133. **Cleanup on failure** - Temp files removed on write failure
134. **No partial writes** - Failed writes don't leave partial files

### Cleanup Tests (8 tests)
135. **Orphaned files detected** - Find .tmp files and temp directory files
136. **Old files removed** - Files older than 24 hours deleted
137. **Recent files preserved** - Files younger than 24 hours kept
138. **Cleanup scheduled** - Cleanup runs every hour
139. **Cleanup on startup** - Initial cleanup 10 seconds after startup
140. **Multiple patterns cleaned** - All temp file patterns cleaned
141. **Cleanup errors handled** - Cleanup continues if one pattern fails
142. **Cleanup logged** - Cleanup results logged with count

---

## Session Management Tests (12 total)

### Timeout Tests (4 tests)
143. **Session activity tracked** - Last activity timestamp updated on requests
144. **Expired session rejected** - Return 440 after 4 hours inactivity
145. **Active session allowed** - Recent activity keeps session alive
146. **Timeout error message** - Clear message with resolution on timeout

### Cleanup Tests (8 tests)
147. **Abandoned sessions detected** - Find sessions with no recent activity
148. **Old session directories removed** - Delete session dirs older than 8 hours
149. **Active sessions preserved** - Don't delete sessions with recent activity
150. **Cleanup scheduled** - Session cleanup runs every 30 minutes
151. **Cleanup on startup** - Initial cleanup 1 minute after startup
152. **Double-timeout safety** - Only delete if dir age also exceeds double timeout
153. **Cleanup errors handled** - Continue cleanup if one session fails
154. **Cleanup logged** - Cleanup results logged with count

---

## Network Operations Tests (12 total)

### Retry Tests (6 tests)
155. **Network error retried** - Transient network errors trigger retry
156. **Exponential backoff works** - Delays: 1s, 2s, 4s (capped at 10s)
157. **Max retries enforced** - Give up after 3 retries
158. **Retry callback invoked** - onRetry callback called on each retry
159. **Successful retry returns** - Return result if retry succeeds
160. **Failed retry throws** - Throw error after all retries exhausted

### Circuit Breaker Tests (6 tests)
161. **External service circuit** - LLM provider has circuit breaker
162. **Failure threshold enforced** - Circuit opens after 5 failures
163. **Timeout period works** - Circuit reopens after 60 seconds
164. **Success threshold in half-open** - Require 2 successes to close
165. **Circuit logs state changes** - Log when circuit opens/closes
166. **Multiple services isolated** - Each service has independent circuit

---

## Client-Side Tests (18 total)

### Error Boundary Tests (5 tests)
167. **Error caught** - Error boundary catches component errors
168. **Error UI shown** - User sees error message and actions
169. **Reload button works** - User can reload page from error screen
170. **Continue button works** - User can attempt to continue from error
171. **Error logged to server** - Client errors sent to /api/v1/client-error

### API Call Tests (8 tests)
172. **Timeout enforced** - Client requests timeout after 30 seconds
173. **Retry on failure** - Failed requests retried 3 times
174. **No retry on 4xx** - Client errors not retried
175. **Exponential backoff** - Retry delays increase
176. **Abort on timeout** - Request aborted when timeout reached
177. **Error parsing** - Parse error JSON from response
178. **Fallback error message** - Generic error if parsing fails
179. **Request abortion cleanup** - Aborted requests cleaned up

### Offline Handling Tests (5 tests)
180. **Online detection** - Detect when connection restored
181. **Offline detection** - Detect when connection lost
182. **Periodic health check** - Check server health every 30 seconds
183. **Browser events listened** - Listen to online/offline events
184. **User notified** - Show toast when connection status changes

---

## Integration Tests (30 total)

### End-to-End Flows (15 tests)
185. **Full check-in flow** - User checks in, updates document, checks out
186. **Version save flow** - User saves progress, version created, metadata correct
187. **Version share flow** - Editor shares version, vendor sees it
188. **Approval flow** - Approver approves, state updates, all clients notified
189. **Factory reset flow** - Reset clears data, initializes defaults
190. **User switch flow** - Switch user, permissions update, UI reflects
191. **Session creation flow** - New session created with seed data
192. **Multi-user scenario** - Multiple users interact without conflicts
193. **Checkout conflict scenario** - Second user blocked if document checked out
194. **Version access control** - Vendor can't access non-shared versions
195. **Concurrent edit prevention** - Only one user can edit at a time
196. **Real-time sync** - SSE updates all clients immediately
197. **Platform switching** - Switch between web and Word, state syncs
198. **Document compilation** - Compile document with all content
199. **Exhibit management** - Upload, view, delete exhibits

### Error Recovery Tests (8 tests)
200. **Network interruption recovery** - Recover from temporary network loss
201. **Server restart recovery** - Clients reconnect after server restart
202. **Corrupted state recovery** - Server recovers from bad state file
203. **Failed operation rollback** - Failed multi-step operations roll back
204. **Session timeout recovery** - User can recover from session timeout
205. **Checkout unlock recovery** - Admin can force checkout unlock
206. **Version restore** - Restore to previous version after bad save
207. **Cache clear recovery** - Users can manually clear cache

### Performance Tests (7 tests)
208. **Load test** - Handle 100 concurrent users
209. **Sustained load** - Run 1 hour at 10 req/sec without degradation
210. **Memory leak test** - No memory growth over 1000 requests
211. **Large file handling** - Handle 10MB documents efficiently
212. **Many versions handling** - Handle 100+ versions without slowdown
213. **SSE scalability** - Broadcast to 100 connected clients efficiently
214. **Database-less performance** - File-based storage performs adequately

---

## Chaos Testing (10 tests)

### Failure Injection (10 tests)
215. **Random network timeouts** - 10% requests timeout randomly
216. **Random connection drops** - 5% connections close abruptly
217. **Random disk full errors** - Inject disk full errors randomly
218. **Random state corruption** - Corrupt state file during operations
219. **Random process kills** - Kill and restart server during operations
220. **Concurrent user chaos** - 10 users performing random operations
221. **Memory pressure** - Test under low memory conditions
222. **CPU pressure** - Test under high CPU load
223. **Network latency** - Add random delays to network calls
224. **Cascading failures** - Test when multiple systems fail simultaneously

---

## Summary

**Total Tests: 225**

- Installation: 37 tests
- Server Infrastructure: 25 tests
- API Endpoints: 45 tests
- State Management: 15 tests
- File Operations: 20 tests
- Session Management: 12 tests
- Network Operations: 12 tests
- Client-Side: 18 tests
- Integration: 30 tests
- Chaos: 10 tests

**Estimated Time to Implement:**
- Installation tests: 3 days
- Server & API tests: 4 days
- State & file tests: 2 days
- Session & network tests: 2 days
- Client-side tests: 2 days
- Integration tests: 3 days
- Chaos tests: 2 days
- **Total: ~18 days (3.5 weeks)**

