/* Server: HTTPS-ready Express app serving unified origin for web, add-in, API, and static assets */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const compression = require('compression');
const multer = require('multer');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Import LLM module
const { generateReply } = require('./lib/llm');

// LLM Configuration - Support for Ollama (local) and OpenAI (remote)
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama'; // 'ollama' or 'openai'
const LLM_USE_OPENAI = String(process.env.LLM_USE_OPENAI || '').toLowerCase() === 'true';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b'; // Better reasoning, still fast

// Default System Prompt - Single source of truth
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. Answer questions based on the provided document context.

Rules:
- Give clear, accurate answers
- If the answer isn't in the document, say "I don't see that information in the document"
- Be concise but complete
- Show your reasoning when helpful

Document context:

{DOCUMENT_CONTEXT}`;

// Dynamic document context loading
let DOCUMENT_CONTEXT = '';
let DOCUMENT_LAST_MODIFIED = null;

// Function to load document context from file
async function loadDocumentContext() {
  try {
    const fs = require('fs');
    const path = require('path');
    const mammoth = require('mammoth');

    // Try working directory first (more recent), then app directory
    const workingDocPath = path.join(__dirname, '..', '..', 'data', 'working', 'documents', 'default.docx');
    const appDocPath = path.join(__dirname, '..', '..', 'data', 'app', 'documents', 'default.docx');

    let docPath = workingDocPath;
    if (!fs.existsSync(workingDocPath) && fs.existsSync(appDocPath)) {
      docPath = appDocPath;
    }

    if (fs.existsSync(docPath)) {
      const stats = fs.statSync(docPath);
      const currentModified = stats.mtime.getTime();

      // Only reload if file has been modified
      if (DOCUMENT_LAST_MODIFIED !== currentModified) {
        console.log(`📄 Loading document from: ${docPath}`);

        // Extract full text from DOCX using mammoth
        const result = await mammoth.extractRawText({ path: docPath });
        let fullText = result.value.trim();

        if (!fullText || fullText.length === 0) {
          console.warn('⚠️ Document appears to be empty');
          DOCUMENT_CONTEXT = 'Document is empty or could not be read.';
        } else {
          // Truncate very large documents to prevent overwhelming the LLM
          const MAX_CONTEXT_LENGTH = 10000; // ~2500 tokens for a 3B model
          
          if (fullText.length > MAX_CONTEXT_LENGTH) {
            const truncated = fullText.substring(0, MAX_CONTEXT_LENGTH);
            DOCUMENT_CONTEXT = truncated + '\n\n[... document truncated for context window ...]';
            console.warn(`⚠️ Document truncated from ${fullText.length} to ${MAX_CONTEXT_LENGTH} characters`);
          } else {
            DOCUMENT_CONTEXT = fullText;
          }
        }

        DOCUMENT_LAST_MODIFIED = currentModified;
        console.log(`📄 Document context loaded (${DOCUMENT_CONTEXT.length} characters, ${Math.round(DOCUMENT_CONTEXT.length/4)} tokens approx)`);
      }
    } else {
      console.warn('⚠️ No document found at:', workingDocPath, 'or', appDocPath);
      DOCUMENT_CONTEXT = 'No document found. Please upload or create a document to analyze.';
    }
  } catch (error) {
    console.error('❌ Error loading document context:', error.message);
    DOCUMENT_CONTEXT = 'Document loading error. Please check the document file.';
  }
}

// Load document context on startup (preloaded)
(async () => {
  await loadDocumentContext();
  console.log('✅ Document context ready for LLM');
})();

// Function to get current system prompt (document preloaded on startup)
async function getSystemPrompt() {
  // Check for document updates (handles refresh button and file changes)
  await loadDocumentContext();

  const customPromptPath = path.join(dataAppDir, 'config', 'system-prompt.txt');
  let basePrompt = '';
  
  if (fs.existsSync(customPromptPath)) {
    try {
      basePrompt = fs.readFileSync(customPromptPath, 'utf8');
    } catch {
      basePrompt = '';
    }
  }
  
  if (!basePrompt) {
    basePrompt = process.env.LLM_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;
  }
  
  // Replace placeholder with actual document context
  return basePrompt.replace(/{DOCUMENT_CONTEXT}/g, DOCUMENT_CONTEXT);
}

// Configuration
const APP_PORT = Number(process.env.PORT || 4001);
const SUPERDOC_BASE_URL = process.env.SUPERDOC_BASE_URL || 'http://localhost:4002';
const ADDIN_DEV_ORIGIN = process.env.ADDIN_DEV_ORIGIN || 'https://localhost:4000';
const SSE_RETRY_MS = (() => {
  const v = Number(process.env.SSE_RETRY_MS || 3000);
  return Number.isFinite(v) && v > 0 ? v : 3000;
})();

// Paths
const rootDir = path.resolve(__dirname, '..', '..');
const publicDir = path.join(rootDir, 'server', 'public');
const sharedUiDir = path.join(rootDir, 'shared-ui');
const webDir = path.join(rootDir, 'web');
const dataAppDir = path.join(rootDir, 'data', 'app');
const dataUsersDir = path.join(dataAppDir, 'users');

// Notification types for consistent formatting across clients
// NOTE: Legacy notification system removed - replaced with activity system
// const NOTIFICATION_TYPES = { ... };
// function formatServerNotification(message, type = 'info') { ... };

// Helper to get current document context for activity logging
function getDocumentContext() {
  try {
    return {
      title: (serverState && serverState.title) || 'Untitled Document',
      status: (serverState && serverState.status) || 'draft',
      version: (serverState && serverState.documentVersion) || 1
    };
  } catch (e) {
    // Fallback if serverState isn't initialized
    return {
      title: 'Untitled Document',
      status: 'draft',
      version: 1
    };
  }
}

function logActivity(type, userId, details = {}) {
  // Skip activity logging during test mode
  if (testMode) return null;
  
  try {
    const resolvedLabel = resolveUserLabel(userId);
    const platform = (details && details.platform) ? String(details.platform) : 'web';
    // Enrich details with user context so message formatting has access
    const detailsWithUser = { ...details, userId, user: { id: userId, label: resolvedLabel, platform } };
    // Build the activity object
    const activity = {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      user: {
        id: userId,
        label: resolvedLabel,
        platform
      },
      ...buildActivityMessage(type, detailsWithUser)
    };

    // Load existing activities
    let activities = [];
    if (fs.existsSync(activityLogFilePath)) {
      try {
        const content = fs.readFileSync(activityLogFilePath, 'utf8');
        // Handle potential BOM
        const cleanContent = content.replace(/^\uFEFF/, '');
        activities = JSON.parse(cleanContent);
        if (!Array.isArray(activities)) activities = [];
      } catch (e) {
        console.error('Error reading activity log for append, reinitializing:', e);
        // Reinitialize corrupted file
        fs.writeFileSync(activityLogFilePath, '[]', 'utf8');
        activities = [];
      }
    }

    // Add new activity and save
    activities.push(activity);
    fs.writeFileSync(activityLogFilePath, JSON.stringify(activities, null, 2));

    // Broadcast to all connected clients
    broadcast({ type: 'activity:new', activity });

    return activity;
  } catch (e) {
    console.error('Error logging activity:', e);
    return null;
  }
}

// Messages storage functions (conversation messaging with ACP/internal flags)
function readMessages() {
  try {
    if (fs.existsSync(messagesFilePath)) {
      const content = fs.readFileSync(messagesFilePath, 'utf8');
      const cleanContent = content.replace(/^\uFEFF/, '');
      const data = JSON.parse(cleanContent);
      return {
        messages: Array.isArray(data.messages) ? data.messages : [],
        posts: Array.isArray(data.posts) ? data.posts : []
      };
    }
    return { messages: [], posts: [] };
  } catch (e) {
    console.error('Error reading messages:', e);
    return { messages: [], posts: [] };
  }
}

function writeMessages(data) {
  try {
    fs.writeFileSync(messagesFilePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error writing messages:', e);
    return false;
  }
}

function createMessage({ title, createdBy, participants, internal, external, privileged, text }) {
  const data = readMessages();
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  
  const message = {
    messageId,
    title: title || 'Untitled message',
    createdBy,
    createdAt: now,
    participants: participants || [],
    internal: !!internal,
    external: !!external,
    privileged: !!privileged,
    state: 'open',
    lastPostAt: now,
    unreadBy: participants.map(p => p.userId).filter(id => id !== createdBy.userId),
    archivedBy: [],
    deletedBy: [],
    deletedAt: null
  };
  
  data.messages.push(message);
  
  // Add first post if text provided
  if (text && text.trim()) {
    const post = {
      postId: `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      messageId,
      author: createdBy,
      createdAt: now,
      text: text.trim(),
      privileged: !!privileged
    };
    data.posts.push(post);
  }
  
  writeMessages(data);
  return { message, data };
}

function addPostToMessage(messageId, author, text, privileged = false) {
  const data = readMessages();
  const message = data.messages.find(m => m.messageId === messageId);
  
  if (!message) {
    return { error: 'Message not found' };
  }
  
  const now = Date.now();
  const post = {
    postId: `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    messageId,
    author,
    createdAt: now,
    text: text.trim(),
    privileged: !!privileged
  };
  
  data.posts.push(post);
  
  // Update message lastPostAt and mark unread for all except author
  message.lastPostAt = now;
  message.unreadBy = message.participants
    .map(p => p.userId)
    .filter(id => id !== author.userId);
  
  writeMessages(data);
  return { post, message, data };
}

function archiveMessageForUser(messageId, userId) {
  const data = readMessages();
  const message = data.messages.find(m => m.messageId === messageId);
  
  if (!message) {
    return { error: 'Message not found' };
  }
  
  // Initialize archivedBy array if it doesn't exist
  if (!message.archivedBy) {
    message.archivedBy = [];
  }
  
  // Add userId to archivedBy if not already there
  if (!message.archivedBy.includes(userId)) {
    message.archivedBy.push(userId);
  }
  
  writeMessages(data);
  return { message, data };
}

function unarchiveMessageForUser(messageId, userId) {
  const data = readMessages();
  const message = data.messages.find(m => m.messageId === messageId);
  
  if (!message) {
    return { error: 'Message not found' };
  }
  
  // Initialize archivedBy array if it doesn't exist
  if (!message.archivedBy) {
    message.archivedBy = [];
  }
  
  // Remove userId from archivedBy
  message.archivedBy = message.archivedBy.filter(id => id !== userId);
  
  writeMessages(data);
  return { message, data };
}

function updateMessageFlags(messageId, { internal, external, privileged }) {
  const data = readMessages();
  const message = data.messages.find(m => m.messageId === messageId);
  
  if (!message) {
    return { error: 'Message not found' };
  }
  
  if (typeof internal === 'boolean') message.internal = internal;
  if (typeof external === 'boolean') message.external = external;
  if (typeof privileged === 'boolean') message.privileged = privileged;
  
  writeMessages(data);
  return { message, data };
}

function markMessageRead(messageId, userId) {
  const data = readMessages();
  const message = data.messages.find(m => m.messageId === messageId);
  
  if (!message) {
    return { error: 'Message not found' };
  }
  
  message.unreadBy = (message.unreadBy || []).filter(id => id !== userId);
  
  writeMessages(data);
  return { message, data };
}

function markMessageUnread(messageId, userId) {
  const data = readMessages();
  const message = data.messages.find(m => m.messageId === messageId);
  
  if (!message) {
    return { error: 'Message not found' };
  }
  
  if (!message.unreadBy) message.unreadBy = [];
  if (!message.unreadBy.includes(userId)) {
    message.unreadBy.push(userId);
  }
  
  writeMessages(data);
  return { message, data };
}

function deleteMessageForUser(messageId, userId) {
  const data = readMessages();
  const message = data.messages.find(m => m.messageId === messageId);
  
  if (!message) {
    return { error: 'Message not found' };
  }
  
  // Initialize deletedBy array if it doesn't exist
  if (!message.deletedBy) {
    message.deletedBy = [];
  }
  
  // Add userId to deletedBy if not already there
  if (!message.deletedBy.includes(userId)) {
    message.deletedBy.push(userId);
  }
  
  writeMessages(data);
  return { message, data };
}

function getDiscussionSummary(userId) {
  const data = readMessages();
  // Only count messages where user is a participant and hasn't deleted it
  const messages = data.messages.filter(m => {
    const deletedBy = m.deletedBy || [];
    return !m.deletedAt && 
           !deletedBy.includes(userId) &&
           (m.participants.some(p => p.userId === userId) || m.createdBy.userId === userId);
  });
  
  // Open = not archived by this user
  const open = messages.filter(m => {
    const archivedBy = m.archivedBy || [];
    return !archivedBy.includes(userId);
  }).length;
  
  // Archived = archived by this user
  const archived = messages.filter(m => {
    const archivedBy = m.archivedBy || [];
    return archivedBy.includes(userId);
  }).length;
  
  const privileged = messages.filter(m => m.privileged).length;
  const internal = messages.filter(m => m.internal).length;
  const external = messages.filter(m => m.external).length;
  // Count CONVERSATIONS with unread posts, not individual posts
  // This is the number of messages that have the user in their unreadBy array
  const unreadForMe = messages.filter(m => 
    m.unreadBy && m.unreadBy.includes(userId)
  ).length;
  
  return {
    messages: {
      open,
      archived,
      privileged,
      internal,
      external,
      unreadForMe
    }
  };
}

// Chat storage functions (per-user AI chat history)
function readChat() {
  try {
    if (fs.existsSync(chatFilePath)) {
      const content = fs.readFileSync(chatFilePath, 'utf8');
      const cleanContent = content.replace(/^\uFEFF/, '');
      const data = JSON.parse(cleanContent);
      return data || {};
    }
    return {};
  } catch (e) {
    console.error('Error reading chat:', e);
    return {};
  }
}

function saveChatMessage(userId, message) {
  try {
    const allChats = readChat();
    if (!allChats[userId]) allChats[userId] = [];
    allChats[userId].push(message);
    fs.writeFileSync(chatFilePath, JSON.stringify(allChats, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving chat message:', e);
    return false;
  }
}

function resetUserChat(userId) {
  try {
    const allChats = readChat();
    delete allChats[userId];
    fs.writeFileSync(chatFilePath, JSON.stringify(allChats, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error resetting chat:', e);
    return false;
  }
}

// Fields storage functions (document field/variable definitions)
function readVariables() {
  try {
    if (fs.existsSync(variablesFilePath)) {
      const content = fs.readFileSync(variablesFilePath, 'utf8');
      const cleanContent = content.replace(/^\uFEFF/, '');
      const data = JSON.parse(cleanContent);
      return data || {};
    }
    return {};
  } catch (e) {
    console.error('Error reading variables:', e);
    return {};
  }
}

function saveVariable(variable) {
  try {
    const variables = readVariables();
    variables[variable.varId] = variable;
    fs.writeFileSync(variablesFilePath, JSON.stringify(variables, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving variable:', e);
    return false;
  }
}

function updateVariable(varId, updates) {
  try {
    const variables = readVariables();
    if (!variables[varId]) {
      return false;
    }
    variables[varId] = { ...variables[varId], ...updates, updatedAt: new Date().toISOString() };
    fs.writeFileSync(variablesFilePath, JSON.stringify(variables, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error updating variable:', e);
    return false;
  }
}

function deleteVariable(varId) {
  try {
    const variables = readVariables();
    if (!variables[varId]) {
      return false;
    }
    delete variables[varId];
    fs.writeFileSync(variablesFilePath, JSON.stringify(variables, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error deleting variable:', e);
    return false;
  }
}

function buildActivityMessage(type, details = {}) {
  const userLabel = details.userLabel || details.user?.label || details.userId || 'Unknown User';

  switch (type) {
    case 'workflow:approve':
      return {
        action: 'approved',
        target: 'workflow',
        details: { targetUserId: details.targetUserId, notes: details.notes, progress: details.progress },
        message: (function(){
          if (!details.targetUserId) return `${userLabel} approved`;
          const target = resolveUserLabel(details.targetUserId);
          const progress = details.progress ? ` (${details.progress.approved}/${details.progress.total})` : '';
          
          // Check if actor is approving on behalf of someone else
          if (details.actorUserId && details.actorUserId !== details.targetUserId) {
            return `${userLabel} approved on behalf of ${target}${progress}`;
          }
          
          return `${userLabel} approved${progress}`;
        })()
      };

    case 'workflow:remove-approval':
      return {
        action: 'removed approval',
        target: 'workflow',
        details: { targetUserId: details.targetUserId, notes: details.notes, progress: details.progress },
        message: (function(){
          if (!details.targetUserId) return `${userLabel} removed approval`;
          const target = resolveUserLabel(details.targetUserId);
          const progress = details.progress ? ` (${details.progress.approved}/${details.progress.total})` : '';
          
          // Check if actor is removing approval on behalf of someone else
          if (details.actorUserId && details.actorUserId !== details.targetUserId) {
            return `${userLabel} removed approval on behalf of ${target}${progress}`;
          }
          
          return `${userLabel} removed approval${progress}`;
        })()
      };

    case 'workflow:reject':
      return {
        action: 'rejected',
        target: 'workflow',
        details: { targetUserId: details.targetUserId, notes: details.notes },
        message: (function(){
          if (!details.targetUserId) return `${userLabel} rejected`;
          const target = resolveUserLabel(details.targetUserId);
          return `${userLabel} rejected (${target})`;
        })()
      };

    case 'workflow:reset':
      return {
        action: 'reset approvals',
        target: 'workflow',
        details: {},
        message: `${userLabel} reset approvals`
      };

    case 'workflow:request-review':
      return {
        action: 'requested review',
        target: 'workflow',
        details: {},
        message: `${userLabel} requested review from approvers`
      };

    case 'workflow:complete':
      return {
        action: 'completed approvals',
        target: 'workflow',
        details: { total: details.total, approved: details.approved },
        message: `All approvals completed`
      };

    case 'message:send':
      return {
        action: 'sent message',
        target: 'message',
        details: { to: details.to, channel: details.channel },
        message: (function(){
          const to = Array.isArray(details.to) ? details.to : (details.to ? [details.to] : []);
          const labels = to.map((id) => resolveUserLabel(id)).filter(Boolean);
          if (labels.length === 0) return `${userLabel} sent a message`;
          if (labels.length === 1) return `${userLabel} sent a message to ${labels[0]}`;
          if (labels.length === 2) return `${userLabel} sent a message to ${labels[0]} and ${labels[1]}`;
          return `${userLabel} sent a message to ${labels[0]}, ${labels[1]} +${labels.length - 2} more`;
        })()
      };
    case 'document:save':
      return {
        action: 'saved progress',
        target: 'document',
        details: { 
          autoSave: details.autoSave || false, 
          version: details.version,
          documentTitle: details.documentTitle,
          fileSize: details.fileSize,
          wordCount: details.wordCount
        },
        message: `${userLabel} saved "${details.documentTitle || 'document'}"${details.version ? ` (v${details.version})` : ''}${details.autoSave ? ' (auto-save)' : ''}`
      };

    case 'document:checkin':
      return {
        action: 'checked in',
        target: 'document',
        details: { 
          documentTitle: details.documentTitle,
          version: details.version, 
          size: details.size,
          checkoutDuration: details.checkoutDuration
        },
        message: `${userLabel} checked in "${details.documentTitle || 'document'}"${details.version ? ` (v${details.version})` : ''}${details.checkoutDuration ? ` after ${details.checkoutDuration}` : ''}`
      };

    case 'document:checkout':
      return {
        action: 'checked out',
        target: 'document',
        details: { 
          documentTitle: details.documentTitle,
          version: details.version,
          status: details.status
        },
        message: `${userLabel} checked out "${details.documentTitle || 'document'}"${details.version ? ` (v${details.version})` : ''}`
      };

    case 'document:checkout:cancel':
      return {
        action: 'cancelled checkout',
        target: 'document',
        details: { 
          documentTitle: details.documentTitle,
          version: details.version
        },
        message: `${userLabel} cancelled checkout of "${details.documentTitle || 'document'}"`
      };

    case 'document:checkout:override':
      return {
        action: 'overrode checkout',
        target: 'document',
        details: { 
          previousUserId: details.previousUserId,
          documentTitle: details.documentTitle,
          version: details.version
        },
        message: (function(){
          const prev = details.previousUserId ? resolveUserLabel(details.previousUserId) : '';
          const doc = details.documentTitle ? ` of "${details.documentTitle}"` : '';
          return prev ? `${userLabel} overrode ${prev}'s checkout${doc}` : `${userLabel} overrode an existing checkout${doc}`;
        })()
      };

    case 'document:status-change':
      return {
        action: 'changed status',
        target: 'document',
        details: { 
          from: details.from, 
          to: details.to,
          documentTitle: details.documentTitle,
          version: details.version
        },
        message: `${userLabel} changed "${details.documentTitle || 'document'}" status from ${details.from} to ${details.to}`
      };

    case 'version:view':
      return {
        action: 'viewed version',
        target: 'version',
        details: { 
          version: details.version, 
          platform: details.platform,
          documentTitle: details.documentTitle,
          currentVersion: details.currentVersion
        },
        message: `${userLabel} viewed ${details.documentTitle ? `"${details.documentTitle}"` : 'document'} v${details.version}${details.currentVersion ? ` (current: v${details.currentVersion})` : ''}`
      };

    case 'version:restore':
      return {
        action: 'restored version',
        target: 'version',
        details: { 
          version: details.version, 
          platform: details.platform,
          documentTitle: details.documentTitle,
          previousVersion: details.previousVersion
        },
        message: `${userLabel} restored "${details.documentTitle || 'document'}" to v${details.version || '—'}${details.previousVersion ? ` (from v${details.previousVersion})` : ''}`
      };

    case 'system:error':
      return {
        action: 'encountered error',
        target: 'system',
        details,
        message: `System error: ${details.error || 'Unknown error'}`
      };

    case 'variable:created':
      return {
        action: 'created variable',
        target: 'variable',
        details: { varId: details.varId, displayLabel: details.displayLabel },
        message: `${userLabel} created variable "${details.displayLabel}"`
      };

    case 'variable:updated':
      return {
        action: 'updated variable',
        target: 'variable',
        details: { varId: details.varId, displayLabel: details.displayLabel, changes: details.changes },
        message: `${userLabel} updated variable "${details.displayLabel}"`
      };

    case 'variable:valueChanged':
      return {
        action: 'changed variable value',
        target: 'variable',
        details: { 
          varId: details.varId, 
          displayLabel: details.displayLabel, 
          value: details.newValue,
          oldValue: details.oldValue,
          newValue: details.newValue,
          type: details.type,
          category: details.category,
          platform: details.platform
        },
        message: `${userLabel} changed "${details.displayLabel}"${details.oldValue ? ` from "${details.oldValue}"` : ''} to "${details.newValue || details.value}"`
      };

    case 'variable:deleted':
      return {
        action: 'deleted variable',
        target: 'variable',
        details: { varId: details.varId, displayLabel: details.displayLabel },
        message: `${userLabel} deleted variable "${details.displayLabel}"`
      };

    case 'system:prompt-update':
      return {
        action: 'updated system prompt',
        target: 'system',
        details: { promptLength: details.promptLength },
        message: `${userLabel} updated the AI system prompt`
      };

    case 'system:prompt-reset':
      return {
        action: 'reset system prompt',
        target: 'system',
        details: {},
        message: `${userLabel} reset the AI system prompt to default`
      };

    case 'document:upload':
      return {
        action: 'uploaded document',
        target: 'document',
        details: { 
          filename: details.filename, 
          size: details.size,
          previousFilename: details.previousFilename,
          documentTitle: details.documentTitle
        },
        message: `${userLabel} uploaded "${details.filename}"${details.previousFilename ? ` (replaced "${details.previousFilename}")` : ''}`
      };

    case 'document:snapshot':
      return {
        action: 'created snapshot',
        target: 'document',
        details: { 
          version: details.version,
          documentTitle: details.documentTitle,
          status: details.status
        },
        message: `${userLabel} created snapshot of "${details.documentTitle || 'document'}"${details.version ? ` (v${details.version})` : ''}`
      };

    case 'document:compile':
      return {
        action: 'compiled document',
        target: 'document',
        details: { 
          format: details.format, 
          includeExhibits: details.includeExhibits,
          documentTitle: details.documentTitle,
          version: details.version,
          exhibitCount: details.exhibitCount,
          outputSize: details.outputSize
        },
        message: `${userLabel} compiled "${details.documentTitle || 'document'}" to ${details.format || 'PDF'}${details.includeExhibits ? ` with ${details.exhibitCount || ''} exhibits` : ''}${details.version ? ` (v${details.version})` : ''}`
      };

    case 'document:send-vendor':
      return {
        action: 'sent to vendor',
        target: 'document',
        details: { 
          vendor: details.vendor, 
          email: details.email,
          documentTitle: details.documentTitle,
          version: details.version
        },
        message: `${userLabel} sent "${details.documentTitle || 'document'}" to ${details.vendor || details.email || 'vendor'}${details.version ? ` (v${details.version})` : ''}`
      };

    case 'exhibit:upload':
      return {
        action: 'uploaded exhibit',
        target: 'exhibit',
        details: { filename: details.filename, size: details.size, platform: details.platform },
        message: `${userLabel} uploaded exhibit "${details.filename}"`
      };

    case 'exhibit:deleted':
      return {
        action: 'deleted exhibit',
        target: 'exhibit',
        details: {
          filename: details.filename,
          size: details.size,
          usedInDocuments: details.usedInDocuments,
          platform: details.platform
        },
        message: `${userLabel} deleted exhibit "${details.filename}"${details.usedInDocuments ? ' (was referenced in document)' : ''}`
      };

    case 'document:title-change':
      return {
        action: 'changed document title',
        target: 'document',
        details: { oldTitle: details.oldTitle, newTitle: details.newTitle },
        message: `${userLabel} changed document title to "${details.newTitle}"`
      };

    case 'chat:reset':
      return {
        action: 'reset chat',
        target: 'chat',
        details: {},
        message: `${userLabel} reset AI chat history`
      };

    case 'system:factory-reset':
      return {
        action: 'performed factory reset',
        target: 'system',
        details: {},
        message: `${userLabel} performed factory reset - all data cleared`
      };

    // User authentication events (not yet wired up - full auth not implemented in prototype)
    // TODO: Call logActivity('user:login', userId, { platform, ipAddress, userAgent }) when auth is implemented
    case 'user:login':
      return {
        action: 'logged in',
        target: 'user',
        details: {
          userId: details.userId,
          platform: details.platform,
          ipAddress: details.ipAddress,
          userAgent: details.userAgent
        },
        message: `${userLabel} logged in${details.platform ? ` (${details.platform})` : ''}`
      };

    case 'user:logout':
      return {
        action: 'logged out',
        target: 'user',
        details: {
          userId: details.userId,
          sessionDuration: details.sessionDuration,
          platform: details.platform
        },
        message: `${userLabel} logged out${details.sessionDuration ? ` (session: ${details.sessionDuration})` : ''}`
      };

    case 'user:role-changed':
      return {
        action: 'changed user role',
        target: 'user',
        details: {
          targetUserId: details.targetUserId,
          oldRole: details.oldRole,
          newRole: details.newRole,
          changedBy: details.changedBy,
          documentTitle: details.documentTitle
        },
        message: (function(){
          const target = details.targetUserId ? resolveUserLabel(details.targetUserId) : 'user';
          const doc = details.documentTitle ? ` for "${details.documentTitle}"` : '';
          return `${userLabel} changed ${target}'s role from ${details.oldRole} to ${details.newRole}${doc}`;
        })()
      };

    case 'user:added-to-document':
      return {
        action: 'granted access',
        target: 'user',
        details: {
          targetUserId: details.targetUserId,
          role: details.role,
          grantedBy: details.grantedBy,
          documentTitle: details.documentTitle
        },
        message: (function(){
          const target = details.targetUserId ? resolveUserLabel(details.targetUserId) : 'user';
          const doc = details.documentTitle ? ` to "${details.documentTitle}"` : '';
          return `${userLabel} granted ${target} ${details.role} access${doc}`;
        })()
      };

    case 'user:removed-from-document':
      return {
        action: 'revoked access',
        target: 'user',
        details: {
          targetUserId: details.targetUserId,
          previousRole: details.previousRole,
          revokedBy: details.revokedBy,
          documentTitle: details.documentTitle
        },
        message: (function(){
          const target = details.targetUserId ? resolveUserLabel(details.targetUserId) : 'user';
          const doc = details.documentTitle ? ` from "${details.documentTitle}"` : '';
          return `${userLabel} revoked ${target}'s ${details.previousRole} access${doc}`;
        })()
      };

    // Messages activity types
    case 'message:created':
      return {
        action: 'started conversation',
        target: 'message',
        details: { 
          messageId: details.messageId, 
          title: details.title, 
          recipients: details.recipients,
          recipientsList: details.recipientsList,  // Array of recipient objects with names/emails
          internal: details.internal,
          external: details.external,
          privileged: details.privileged,
          initialMessage: details.initialMessage,
          platform: details.platform
        },
        message: `${userLabel} started a conversation${details.title ? ` "${details.title}"` : ''}${details.recipients > 0 ? ` with ${details.recipients} ${details.recipients === 1 ? 'person' : 'people'}` : ''}`
      };

    case 'message:archived':
      return {
        action: 'archived conversation',
        target: 'message',
        details: { 
          messageId: details.messageId,
          title: details.title,
          participants: details.participants,
          postCount: details.postCount,
          platform: details.platform
        },
        message: `${userLabel} archived a conversation${details.title ? ` "${details.title}"` : ''}`
      };

    case 'message:unarchived':
      return {
        action: 'unarchived conversation',
        target: 'message',
        details: { 
          messageId: details.messageId,
          title: details.title,
          participants: details.participants,
          postCount: details.postCount,
          platform: details.platform
        },
        message: `${userLabel} unarchived a conversation${details.title ? ` "${details.title}"` : ''}`
      };

    case 'message:flags-updated':
      return {
        action: 'updated conversation flags',
        target: 'message',
        details: { 
          messageId: details.messageId, 
          title: details.title,
          internal: details.internal,
          external: details.external,
          privileged: details.privileged,
          participants: details.participants,
          platform: details.platform
        },
        message: (function(){
          const flags = [];
          if (details.internal) flags.push('internal');
          if (details.external) flags.push('external');
          if (details.privileged) flags.push('attorney-client privilege');
          if (flags.length === 0) return `${userLabel} updated conversation flags${details.title ? ` for "${details.title}"` : ''}`;
          return `${userLabel} marked conversation${details.title ? ` "${details.title}"` : ''} as ${flags.join(', ')}`;
        })()
      };

    case 'message:deleted':
      return {
        action: 'deleted conversation',
        target: 'message',
        details: { 
          messageId: details.messageId, 
          title: details.title,
          participants: details.participants,
          postCount: details.postCount,
          internal: details.internal,
          external: details.external,
          privileged: details.privileged,
          platform: details.platform
        },
        message: `${userLabel} deleted a conversation${details.title ? ` "${details.title}"` : ''}${details.postCount ? ` (${details.postCount} message${details.postCount !== 1 ? 's' : ''})` : ''}`
      };

    case 'message:post-created':
      return {
        action: 'posted message',
        target: 'message',
        details: {
          messageId: details.messageId,
          postId: details.postId,
          conversationTitle: details.conversationTitle,
          text: details.text, // Truncated in logActivity call
          privileged: details.privileged,
          participants: details.participants,
          platform: details.platform
        },
        message: `${userLabel} posted in "${details.conversationTitle || 'conversation'}"${details.privileged ? ' (attorney-client privileged)' : ''}`
      };

    case 'message:post-deleted':
      return {
        action: 'deleted post',
        target: 'message',
        details: {
          messageId: details.messageId,
          postId: details.postId,
          conversationTitle: details.conversationTitle,
          deletedText: details.deletedText, // Truncated
          platform: details.platform
        },
        message: `${userLabel} deleted a post from "${details.conversationTitle || 'conversation'}"`
      };

    case 'message:read':
      return {
        action: 'marked as read',
        target: 'message',
        details: {
          messageId: details.messageId,
          conversationTitle: details.conversationTitle,
          unreadCount: details.unreadCount,
          platform: details.platform
        },
        message: `${userLabel} marked "${details.conversationTitle || 'conversation'}" as read`
      };

    case 'message:unread':
      return {
        action: 'marked as unread',
        target: 'message',
        details: {
          messageId: details.messageId,
          conversationTitle: details.conversationTitle,
          platform: details.platform
        },
        message: `${userLabel} marked "${details.conversationTitle || 'conversation'}" as unread`
      };

    case 'message:exported':
      return {
        action: 'exported messages',
        target: 'message',
        details: {
          scope: details.scope,
          filters: details.filters,
          messageCount: details.messageCount,
          includePosts: details.includePosts,
          platform: details.platform
        },
        message: `${userLabel} exported ${details.messageCount || 0} conversation${details.messageCount !== 1 ? 's' : ''} to CSV${details.includePosts ? ' with posts' : ''}`
      };

    // Add more activity types as needed
    default:
      return {
        action: 'performed action',
        target: 'document',
        details,
        message: `${userLabel} performed ${type.replace(':', ' ')}`
      };
  }
}

const dataWorkingDir = path.join(rootDir, 'data', 'working');
const canonicalDocumentsDir = path.join(dataAppDir, 'documents');
const canonicalExhibitsDir = path.join(dataAppDir, 'exhibits');
const workingDocumentsDir = path.join(dataWorkingDir, 'documents');
const workingExhibitsDir = path.join(dataWorkingDir, 'exhibits');
const compiledDir = path.join(dataWorkingDir, 'compiled');
const versionsDir = path.join(dataWorkingDir, 'versions');
const approvalsFilePath = path.join(dataAppDir, 'approvals.json');
const activityLogFilePath = path.join(dataAppDir, 'activity-log.json');
const messagesFilePath = path.join(dataAppDir, 'messages.json');
const chatFilePath = path.join(dataAppDir, 'chat.json');
const variablesFilePath = path.join(dataAppDir, 'variables.json');
const fieldsFilePath = path.join(dataAppDir, 'fields.json');

// Ensure working directories exist
for (const dir of [dataWorkingDir, workingDocumentsDir, workingExhibitsDir, compiledDir, versionsDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// In-memory state (prototype)
const DOCUMENT_ID = process.env.DOCUMENT_ID || 'default';
const serverState = {
  
  checkedOutBy: null,
  lastUpdated: new Date().toISOString(),
  revision: 1,
  // Document update tracking (prototype)
  documentVersion: 1,
  title: 'Redlined & Signed',
  status: 'draft',
  updatedBy: null, // { userId, label }
  updatedPlatform: null, // 'web' | 'word' | null
  approvalsRevision: 1,
};

// Load persisted state if available
const stateFilePath = path.join(dataAppDir, 'state.json');
try {
  if (fs.existsSync(stateFilePath)) {
    const saved = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
    if (saved.checkedOutBy === null || typeof saved.checkedOutBy === 'string') serverState.checkedOutBy = saved.checkedOutBy;
    if (typeof saved.lastUpdated === 'string') serverState.lastUpdated = saved.lastUpdated;
    if (typeof saved.revision === 'number') serverState.revision = saved.revision;
    if (typeof saved.documentVersion === 'number') serverState.documentVersion = saved.documentVersion;
    if (typeof saved.title === 'string') serverState.title = saved.title;
    if (typeof saved.status === 'string') serverState.status = saved.status;
    if (saved.updatedBy && typeof saved.updatedBy === 'object') serverState.updatedBy = saved.updatedBy;
    if (typeof saved.updatedPlatform === 'string') serverState.updatedPlatform = saved.updatedPlatform;
    if (typeof saved.approvalsRevision === 'number') serverState.approvalsRevision = saved.approvalsRevision;
  }
} catch {}

function persistState() {
  try {
    fs.writeFileSync(stateFilePath, JSON.stringify({ checkedOutBy: serverState.checkedOutBy, lastUpdated: serverState.lastUpdated, revision: serverState.revision, documentVersion: serverState.documentVersion, title: serverState.title, status: serverState.status, updatedBy: serverState.updatedBy, updatedPlatform: serverState.updatedPlatform, approvalsRevision: serverState.approvalsRevision }, null, 2));
  } catch {}
}

function bumpRevision() {
  serverState.revision = (Number(serverState.revision) || 0) + 1;
  serverState.lastUpdated = new Date().toISOString();
  persistState();
}

function bumpDocumentVersion(updatedByUserId, platform) {
  serverState.documentVersion = (Number(serverState.documentVersion) || 0) + 1;
  const users = loadUsers();
  let label = updatedByUserId || 'user1';
  try {
    const u = users.find(u => (u?.id || u?.label) === updatedByUserId);
    if (u) label = u.label || u.id || updatedByUserId;
  } catch {}
  serverState.updatedBy = { userId: updatedByUserId || 'user1', label };
  serverState.updatedPlatform = (platform === 'word' || platform === 'web') ? platform : null;
  serverState.lastUpdated = new Date().toISOString();
  persistState();
}

function bumpApprovalsRevision() {
  serverState.approvalsRevision = (Number(serverState.approvalsRevision) || 0) + 1;
  persistState();
}

// Helpers: users/roles
function loadUsers() {
  try {
    const up = path.join(dataUsersDir, 'users.json');
    if (!fs.existsSync(up)) return [];
    const users = JSON.parse(fs.readFileSync(up, 'utf8'));
    return Array.isArray(users) ? users : [];
  } catch { return []; }
}
function loadRoleMap() {
  try {
    const rp = path.join(dataUsersDir, 'roles.json');
    if (!fs.existsSync(rp)) return {};
    return JSON.parse(fs.readFileSync(rp, 'utf8')) || {};
  } catch { return {}; }
}
function getUserRole(userId) {
  const users = loadUsers();
  for (const u of users) {
    if (typeof u === 'string') {
      if (u === userId) return 'editor';
    } else if (u && (u.id === userId || u.label === userId)) {
      return u.role || 'editor';
    }
  }
  return 'editor';
}

// Resolve a user id to a human-friendly display label using users.json
function resolveUserLabel(id) {
  if (!id) return id;
  try {
    const list = loadUsers();
    if (!Array.isArray(list) || !list.length) return id;
    const match = list.find((u) => (typeof u === 'string' ? u === id : (u && (u.id === id || u.label === id))));
    return typeof match === 'string' ? match : ((match && (match.label || match.id)) || id);
  } catch { return id; }
}

// Chatbot responses loader (hard-coded list from data file)
function loadChatbotResponses() {
  try {
    const p = path.join(dataAppDir, 'config', 'chatbot-responses.json');
    if (!fs.existsSync(p)) return null;
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (Array.isArray(j?.messages) && j.messages.length) return j;
  } catch {}
  return null;
}

// Track sequential reply index per user to keep each user's conversation ordered
const chatbotStateByUser = new Map();

function buildBanner({ isCheckedOut, isOwner, checkedOutBy }) {
  if (isCheckedOut) {
    // Disable banners for both self and other checkout cases
    return null;
  }
  // Suppress other banners for now
  return null;
}

// Approvals helpers
function loadApprovals() {
  try {
    if (fs.existsSync(approvalsFilePath)) {
      const j = JSON.parse(fs.readFileSync(approvalsFilePath, 'utf8'));
      if (j && Array.isArray(j.approvers)) return { approvers: j.approvers, revision: Number(j.revision) || serverState.approvalsRevision };
    }
  } catch {}
  const users = loadUsers();
  const approvers = users.map((u, i) => {
    const id = u && (u.id || u.label) || String(i + 1);
    const name = u && (u.label || u.id) || id;
    return { userId: id, name, order: i + 1, approved: false, notes: '' };
  });
  return { approvers, revision: serverState.approvalsRevision };
}

function saveApprovals(list) {
  try {
    const data = { approvers: Array.isArray(list) ? list : [], revision: serverState.approvalsRevision };
    fs.writeFileSync(approvalsFilePath, JSON.stringify(data, null, 2));
    return true;
  } catch { return false; }
}

function computeApprovalsSummary(list) {
  const total = Array.isArray(list) ? list.length : 0;
  const approved = Array.isArray(list) ? list.filter(a => !!a.approved).length : 0;
  return { approved, total };
}

// SSE clients
const sseClients = new Set();

// Test mode flag - when enabled, SSE broadcasts are disabled and clients are disconnected
let testMode = false;

function broadcast(event) {
  // Skip broadcasts during test mode to prevent conflicts with open browser tabs
  if (testMode) return;
  
  const enriched = {
    documentId: DOCUMENT_ID,
    revision: serverState.revision,
    documentVersion: Number(serverState.documentVersion) || 1,
    ts: Date.now(),
    ...event
  };
  const payload = `data: ${JSON.stringify(enriched)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
      res.flush?.();
    } catch { /* ignore */ }
  }
}

// Express app
const app = express();
app.use(compression());
// JSON body limit must accommodate DOCX base64 payloads for save-progress
app.use(express.json({ limit: '50mb' }));

// CORS for Yeoman add-in dev server
const allowedOrigins = new Set([
  ADDIN_DEV_ORIGIN,
]);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Static assets
// Serve vendor bundles (SuperDoc) under /vendor
app.use('/vendor', express.static(path.join(publicDir, 'vendor'), { fallthrough: true }));
// Serve shared UI under /ui
app.use('/ui', express.static(sharedUiDir, { fallthrough: true }));
// Serve web static assets (helper scripts) under /web
app.use('/web', express.static(webDir, { fallthrough: true }));
// Serve compiled outputs (PDFs)
app.use('/compiled', express.static(compiledDir, { fallthrough: true }));

// Prevent caches on JSON APIs to avoid stale state
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// WebSocket reverse proxy for collaboration under same HTTPS origin
const COLLAB_TARGET = process.env.COLLAB_TARGET || 'http://localhost:4002';
const collabProxy = createProxyMiddleware({
  target: COLLAB_TARGET,
  changeOrigin: true,
  ws: true,
  secure: false,
  logLevel: 'warn',
});
app.use('/collab', collabProxy);

// Quiet favicon 404s
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// Debug and view pages
app.get('/debug', (req, res) => {
  res.sendFile(path.join(webDir, 'debug.html'));
});
app.get(['/view', '/'], (req, res) => {
  res.sendFile(path.join(webDir, 'view.html'));
});

// Files: default document resolution (working copy preferred)
function resolveDefaultDocPath() {
  const working = path.join(workingDocumentsDir, 'default.docx');
  if (fs.existsSync(working)) return working;
  return path.join(canonicalDocumentsDir, 'default.docx');
}

// Files: exhibits listing (canonical only for now)
function listExhibits() {
  const names = new Set();
  const items = [];
  // Prefer working copies first
  if (fs.existsSync(workingExhibitsDir)) {
    for (const f of fs.readdirSync(workingExhibitsDir)) {
      const p = path.join(workingExhibitsDir, f);
      if (fs.statSync(p).isDirectory()) continue;
      names.add(f);
      items.push({ name: f, url: `/exhibits/${encodeURIComponent(f)}` });
    }
  }
  if (fs.existsSync(canonicalExhibitsDir)) {
    for (const f of fs.readdirSync(canonicalExhibitsDir)) {
      if (names.has(f)) continue; // working overrides
      const p = path.join(canonicalExhibitsDir, f);
      if (fs.statSync(p).isDirectory()) continue;
      items.push({ name: f, url: `/exhibits/${encodeURIComponent(f)}` });
    }
  }
  return items;
}

// Explicit canonical/working document endpoints
app.get('/documents/canonical/default.docx', (req, res) => {
  const p = path.join(canonicalDocumentsDir, 'default.docx');
  if (!fs.existsSync(p)) return res.status(404).send('canonical default.docx not found');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Disposition', 'inline; filename="default.docx"');
  res.sendFile(p);
});

app.get('/documents/working/default.docx', (req, res) => {
  const p = path.join(workingDocumentsDir, 'default.docx');
  if (!fs.existsSync(p)) return res.status(404).send('working default.docx not found');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Disposition', 'inline; filename="default.docx"');
  res.sendFile(p);
});

// Serve canonical exhibits
app.get('/exhibits/:name', (req, res) => {
  const w = path.join(workingExhibitsDir, req.params.name);
  const c = path.join(canonicalExhibitsDir, req.params.name);
  const p = fs.existsSync(w) ? w : c;
  if (!fs.existsSync(p)) return res.status(404).send('exhibit not found');
  res.setHeader('Content-Disposition', `inline; filename="${req.params.name}"`);
  res.sendFile(p);
});

// Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (req.path.includes('/exhibits')) return cb(null, workingExhibitsDir);
    return cb(null, workingDocumentsDir);
  },
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

// API v1
app.get('/api/v1/health', (req, res) => {
  const llmEnabled = (LLM_PROVIDER === 'ollama') ||
                       (LLM_PROVIDER === 'openai' && !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'mock');

  const llmInfo = llmEnabled ? {
    enabled: true,
    provider: LLM_PROVIDER,
    model: LLM_PROVIDER === 'ollama' ? OLLAMA_MODEL : OPENAI_MODEL
  } : {
    enabled: false,
    provider: null,
    usingMock: LLM_USE_OPENAI && process.env.OPENAI_API_KEY === 'mock'
  };

  res.json({
    ok: true,
    superdoc: SUPERDOC_BASE_URL,
    llmEnabled: llmInfo.enabled,
    llmProvider: llmInfo.provider,
    llmModel: llmInfo.enabled ? llmInfo.model : null
  });
});

app.get('/api/v1/users', (req, res) => {
  try {
    const up = path.join(dataUsersDir, 'users.json');
    const rp = path.join(dataUsersDir, 'roles.json');
    const users = fs.existsSync(up) ? JSON.parse(fs.readFileSync(up, 'utf8')) : [];
    const roles = fs.existsSync(rp) ? JSON.parse(fs.readFileSync(rp, 'utf8')) : {};
    const norm = (Array.isArray(users) ? users : []).map(u => {
      if (typeof u === 'string') return { id: u, label: u, role: 'editor' };
      return { id: u.id || u.label || 'user', label: u.label || u.id, role: u.role || 'editor', title: u.title || '' };
    });
    return res.json({ items: norm, roles });
  } catch (e) {
    return res.json({ items: [ { id: 'user1', label: 'user1', role: 'editor' } ], roles: { editor: {} } });
  }
});

app.get('/api/v1/activity', (req, res) => {
  try {
    if (!fs.existsSync(activityLogFilePath)) {
      // Initialize empty file if it doesn't exist
      fs.writeFileSync(activityLogFilePath, '[]', 'utf8');
      return res.json({ activities: [] });
    }

    let activities = [];
    try {
      const content = fs.readFileSync(activityLogFilePath, 'utf8');
      // Handle potential BOM
      const cleanContent = content.replace(/^\uFEFF/, '');
      activities = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Error parsing activity log, reinitializing:', parseError);
      // Reinitialize corrupted file
      fs.writeFileSync(activityLogFilePath, '[]', 'utf8');
      activities = [];
    }

    // Ensure we return an array, filter out any malformed entries
    const validActivities = Array.isArray(activities) ? activities.filter(a => a && typeof a === 'object' && a.id) : [];
    return res.json({ activities: validActivities });
  } catch (e) {
    console.error('Error reading activity log:', e);
    return res.status(500).json({ error: 'Failed to read activity log' });
  }
});

// Messages API
// Messages API (conversation messaging with ACP/internal flags)
// GET /api/v1/messages - List conversations with filters
app.get('/api/v1/messages', (req, res) => {
  try {
    const { state, internal, privileged, search, userId } = req.query;
    const data = readMessages();
    let messages = data.messages.filter(m => !m.deletedAt);
    
    // Filter by participant - only show conversations where userId is a participant
    if (userId) {
      messages = messages.filter(m => 
        m.participants.some(p => p.userId === userId) || 
        m.createdBy.userId === userId
      );
      
      // Filter out conversations deleted by this user
      messages = messages.filter(m => {
        const deletedBy = m.deletedBy || [];
        return !deletedBy.includes(userId);
      });
    }
    
    // Apply filters
    if (state && state !== 'all') {
      if (state === 'archived') {
        // Show only conversations archived by this user
        messages = messages.filter(m => {
          const archivedBy = m.archivedBy || [];
          return archivedBy.includes(userId);
        });
      } else {
        // For 'open', exclude archived conversations
        messages = messages.filter(m => {
          const archivedBy = m.archivedBy || [];
          return !archivedBy.includes(userId);
        });
      }
    }
    if (internal === 'true') {
      messages = messages.filter(m => m.internal === true);
    } else if (internal === 'false') {
      messages = messages.filter(m => m.internal === false);
    }
    if (privileged === 'true') {
      messages = messages.filter(m => m.privileged === true);
    } else if (privileged === 'false') {
      messages = messages.filter(m => m.privileged === false);
    }
    // Sort by lastPostAt descending
    messages.sort((a, b) => b.lastPostAt - a.lastPostAt);
    
    // Get posts for each conversation and ensure all properties have defaults
    const messagesWithPosts = messages.map(message => ({
      ...message,
      internal: message.internal !== undefined ? message.internal : false,
      external: message.external !== undefined ? message.external : false,
      privileged: message.privileged !== undefined ? message.privileged : false,
      archivedBy: message.archivedBy || [],
      deletedBy: message.deletedBy || [],
      posts: data.posts.filter(p => p.messageId === message.messageId).sort((a, b) => a.createdAt - b.createdAt),
      postCount: data.posts.filter(p => p.messageId === message.messageId).length
    }));
    
    // Apply search filter after posts are attached (search across title, participants, and all post content)
    let filteredMessages = messagesWithPosts;
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filteredMessages = messagesWithPosts.filter(m => 
        m.title.toLowerCase().includes(searchLower) ||
        m.participants.some(p => p.label.toLowerCase().includes(searchLower)) ||
        m.participants.some(p => p.email && p.email.toLowerCase().includes(searchLower)) ||
        m.posts.some(post => post.text && post.text.toLowerCase().includes(searchLower)) ||
        m.posts.some(post => post.author && post.author.label && post.author.label.toLowerCase().includes(searchLower))
      );
    }
    
    return res.json({ messages: filteredMessages });
  } catch (e) {
    console.error('Error reading messages:', e);
    return res.status(500).json({ error: 'Failed to read messages' });
  }
});

// POST /api/v1/messages - Create new Message
app.post('/api/v1/messages', (req, res) => {
  try {
    const { title, recipients, internal, external, privileged, text, userId } = req.body;
    
    if (!Array.isArray(recipients)) {
      return res.status(400).json({ error: 'Recipients must be an array' });
    }
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient is required' });
    }
    
    // Get current user info
    const users = loadUsers();
    const currentUser = users.find(u => u.id === userId);
    const createdBy = {
      userId: userId || 'user1',
      label: currentUser?.label || 'User'
    };
    
    // Auto-generate title from participants if not provided
    const MessageTitle = title && title.trim() 
      ? title.trim() 
      : recipients.map(r => r.label).join(', ') || 'Untitled Message';
    
    // Create Message
    const result = createMessage({
      title: MessageTitle,
      createdBy,
      participants: recipients,
      internal: !!internal,
      external: !!external,
      privileged: !!privileged,
      text: text || ''
    });
    
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    
    // Broadcast SSE event
    broadcast({
      type: 'message:created',
      message: result.message
    });
    
    // Log activity
    logActivity('message:created', userId, {
      messageId: result.message.messageId,
      title: result.message.title,
      recipients: recipients.length,
      recipientsList: recipients.map(r => ({ label: r.label, email: r.email, userId: r.userId })),
      internal: !!internal,
      external: !!external,
      privileged: !!privileged,
      initialMessage: text || null,
      platform: (req.body?.platform || req.query?.platform || 'web')
    });
    
    return res.json({ ok: true, message: result.message });
  } catch (e) {
    console.error('Error creating message:', e);
    return res.status(500).json({ error: 'Failed to create message' });
  }
});

// POST /api/v1/messages/:messageId/post - Add post to message
app.post('/api/v1/messages/:messageId/post', (req, res) => {
  try {
    const { messageId } = req.params;
    const { text, privileged, userId } = req.body;
    
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }
    
    // Get current user info
    const users = loadUsers();
    const currentUser = users.find(u => u.id === userId);
    const author = {
      userId: userId || 'user1',
      label: currentUser?.label || 'User'
    };
    
    const result = addPostToMessage(messageId, author, text, !!privileged);
    
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }
    
    // Log activity
    logActivity('message:post-created', userId, {
      messageId: messageId,
      postId: result.post.postId,
      conversationTitle: result.message.title || 'Untitled',
      text: String(text).slice(0, 200), // Truncate to 200 chars
      privileged: !!privileged,
      participants: result.message.participants?.length || 0,
      platform: req.body?.platform || req.query?.platform || 'web'
    });
    
    // Broadcast SSE event
    broadcast({
      type: 'message:post-added',
      post: result.post,
      message: result.message
    });
    
    return res.json({ ok: true, post: result.post, message: result.message });
  } catch (e) {
    console.error('Error adding post:', e);
    return res.status(500).json({ error: 'Failed to add post' });
  }
});

// POST /api/v1/messages/:messageId/state - Update message state (user-specific archive)
app.post('/api/v1/messages/:messageId/state', (req, res) => {
  try {
    const { messageId } = req.params;
    const { state, userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    if (state === 'archived') {
      // Archive is user-specific - add user to archivedBy array
      const result = archiveMessageForUser(messageId, userId);
      if (result.error) {
        return res.status(404).json({ error: result.error });
      }
      
      broadcast({
        type: 'message:state-changed',
        message: result.message,
        userId
      });
      
      const data = readMessages();
      const postCount = data.posts.filter(p => p.messageId === messageId).length;
      
      logActivity('message:archived', userId, { 
        messageId,
        title: result.message.title,
        participants: result.message.participants.map(p => p.label).join(', '),
        postCount,
        platform: (req.body?.platform || req.query?.platform || 'web')
      });
      return res.json({ ok: true, message: result.message });
    } else if (state === 'open') {
      // Unarchive is user-specific - remove user from archivedBy array
      const result = unarchiveMessageForUser(messageId, userId);
      if (result.error) {
        return res.status(404).json({ error: result.error });
      }
      
      broadcast({
        type: 'message:state-changed',
        message: result.message,
        userId
      });
      
      const data = readMessages();
      const postCount = data.posts.filter(p => p.messageId === messageId).length;
      
      logActivity('message:unarchived', userId, { 
        messageId,
        title: result.message.title,
        participants: result.message.participants.map(p => p.label).join(', '),
        postCount,
        platform: (req.body?.platform || req.query?.platform || 'web')
      });
      return res.json({ ok: true, message: result.message });
    }
    
    return res.status(400).json({ error: 'Invalid state. Must be archived or open.' });
  } catch (e) {
    console.error('Error updating message state:', e);
    return res.status(500).json({ error: 'Failed to update message state' });
  }
});

// POST /api/v1/messages/:messageId/flags - Toggle internal/external/privileged flags
app.post('/api/v1/messages/:messageId/flags', (req, res) => {
  try {
    const { messageId } = req.params;
    const { internal, external, privileged, userId } = req.body;
    
    const result = updateMessageFlags(messageId, { internal, external, privileged });
    
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }
    
    // Broadcast SSE event
    broadcast({
      type: 'message:flags-updated',
      message: result.message
    });
    
    // Log activity
    logActivity('message:flags-updated', userId, {
      messageId,
      title: result.message.title,
      internal: result.message.internal,
      external: result.message.external,
      privileged: result.message.privileged,
      participants: result.message.participants.map(p => p.label).join(', '),
      platform: (req.body?.platform || req.query?.platform || 'web')
    });
    
    return res.json({ ok: true, message: result.message });
  } catch (e) {
    console.error('Error updating message flags:', e);
    return res.status(500).json({ error: 'Failed to update message flags' });
  }
});

// POST /api/v1/messages/:messageId/read - Mark message as read
app.post('/api/v1/messages/:messageId/read', (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId, unread } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    const result = unread 
      ? markMessageUnread(messageId, userId)
      : markMessageRead(messageId, userId);
    
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }
    
    // Log activity
    logActivity(unread ? 'message:unread' : 'message:read', userId, {
      messageId: messageId,
      conversationTitle: result.message.title || 'Untitled',
      unreadCount: result.message.unreadBy?.length || 0,
      platform: req.body?.platform || req.query?.platform || 'web'
    });
    
    // Broadcast SSE event
    broadcast({
      type: 'message:read',
      message: result.message,
      userId
    });
    
    return res.json({ ok: true, message: result.message });
  } catch (e) {
    console.error('Error marking message read/unread:', e);
    return res.status(500).json({ error: 'Failed to mark message read/unread' });
  }
});

// POST /api/v1/messages/:messageId/delete - Soft delete message (user-specific)
app.post('/api/v1/messages/:messageId/delete', (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    const result = deleteMessageForUser(messageId, userId);
    
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }
    
    // Broadcast SSE event
    broadcast({
      type: 'message:deleted',
      message: result.message,
      userId
    });
    
    const data = readMessages();
    const postCount = data.posts.filter(p => p.messageId === messageId).length;
    
    // Log activity
    logActivity('message:deleted', userId, {
      messageId,
      title: result.message.title,
      participants: result.message.participants.map(p => p.label).join(', '),
      postCount,
      internal: result.message.internal,
      external: result.message.external,
      privileged: result.message.privileged,
      platform: (req.body?.platform || req.query?.platform || 'web')
    });
    
    return res.json({ ok: true, message: result.message });
  } catch (e) {
    console.error('Error deleting message:', e);
    return res.status(500).json({ error: 'Failed to delete message' });
  }
});

// GET /api/v1/messages/export.csv - Export messages to CSV
app.get('/api/v1/messages/export.csv', (req, res) => {
  try {
    const { scope, messageIds, includeInternal, includePrivileged, includePosts } = req.query;
    const data = readMessages();
    let messages = data.messages.filter(t => !t.deletedAt);
    
    // Filter by scope
    if (scope === 'single' && messageIds) {
      const ids = messageIds.split(',');
      messages = messages.filter(t => ids.includes(t.messageId));
    }
    
    // Apply policy filters
    if (includeInternal !== 'true') {
      messages = messages.filter(t => !t.internal);
    }
    if (includePrivileged !== 'true') {
      messages = messages.filter(t => !t.privileged);
    }
    
    // Build CSV
    let csv = 'messageId,title,state,internal,privileged,createdAt,createdBy,participants,lastPostAt,postCount\n';
    
    messages.forEach(message => {
      const participantNames = message.participants.map(p => p.label).join('; ');
      const createdAt = new Date(message.createdAt).toISOString();
      const lastPostAt = new Date(message.lastPostAt).toISOString();
      const postCount = data.posts.filter(p => p.messageId === message.messageId).length;
      
      csv += `"${message.messageId}","${message.title}","${message.state}",${message.internal},${message.privileged},"${createdAt}","${message.createdBy.label}","${participantNames}","${lastPostAt}",${postCount}\n`;
      
      // Include posts if requested
      if (includePosts === 'true') {
        const posts = data.posts.filter(p => p.messageId === message.messageId);
        posts.forEach(post => {
          const postCreatedAt = new Date(post.createdAt).toISOString();
          const text = post.text.replace(/"/g, '""'); // Escape quotes
          csv += `"${post.postId}","${post.messageId}","${post.author.label}","${postCreatedAt}",${post.privileged},"${text}"\n`;
        });
      }
    });
    
    // Log activity
    const userId = req.query.userId || req.body?.userId || 'system';
    const filters = [];
    if (scope) filters.push(`scope:${scope}`);
    if (includeInternal === 'true') filters.push('internal');
    if (includePrivileged === 'true') filters.push('privileged');
    
    logActivity('message:exported', userId, {
      scope: scope || 'all',
      filters: filters.join(', '),
      messageCount: messages.length,
      includePosts: includePosts === 'true',
      platform: req.query.platform || 'web'
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="messages-export-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (e) {
    console.error('Error exporting messages:', e);
    return res.status(500).json({ error: 'Failed to export messages' });
  }
});

// GET /api/v1/discussion/summary - Get badge counts
app.get('/api/v1/discussion/summary', (req, res) => {
  try {
    const { userId } = req.query;
    const summary = getDiscussionSummary(userId || 'user1');
    return res.json(summary);
  } catch (e) {
    console.error('Error getting discussion summary:', e);
    return res.status(500).json({ error: 'Failed to get discussion summary' });
  }
});

// Chat API
app.get('/api/v1/chat', (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }
    const allChats = readChat();
    const userChat = allChats[userId] || [];
    return res.json({ messages: userChat });
  } catch (e) {
    console.error('Error reading chat:', e);
    return res.status(500).json({ error: 'Failed to read chat' });
  }
});

app.post('/api/v1/chat/reset', (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }
    resetUserChat(userId);
    return res.json({ ok: true });
  } catch (e) {
    console.error('Error resetting chat:', e);
    return res.status(500).json({ error: 'Failed to reset chat' });
  }
});

// Variables API
app.get('/api/v1/variables', (req, res) => {
  try {
    const variables = readVariables();
    return res.json({ variables });
  } catch (e) {
    console.error('Error reading variables:', e);
    return res.status(500).json({ error: 'Failed to read variables' });
  }
});

app.post('/api/v1/variables', (req, res) => {
  try {
    const { varId, displayLabel, type, category, value, email, userId } = req.body;
    
    // Validation
    if (!displayLabel) {
      return res.status(400).json({ error: 'Missing required field: displayLabel' });
    }
    
    // Validate email for signatures
    if (type === 'signature' && !email) {
      return res.status(400).json({ error: 'Email is required for signature variables' });
    }
    
    // Generate varId if not provided
    const generatedVarId = varId || `var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Check for duplicate varId
    const existingVariables = readVariables();
    if (existingVariables[generatedVarId]) {
      return res.status(409).json({ error: 'Variable with this ID already exists' });
    }
    
    // Create variable object with metadata
    // If no value provided, use displayLabel as initial placeholder value
    const variable = {
      varId: generatedVarId,
      displayLabel,
      type: type || 'value',
      value: value || displayLabel,
      createdBy: userId || 'system',
      createdAt: new Date().toISOString(),
      updatedBy: userId || 'system',
      updatedAt: new Date().toISOString()
    };
    
    // Add email and docusignRole for signature type
    if (type === 'signature') {
      variable.email = email || null;
      variable.docusignRole = req.body.docusignRole || null;
    }
    
    // Save to storage
    if (!saveVariable(variable)) {
      return res.status(500).json({ error: 'Failed to save variable' });
    }
    
    // Log activity
    logActivity('variable:created', userId || 'system', { 
      varId: generatedVarId, 
      displayLabel
    });
    
    // Broadcast SSE event
    broadcast({ 
      type: 'variable:created', 
      variable,
      userId: userId || 'system'
    });
    
    return res.json({ ok: true, variable });
  } catch (e) {
    console.error('Error creating variable:', e);
    return res.status(500).json({ error: 'Failed to create variable' });
  }
});

app.put('/api/v1/variables/:varId', (req, res) => {
  try {
    const { varId } = req.params;
    const { displayLabel, type, category, value, email, docusignRole, userId } = req.body;
    
    // Check if variable exists
    const existingVariables = readVariables();
    if (!existingVariables[varId]) {
      return res.status(404).json({ error: 'Variable not found' });
    }
    
    const oldVariable = existingVariables[varId];
    
    // Build updates object
    const updates = {
      updatedBy: userId || 'system'
    };
    if (displayLabel !== undefined) updates.displayLabel = displayLabel;
    if (type !== undefined) updates.type = type;
    if (category !== undefined) updates.category = category;
    if (value !== undefined) updates.value = value;
    if (email !== undefined) updates.email = email;
    if (docusignRole !== undefined) updates.docusignRole = docusignRole;
    
    // Track what changed with old -> new values
    const changes = {};
    if (displayLabel !== undefined && displayLabel !== oldVariable.displayLabel) {
      changes.displayLabel = { old: oldVariable.displayLabel, new: displayLabel };
    }
    if (type !== undefined && type !== oldVariable.type) {
      changes.type = { old: oldVariable.type, new: type };
    }
    if (category !== undefined && category !== oldVariable.category) {
      changes.category = { old: oldVariable.category, new: category };
    }
    if (value !== undefined && value !== oldVariable.value) {
      changes.value = { old: oldVariable.value, new: value };
    }
    if (email !== undefined && email !== oldVariable.email) {
      changes.email = { old: oldVariable.email, new: email };
    }
    if (docusignRole !== undefined && docusignRole !== oldVariable.docusignRole) {
      changes.docusignRole = { old: oldVariable.docusignRole, new: docusignRole };
    }
    
    // Update variable
    if (!updateVariable(varId, updates)) {
      return res.status(500).json({ error: 'Failed to update variable' });
    }
    
    // Get updated variable
    const updatedVariables = readVariables();
    const updatedVariable = updatedVariables[varId];
    
    // Log activity
    logActivity('variable:updated', userId || 'system', { 
      varId,
      displayLabel: updatedVariable.displayLabel,
      changes,
      type: updatedVariable.type,
      category: updatedVariable.category,
      platform: (req.body?.platform || req.query?.platform || 'web')
    });
    
    // Broadcast SSE event
    broadcast({ 
      type: 'variable:updated', 
      varId,
      variable: updatedVariable,
      changes: updates,
      userId: userId || 'system'
    });
    
    return res.json({ ok: true, variable: updatedVariable });
  } catch (e) {
    console.error('Error updating variable:', e);
    return res.status(500).json({ error: 'Failed to update variable' });
  }
});

app.delete('/api/v1/variables/:varId', (req, res) => {
  try {
    const { varId } = req.params;
    const { userId } = req.query;
    
    // Check if variable exists
    const existingVariables = readVariables();
    if (!existingVariables[varId]) {
      return res.status(404).json({ error: 'Variable not found' });
    }
    
    const variable = existingVariables[varId];
    
    // Delete variable
    if (!deleteVariable(varId)) {
      return res.status(500).json({ error: 'Failed to delete variable' });
    }
    
    // Log activity
    logActivity('variable:deleted', userId || 'system', { 
      varId,
      displayLabel: variable.displayLabel
    });
    
    // Broadcast SSE event
    broadcast({ 
      type: 'variable:deleted', 
      varId,
      userId: userId || 'system'
    });
    
    return res.json({ ok: true, varId });
  } catch (e) {
    console.error('Error deleting variable:', e);
    return res.status(500).json({ error: 'Failed to delete variable' });
  }
});

// Endpoint specifically for updating just the value
app.put('/api/v1/variables/:varId/value', (req, res) => {
  try {
    const { varId } = req.params;
    const { value, userId } = req.body;
    
    // Check if variable exists
    const existingVariables = readVariables();
    if (!existingVariables[varId]) {
      return res.status(404).json({ error: 'Variable not found' });
    }
    
    const oldValue = existingVariables[varId].value;
    
    // Update just the value
    const updates = {
      value: value !== undefined ? value : '',
      updatedBy: userId || 'system'
    };
    
    if (!updateVariable(varId, updates)) {
      return res.status(500).json({ error: 'Failed to update variable value' });
    }
    
    // Get updated variable
    const updatedVariables = readVariables();
    const updatedVariable = updatedVariables[varId];
    
    // Log activity with specific valueChanged type
    logActivity('variable:valueChanged', userId || 'system', { 
      varId,
      displayLabel: updatedVariable.displayLabel,
      oldValue,
      newValue: value,
      type: updatedVariable.type,
      category: updatedVariable.category,
      platform: (req.body?.platform || req.query?.platform || 'web')
    });
    
    // Broadcast specific SSE event for value changes
    broadcast({ 
      type: 'variable:valueChanged', 
      varId,
      variable: updatedVariable,
      oldValue,
      newValue: value,
      userId: userId || 'system'
    });
    
    return res.json({ ok: true, variable: updatedVariable });
  } catch (e) {
    console.error('Error updating variable value:', e);
    return res.status(500).json({ error: 'Failed to update variable value' });
  }
});

app.get('/api/v1/current-document', (req, res) => {
  const p = resolveDefaultDocPath();
  const exists = fs.existsSync(p);
  res.json({
    id: DOCUMENT_ID,
    filename: 'default.docx',
    filePath: exists ? p : null,
    lastUpdated: serverState.lastUpdated,
    revision: serverState.revision,
  });
});

app.get('/api/v1/state-matrix', (req, res) => {
  const { platform = 'web', userId = 'user1' } = req.query;
  // Derive role from users.json
  const derivedRole = getUserRole(userId);
  const roleMap = loadRoleMap();
  const defaultPerms = { checkout: true, checkin: true, override: true, sendVendor: true };
  const isCheckedOut = !!serverState.checkedOutBy;
  const isOwner = serverState.checkedOutBy === userId;
  // Resolve display label for checked-out user (fallbacks to raw id)
  const checkedOutLabel = resolveUserLabel(serverState.checkedOutBy);
  const canWrite = !isCheckedOut || isOwner;
  const rolePerm = roleMap[derivedRole] || defaultPerms;
  const banner = buildBanner({ isCheckedOut, isOwner, checkedOutBy: checkedOutLabel });
  const approvals = loadApprovals();
  const approvalsSummary = computeApprovalsSummary(approvals.approvers);
  const config = {
    documentId: DOCUMENT_ID,
    documentVersion: serverState.documentVersion,
    title: serverState.title,
    status: serverState.status,
    lastUpdated: serverState.lastUpdated,
    updatedBy: serverState.updatedBy,
    lastSaved: {
      user: serverState.updatedBy || 'Unknown User',
      timestamp: serverState.lastUpdated || 'Unknown Time'
    },
    buttons: {
      replaceDefaultBtn: true,
      checkoutBtn: !!rolePerm.checkout && !isCheckedOut,
      checkinBtn: !!rolePerm.checkin && isOwner,
      cancelBtn: !!rolePerm.checkin && isOwner,
      saveProgressBtn: !!rolePerm.checkin && isOwner,
      overrideBtn: !!rolePerm.override && isCheckedOut && !isOwner,
      sendVendorBtn: !!rolePerm.sendVendor,
      // Always show Back to OpenGov button (client-only UX)
      openGovBtn: true,
      primaryLayout: {
        mode: (!isCheckedOut ? 'not_checked_out' : (isOwner ? 'self' : 'other'))
      }
    },
    
    banner,
    // Ordered banners for rendering in sequence on the client
    banners: (() => {
      const list = [];
      // Skip the generic "available" banner entirely
      if (banner && banner.state && banner.state !== 'available') list.push(banner);
      // Update-notification banner (server compose; client only renders)
      try {
        const clientLoaded = Number(req.query?.clientVersion || 0);
        const requestingUserId = String(req.query?.userId || '');
        const originPlatform = String(req.query?.platform || 'web');
        const lastByUserId = (() => {
          try { return String(serverState.updatedBy && (serverState.updatedBy.id || serverState.updatedBy.userId || serverState.updatedBy)); } catch { return ''; }
        })();
        // Notify if: client has a known version (>0), server advanced, and update was from different user or different platform
        // Treat only clientLoaded <= 0 as unknown/initial. Version 1 is a valid, loaded baseline.
        const clientKnown = Number.isFinite(clientLoaded) && clientLoaded > 0;
        const serverAdvanced = serverState.documentVersion > clientLoaded;
        const updatedByAnother = (!!lastByUserId && requestingUserId && (lastByUserId !== requestingUserId));
        const differentPlatform = !!serverState.updatedPlatform && serverState.updatedPlatform !== originPlatform;
        const shouldNotify = clientKnown && serverAdvanced && (updatedByAnother || differentPlatform);

        if (shouldNotify) {
          const by = serverState.updatedBy && (serverState.updatedBy.label || serverState.updatedBy.userId) || 'someone';
          list.unshift({ state: 'update_available', title: 'Update available', message: `${by} updated this document.` });
        }
      } catch {}
      // Disable viewer-only banner
      return list;
    })(),
    checkoutStatus: { isCheckedOut, checkedOutUserId: serverState.checkedOutBy },
    viewerMessage: isCheckedOut
      ? { type: isOwner ? 'info' : 'warning', text: isOwner ? `Checked out by you` : `Checked out by ${checkedOutLabel}` }
      : { type: 'success', text: 'Available for editing' },
    approvals: { enabled: true, summary: approvalsSummary },
  };
  res.json({ config, revision: serverState.revision });
});

// Theme endpoint: returns style tokens for clients (banner colors, etc.)
app.get('/api/v1/theme', (req, res) => {
  try {
    const themePath = path.join(dataAppDir, 'theme.json');
    if (fs.existsSync(themePath)) {
      const j = JSON.parse(fs.readFileSync(themePath, 'utf8'));
      return res.json(j);
    }
  } catch {}
  return res.json({
    banner: {
      update_available: { bg: '#fecaca', fg: '#0f172a', pillBg: '#fecaca', pillFg: '#0f172a', border: '#000000' },
      final:            { bg: '#7f8ca0', fg: '#ffffff', pillBg: '#7f8ca0', pillFg: '#ffffff' },
      checked_out_self: { bg: '#dce6f4', fg: '#111827', pillBg: '#dce6f4', pillFg: '#111827' },
      checked_out_other:{ bg: '#c6c8ca', fg: '#111827', pillBg: '#c6c8ca', pillFg: '#111827' },
      available:        { bg: '#16a34a', fg: '#ffffff', pillBg: '#166534', pillFg: '#ffffff' },
      // Viewer-only banner (no edit permission)
      view_only: { bg: '#e5e7eb', fg: '#111827', pillBg: '#d1d5db', pillFg: '#111827' }
    },
    pulse: {
      palette: [
        { bg: '#4B3FFF', fg: '#ffffff' },
        { bg: '#FFB636', fg: '#111827' },
        { bg: '#22C55E', fg: '#ffffff' },
        { bg: '#EF4444', fg: '#ffffff' },
        { bg: '#06B6D4', fg: '#0f172a' }
      ],
      minSeconds: 3,
      maxSeconds: 10,
      activeSeconds: 1.5,
      restMinSeconds: 3,
      restMaxSeconds: 10,
      glowAlpha: 0.35
    }
  });
});

app.get('/api/v1/approvals/state', (req, res) => {
  res.json({ documentId: 'default', approvers: [] });
});


// Update document title
app.post('/api/v1/title', (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'invalid_title' });
    serverState.title = title.slice(0, 256);
    // Record who updated the title
    const userId = req.body?.userId || 'user1';
    const platform = (req.body?.platform || req.query?.platform || '').toLowerCase();
    const label = resolveUserLabel(userId) || userId;
    serverState.updatedBy = { userId, label };
    serverState.updatedPlatform = (platform === 'word' || platform === 'web') ? platform : serverState.updatedPlatform;
    serverState.lastUpdated = new Date().toISOString();
    persistState();
    // Bump revision so clients pick up latest state via SSE-driven refresh
    bumpRevision();
    broadcast({ type: 'title', title: serverState.title, userId });
    res.json({ ok: true, title: serverState.title });
  } catch (e) {
    res.status(500).json({ error: 'title_update_failed' });
  }
});

// Cycle status: draft -> review -> final
app.post('/api/v1/status/cycle', (req, res) => {
  try {
    const order = ['draft', 'review', 'final'];
    const cur = String(serverState.status || 'draft').toLowerCase();
    const i = order.indexOf(cur);
    const next = order[(i >= 0 ? (i + 1) % order.length : 0)];
    serverState.status = next;
    serverState.lastUpdated = new Date().toISOString();
    persistState();
    broadcast({ type: 'status', status: next });
    
    // Log activity (skip in test mode)
    if (!testMode) {
      try {
    const userId = req.body?.userId || 'user1';
        const docContext = getDocumentContext();
        logActivity('document:status-change', userId, { 
          from: cur, 
          to: next,
          documentTitle: docContext.title,
          version: docContext.version,
          platform: req.body?.platform || 'web'
        });
      } catch (err) {
        console.error('Error logging status change activity:', err);
      }
    }
    
    res.json({ ok: true, status: next });
  } catch (e) {
    res.status(500).json({ error: 'status_cycle_failed' });
  }
});

app.post('/api/v1/document/upload', upload.single('file'), (req, res) => {
  // Normalize to default.docx working copy when name differs
  const uploaded = req.file?.path;
  if (!uploaded) return res.status(400).json({ error: 'No file' });
  const dest = path.join(workingDocumentsDir, 'default.docx');
  try {
    fs.copyFileSync(uploaded, dest);
    const userId = req.body?.userId || 'user1';
    const platform = req.query?.platform || req.body?.platform || 'web';
    bumpRevision();
    bumpDocumentVersion(userId, platform);
    
    // Log activity (skip in test mode)
    if (!testMode) {
      try {
        const docContext = getDocumentContext();
    logActivity('document:upload', userId, {
      filename: req.file?.originalname || 'default.docx',
      size: req.file?.size,
          documentTitle: docContext.title,
          version: docContext.version,
      platform
    });
      } catch (err) {
        console.error('Error logging upload activity:', err);
      }
    }
    
    broadcast({ type: 'documentUpload', name: 'default.docx' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.post('/api/v1/document/revert', (req, res) => {
  const working = path.join(workingDocumentsDir, 'default.docx');
  if (fs.existsSync(working)) fs.rmSync(working);
  bumpRevision();
  const actorUserId = req.body?.userId || 'system';
  const platform = req.query?.platform || req.body?.platform || null;
  const previousVersion = serverState.documentVersion;
  bumpDocumentVersion(actorUserId, platform);
  const versionNow = serverState.documentVersion;
  // Log activity: document reverted to prior version (new version created) (skip in test mode)
  if (!testMode) {
    try { 
      const docContext = getDocumentContext();
      logActivity('version:restore', actorUserId, { 
        platform, 
        version: versionNow,
        previousVersion,
        documentTitle: docContext.title
      }); 
    } catch (err) {
      console.error('Error logging version restore activity:', err);
    }
  }
  broadcast({ type: 'documentRevert' });
  res.json({ ok: true });
});

// Save progress: write working copy bytes without releasing checkout
app.post('/api/v1/save-progress', (req, res) => {
  try {
    const userId = req.body?.userId || 'user1';
    const platform = (req.body?.platform || req.query?.platform || '').toLowerCase();
    const base64 = req.body?.base64 || '';
    // First validate payload shape to provide precise 4xx on bad input
    let bytes;
    try { bytes = Buffer.from(String(base64), 'base64'); } catch { return res.status(400).json({ error: 'invalid_base64' }); }
    if (!bytes || bytes.length < 4) return res.status(400).json({ error: 'invalid_payload' });
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) return res.status(400).json({ error: 'invalid_docx_magic' });
    if (bytes.length < 1024) return res.status(400).json({ error: 'invalid_docx_small', size: bytes.length });
    // Then enforce document state
    if (!serverState.checkedOutBy) return res.status(409).json({ error: 'Not checked out' });
    if (serverState.checkedOutBy !== userId) {
      const by = resolveUserLabel(serverState.checkedOutBy);
      return res.status(409).json({ error: `Checked out by ${by}` });
    }
    const dest = path.join(workingDocumentsDir, 'default.docx');
    try { fs.writeFileSync(dest, bytes); } catch { return res.status(500).json({ error: 'write_failed' }); }
    bumpRevision();
    bumpDocumentVersion(userId, platform || 'word');
    // Save versioned snapshot and metadata
    try {
      const ver = Number(serverState.documentVersion) || 1;
      const vDoc = path.join(versionsDir, `v${ver}.docx`);
      fs.writeFileSync(vDoc, bytes);
      const meta = { version: ver, savedBy: serverState.updatedBy || { userId, label: userId }, savedAt: new Date().toISOString() };
      fs.writeFileSync(path.join(versionsDir, `v${ver}.json`), JSON.stringify(meta, null, 2));
      broadcast({ type: 'versions:update' });
    } catch {}

    // Log activity (skip in test mode)
    if (!testMode) {
      try {
        const docContext = getDocumentContext();
    logActivity('document:save', userId, {
      autoSave: false,
      size: bytes.length,
          documentTitle: docContext.title,
          version: docContext.version,
          platform: platform || 'word'
    });
      } catch (err) {
        console.error('Error logging save activity:', err);
      }
    }

    broadcast({ type: 'saveProgress', userId, size: bytes.length });
    // Touch title if empty to encourage naming
    if (!serverState.title || serverState.title === 'Redlined & Signed') {
      serverState.title = 'Redlined & Signed';
      persistState();
    }
    return res.json({ ok: true, revision: serverState.revision });
  } catch (e) {
    return res.status(500).json({ error: 'save_progress_failed' });
  }
});

// List versions (newest first) with inferred Version 1
app.get('/api/v1/versions', (req, res) => {
  try {
    const items = [];
    try {
      if (fs.existsSync(versionsDir)) {
        for (const f of fs.readdirSync(versionsDir)) {
          const m = /^v(\d+)\.json$/i.exec(f);
          if (!m) continue;
          const ver = Number(m[1]);
          try { const j = JSON.parse(fs.readFileSync(path.join(versionsDir, f), 'utf8')); items.push({ version: ver, savedBy: j.savedBy || null, savedAt: j.savedAt || null }); } catch {}
        }
      }
    } catch {}
    const hasV1 = items.some(it => Number(it.version) === 1);
    if (!hasV1) items.push({ version: 1, savedBy: { userId: 'system', label: 'System' }, savedAt: serverState.lastUpdated || null });
    items.sort((a, b) => (b.version || 0) - (a.version || 0));
    res.json({ items });
  } catch { res.status(500).json({ error: 'versions_list_failed' }); }
});

// Stream a specific version (1 = canonical; otherwise working snapshot)
app.get('/api/v1/versions/:n', (req, res) => {
  try {
    const n = Number(req.params.n);
    if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'invalid_version' });
    let p = null;
    if (n === 1) p = path.join(canonicalDocumentsDir, 'default.docx');
    else {
      const vDoc = path.join(versionsDir, `v${n}.docx`);
      if (fs.existsSync(vDoc)) {
        p = vDoc;
      } else {
        // If the requested version is the current version and no snapshot exists, serve working document
        const currentVersion = Number(serverState.documentVersion || 1);
        if (n === currentVersion) {
          const workingDoc = path.join(workingDocumentsDir, 'default.docx');
          if (fs.existsSync(workingDoc)) {
            p = workingDoc;
          } else {
            // Fall back to canonical
            p = path.join(canonicalDocumentsDir, 'default.docx');
          }
        }
      }
    }
    if (!p || !fs.existsSync(p)) {
      console.error(`❌ Version ${n} not found. versionsDir: ${versionsDir}, serverState.documentVersion: ${serverState.documentVersion}`);
      return res.status(404).json({ error: 'not_found' });
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    fs.createReadStream(p).pipe(res);
  } catch (e) { 
    console.error('❌ Version stream error:', e.message);
    res.status(500).json({ error: 'version_stream_failed' }); 
  }
});

// Broadcast-only view selection
app.post('/api/v1/versions/view', (req, res) => {
  try {
    const n = Number(req.body?.version);
    if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'invalid_version' });
    const originPlatform = String(req.body?.platform || req.query?.platform || 'web');
    const actorUserId = req.body?.userId || 'user1';
    // Log activity: user viewed a specific version (skip in test mode)
    if (!testMode) {
      try { 
        const docContext = getDocumentContext();
        logActivity('version:view', actorUserId, { 
          version: n, 
          platform: originPlatform,
          documentTitle: docContext.title,
          currentVersion: docContext.version
        }); 
      } catch (err) {
        console.error('Error logging version view activity:', err);
      }
    }
    broadcast({ type: 'version:view', version: n, payload: { version: n, MessagePlatform: originPlatform } });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'version_view_failed' }); }
});

// Approvals API
app.get('/api/v1/approvals', (req, res) => {
  const { approvers, revision } = loadApprovals();
  const summary = computeApprovalsSummary(approvers);
  res.json({ approvers, summary, revision });
});

app.post('/api/v1/approvals/set', (req, res) => {
  try {
    const documentId = req.body?.documentId || DOCUMENT_ID;
    const actorUserId = req.body?.actorUserId || 'user1';
    const targetUserId = req.body?.targetUserId || '';
    const approved = !!req.body?.approved;
    const notes = (req.body?.notes !== undefined) ? String(req.body.notes) : undefined;
    if (documentId !== DOCUMENT_ID) return res.status(400).json({ error: 'invalid_document' });
    const role = getUserRole(actorUserId);
    const canOverride = !!(loadRoleMap()[role] && loadRoleMap()[role].override);
    if (actorUserId !== targetUserId && !canOverride) return res.status(403).json({ error: 'forbidden' });
    const data = loadApprovals();
    const list = data.approvers.map(a => {
      if (a.userId === targetUserId) {
        return { ...a, approved, notes: (notes !== undefined ? notes : a.notes) };
      }
      return a;
    });
    // Normalize order to 1..N
    for (let i = 0; i < list.length; i++) list[i].order = i + 1;
    bumpApprovalsRevision();
    saveApprovals(list);
    const summary = computeApprovalsSummary(list);
    broadcast({ type: 'approvals:update', revision: serverState.approvalsRevision, summary });
    // Log workflow activity with progress and actor info
    const activityType = approved ? 'workflow:approve' : 'workflow:remove-approval';
    logActivity(activityType, actorUserId, { 
      targetUserId, 
      notes, 
      progress: summary,
      actorUserId: actorUserId
    });
    
    // Check if all approvals are complete and trigger celebration
    if (summary.approved === summary.total && summary.total > 0) {
      broadcast({ type: 'approval:complete', completedBy: actorUserId, timestamp: Date.now() });
      // Log workflow completion
      logActivity('workflow:complete', actorUserId, { total: summary.total, approved: summary.approved });
    }
    
    res.json({ approvers: list, summary, revision: serverState.approvalsRevision });
  } catch (e) {
    res.status(500).json({ error: 'approvals_set_failed' });
  }
});

app.post('/api/v1/approvals/reset', (req, res) => {
  try {
    const actorUserId = req.body?.actorUserId || 'system';
    const data = loadApprovals();
    const list = (data.approvers || []).map((a, i) => ({ userId: a.userId, name: a.name, order: i + 1, approved: false, notes: '' }));
    bumpApprovalsRevision();
    saveApprovals(list);
    const summary = computeApprovalsSummary(list);
    broadcast({ type: 'approvals:update', revision: serverState.approvalsRevision, summary, notice: { type: 'reset', by: actorUserId } });
    // Log workflow reset
    logActivity('workflow:reset', actorUserId, {});
    res.json({ approvers: list, summary, revision: serverState.approvalsRevision });
  } catch (e) {
    res.status(500).json({ error: 'approvals_reset_failed' });
  }
});

app.post('/api/v1/approvals/notify', (req, res) => {
  try {
    const actorUserId = req.body?.actorUserId || 'user1';
    const data = loadApprovals();
    const summary = computeApprovalsSummary(data.approvers);
    broadcast({ type: 'approvals:update', revision: serverState.approvalsRevision, summary, notice: { type: 'request_review', by: actorUserId } });
    // Log review request
    logActivity('workflow:request-review', actorUserId, {});
    res.json({ approvers: data.approvers, summary, revision: serverState.approvalsRevision });
  } catch (e) {
    res.status(500).json({ error: 'approvals_notify_failed' });
  }
});

// Snapshot: copy working/canonical default to a timestamped backup
app.post('/api/v1/document/snapshot', (req, res) => {
  const src = resolveDefaultDocPath();
  if (!fs.existsSync(src)) return res.status(404).json({ error: 'default.docx not found' });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const snapDir = path.join(dataWorkingDir, 'snapshots');
  if (!fs.existsSync(snapDir)) fs.mkdirSync(snapDir, { recursive: true });
  const dest = path.join(snapDir, `default-${ts}.docx`);
  try {
    const userId = req.body?.userId || req.query?.userId || 'user1';
    const platform = req.query?.platform || req.body?.platform || 'web';
    
    fs.copyFileSync(src, dest);
    
    // Log activity (skip in test mode)
    if (!testMode) {
      try {
        const docContext = getDocumentContext();
    logActivity('document:snapshot', userId, {
          version: docContext.version,
          documentTitle: docContext.title,
          status: docContext.status,
      platform
    });
      } catch (err) {
        console.error('Error logging snapshot activity:', err);
      }
    }
    
    broadcast({ type: 'snapshot', name: path.basename(dest) });
    res.json({ ok: true, path: dest });
  } catch (e) {
    res.status(500).json({ error: 'Snapshot failed' });
  }
});

// Test mode control: enable/disable SSE broadcasts during automated tests
app.post('/api/v1/test-mode', (req, res) => {
  try {
    const enabled = !!req.body?.enabled;
    testMode = enabled;
    
    if (enabled) {
      // Disconnect all SSE clients to avoid conflicts during tests
      console.log(`🧪 Test mode ENABLED - disconnecting ${sseClients.size} SSE clients`);
      for (const client of sseClients) {
        try { 
          client.write('data: {"type":"test-mode-enabled","message":"Server entering test mode. Please refresh."}\n\n');
          client.end(); 
        } catch {}
      }
      sseClients.clear();
    } else {
      console.log('✅ Test mode DISABLED - SSE broadcasts re-enabled');
    }
    
    res.json({ ok: true, testMode });
  } catch (err) {
    console.error('❌ Test mode toggle failed:', err);
    res.status(500).json({ error: 'Failed to toggle test mode' });
  }
});

// Factory reset: wipe working overlays and reset server state with preset data
app.post('/api/v1/factory-reset', (req, res) => {
  try {
    const userId = req.body?.userId || req.query?.userId || 'system';
    const platform = req.query?.platform || req.body?.platform || 'web';
      const preset = req.body?.preset || req.query?.preset || 'empty';

      console.log(`🔄 [Factory Reset] Starting with preset: ${preset}`);
      console.log(`📦 [Factory Reset] Request body:`, req.body);

      // Validate preset
      const validPresets = ['empty', 'nearly-done', 'initial-vendor'];
      if (!validPresets.includes(preset)) {
        console.error(`❌ [Factory Reset] Invalid preset: ${preset}`);
        return res.status(400).json({ error: `Invalid preset: ${preset}. Must be one of: ${validPresets.join(', ')}` });
      }

      const presetDir = path.join(dataAppDir, 'presets', preset);
      console.log(`📂 [Factory Reset] Preset directory: ${presetDir}`);
      if (!fs.existsSync(presetDir)) {
        console.error(`❌ [Factory Reset] Preset directory not found: ${presetDir}`);
        return res.status(404).json({ error: `Preset directory not found: ${preset}` });
      }

      console.log(`🔄 Factory reset with preset: ${preset}`);
    
    // Log activity BEFORE clearing activity log!
    logActivity('system:scenario-loaded', userId, { platform, preset });
    
    // Remove working document overlay first
    const wDoc = path.join(workingDocumentsDir, 'default.docx');
    if (fs.existsSync(wDoc)) fs.rmSync(wDoc);
    
    // Check if preset has a custom document and copy it
    const presetDocFile = path.join(presetDir, 'default.docx');
    if (fs.existsSync(presetDocFile)) {
      try {
        if (!fs.existsSync(workingDocumentsDir)) fs.mkdirSync(workingDocumentsDir, { recursive: true });
        fs.copyFileSync(presetDocFile, wDoc);
        console.log(`✅ Loaded preset document: ${preset}`);
      } catch (e) {
        console.error(`❌ Failed to copy preset document:`, e.message);
      }
    } else {
      console.log(`ℹ️  No preset document found - will use canonical default.docx`);
    }
    
    // Remove exhibits overlays
    if (fs.existsSync(workingExhibitsDir)) {
      for (const f of fs.readdirSync(workingExhibitsDir)) {
        const p = path.join(workingExhibitsDir, f);
        try { if (fs.statSync(p).isFile()) fs.rmSync(p); } catch {}
      }
    }
    // Handle approvals: copy from preset or clear
    const presetApprovalsFile = path.join(presetDir, 'approvals.json');
    if (fs.existsSync(presetApprovalsFile)) {
      try {
        fs.copyFileSync(presetApprovalsFile, approvalsFilePath);
        const approvals = JSON.parse(fs.readFileSync(approvalsFilePath, 'utf8'));
        console.log(`✅ Loaded approvals from preset: ${preset} (${approvals.approvers?.length || 0} approvers)`);
      } catch (e) {
        console.error(`❌ Failed to copy preset approvals:`, e.message);
      }
    } else {
      // Clear approvals data if no preset
      try { if (fs.existsSync(approvalsFilePath)) fs.rmSync(approvalsFilePath); } catch {}
      console.log(`ℹ️  No preset approvals found - cleared approvals`);
    }
    bumpApprovalsRevision();
    
    // Load preset files
    const presetStateFile = path.join(presetDir, 'state.json');
    const presetActivityFile = path.join(presetDir, 'activity-log.json');
    const presetMessagesFile = path.join(presetDir, 'messages.json');
    const presetFieldsFile = path.join(presetDir, 'fields.json');
    
    // Copy preset state
    if (fs.existsSync(presetStateFile)) {
      const presetState = JSON.parse(fs.readFileSync(presetStateFile, 'utf8'));
      serverState.checkedOutBy = presetState.checkedOutBy || null;
      serverState.documentVersion = presetState.documentVersion || 1;
      serverState.title = presetState.title || 'Redlined & Signed';
      serverState.status = presetState.status || 'draft';
      serverState.updatedBy = presetState.updatedBy || null;
      serverState.updatedPlatform = presetState.updatedPlatform || null;
      serverState.lastUpdated = new Date().toISOString();
      console.log(`✅ Loaded state from preset: ${preset}`);
      console.log(`📊 [Factory Reset] New serverState:`, { title: serverState.title, status: serverState.status, documentVersion: serverState.documentVersion });
    } else {
      console.error(`❌ [Factory Reset] State file not found: ${presetStateFile}`);
      // Fallback to default state
      serverState.checkedOutBy = null;
      serverState.documentVersion = 1;
      serverState.title = 'Redlined & Signed';
      serverState.status = 'draft';
      serverState.updatedBy = null;
      serverState.updatedPlatform = null;
      serverState.lastUpdated = new Date().toISOString();
    }
    
    // Persist state to disk
    persistState();
    console.log(`💾 [Factory Reset] State persisted to disk`);
    
    // Copy preset activity log
    if (fs.existsSync(presetActivityFile)) {
      fs.copyFileSync(presetActivityFile, activityLogFilePath);
      const activityCount = JSON.parse(fs.readFileSync(activityLogFilePath, 'utf8')).length;
      console.log(`✅ Loaded activity log from preset: ${preset} (${activityCount} items)`);
    } else {
      console.error(`❌ [Factory Reset] Activity log file not found: ${presetActivityFile}`);
    // Clear activity log
    try { if (fs.existsSync(activityLogFilePath)) fs.rmSync(activityLogFilePath); } catch {}
    }
    
    // Copy preset messages
    if (fs.existsSync(presetMessagesFile)) {
      fs.copyFileSync(presetMessagesFile, messagesFilePath);
      const msgs = JSON.parse(fs.readFileSync(messagesFilePath, 'utf8'));
      console.log(`✅ Loaded messages from preset: ${preset} (${msgs.messages?.length || 0} messages, ${msgs.posts?.length || 0} posts)`);
    } else {
      console.error(`❌ [Factory Reset] Messages file not found: ${presetMessagesFile}`);
      // Clear messages
    try { if (fs.existsSync(messagesFilePath)) fs.rmSync(messagesFilePath); } catch {}
    }
    
    // Copy preset fields
    if (fs.existsSync(presetFieldsFile)) {
      fs.copyFileSync(presetFieldsFile, fieldsFilePath);
      const fields = JSON.parse(fs.readFileSync(fieldsFilePath, 'utf8'));
      console.log(`✅ Loaded fields from preset: ${preset} (${Object.keys(fields).length} fields)`);
    } else {
      console.error(`❌ [Factory Reset] Fields file not found: ${presetFieldsFile}`);
      // Clear fields
      try { if (fs.existsSync(fieldsFilePath)) fs.rmSync(fieldsFilePath); } catch {}
    }
    
    // Copy preset chat history
    const presetChatFile = path.join(presetDir, 'chat.json');
    if (fs.existsSync(presetChatFile)) {
      fs.copyFileSync(presetChatFile, chatFilePath);
      const chat = JSON.parse(fs.readFileSync(chatFilePath, 'utf8'));
      const userCount = Object.keys(chat).length;
      console.log(`✅ Loaded chat history from preset: ${preset} (${userCount} users)`);
    } else {
      console.error(`❌ [Factory Reset] Chat file not found: ${presetChatFile}`);
      // Clear chat history
      try { if (fs.existsSync(chatFilePath)) fs.rmSync(chatFilePath); } catch {}
    }
    
    // Restore variables: check for preset-specific variables first, fall back to seed
    const presetVariablesFile = path.join(presetDir, 'variables.json');
    const variablesSeedPath = path.join(dataAppDir, 'variables.seed.json');
    try {
      if (fs.existsSync(presetVariablesFile)) {
        fs.copyFileSync(presetVariablesFile, variablesFilePath);
        const vars = JSON.parse(fs.readFileSync(variablesFilePath, 'utf8'));
        console.log(`✅ Variables loaded from preset: ${preset} (${Object.keys(vars).length} variables)`);
      } else if (fs.existsSync(variablesSeedPath)) {
        fs.copyFileSync(variablesSeedPath, variablesFilePath);
        console.log('✅ Variables restored from seed data (no preset-specific variables)');
      } else {
        console.error('❌ No variables file found! Variables will be empty.');
        if (fs.existsSync(variablesFilePath)) {
          fs.rmSync(variablesFilePath);
        }
      }
    } catch (e) {
      console.error('❌ Failed to restore variables:', e.message);
    }
    
    // Remove snapshots entirely
    const snapDir = path.join(dataWorkingDir, 'snapshots');
    if (fs.existsSync(snapDir)) {
      try { fs.rmSync(snapDir, { recursive: true, force: true }); } catch {}
    }
    // Clear compiled outputs (merged PDFs)
    if (fs.existsSync(compiledDir)) {
      try {
        for (const f of fs.readdirSync(compiledDir)) {
          const p = path.join(compiledDir, f);
          try { if (fs.statSync(p).isFile()) fs.rmSync(p); } catch {}
        }
      } catch {}
    }
    // Handle version history: check for preset versions, otherwise clear all
    try {
      // First, clear existing versions
      if (fs.existsSync(versionsDir)) {
        try { fs.rmSync(versionsDir, { recursive: true, force: true }); } catch {}
      }
      if (!fs.existsSync(versionsDir)) fs.mkdirSync(versionsDir, { recursive: true });
      
      // Check if preset has version snapshots and copy them
      const presetVersionsDir = path.join(presetDir, 'versions');
      if (fs.existsSync(presetVersionsDir)) {
        const versionFiles = fs.readdirSync(presetVersionsDir);
        let copiedCount = 0;
        for (const vFile of versionFiles) {
          if (vFile.endsWith('.docx') || vFile.endsWith('.json')) {
            const srcPath = path.join(presetVersionsDir, vFile);
            const destPath = path.join(versionsDir, vFile);
            try {
              fs.copyFileSync(srcPath, destPath);
              if (vFile.endsWith('.docx')) copiedCount++;
            } catch (e) {
              console.error(`❌ Failed to copy version ${vFile}:`, e.message);
            }
          }
        }
        if (copiedCount > 0) {
          console.log(`✅ Loaded ${copiedCount} version snapshot(s) from preset: ${preset}`);
        }
      } else {
        console.log(`ℹ️  No preset version snapshots found - version history will be empty`);
      }
    } catch (e) {
      console.error('❌ Failed to handle version history:', e.message);
    }
    
    bumpRevision();
    persistState();
    broadcast({ type: 'factoryReset', preset });
    broadcast({ type: 'documentRevert' });
    // Notify clients to clear local messaging state
    broadcast({ type: 'messaging:reset' });
    // Notify clients to clear activity state
    broadcast({ type: 'activity:reset' });
    // Notify all clients to clear AI chat state
    broadcast({ type: 'chat:reset', payload: { all: true } });
    // Notify clients to clear variables
    broadcast({ type: 'variables:reset' });
    // Notify clients that versions list changed (emptied)
    broadcast({ type: 'versions:update' });
    const approvals = loadApprovals();
    broadcast({ type: 'approvals:update', revision: serverState.approvalsRevision, summary: computeApprovalsSummary(approvals.approvers) });
    return res.json({ ok: true, preset });
  } catch (e) {
    console.error('Factory reset error:', e);
    return res.status(500).json({ error: 'Factory reset failed', details: e.message });
  }
});

// ============================================================================
// Scenarios API - User-created scenario management
// ============================================================================

// Helper: Generate URL-safe slug from scenario name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '')     // Remove non-alphanumeric except hyphens
    .replace(/-+/g, '-')            // Collapse multiple hyphens
    .replace(/^-|-$/g, '')          // Trim leading/trailing hyphens
    .substring(0, 50);              // Truncate to 50 chars
}

// POST /api/v1/scenarios/save - Save current state as a named scenario
app.post('/api/v1/scenarios/save', (req, res) => {
  try {
    const { name, description = '', userId = 'user1' } = req.body || {};
    
    // Validation
    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return res.status(400).json({ error: 'Scenario name required (min 3 characters)' });
    }
    if (name.length > 50) {
      return res.status(400).json({ error: 'Scenario name too long (max 50 characters)' });
    }
    if (description && description.length > 200) {
      return res.status(400).json({ error: 'Description too long (max 200 characters)' });
    }
    
    // Generate slug
    const slug = generateSlug(name);
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return res.status(400).json({ error: 'Invalid scenario name - must contain alphanumeric characters' });
    }
    
    // Check reserved slugs
    const reservedSlugs = ['empty', 'nearly-done'];
    if (reservedSlugs.includes(slug)) {
      return res.status(400).json({ error: `Scenario name '${name}' is reserved` });
    }
    
    // Check if scenario already exists
    const scenariosDir = path.join(dataAppDir, 'scenarios');
    const scenarioDir = path.join(scenariosDir, slug);
    if (fs.existsSync(scenarioDir)) {
      return res.status(409).json({ error: `Scenario '${name}' already exists` });
    }
    
    // Create scenarios directory if it doesn't exist
    if (!fs.existsSync(scenariosDir)) {
      fs.mkdirSync(scenariosDir, { recursive: true });
    }
    
    // Create scenario directory
    fs.mkdirSync(scenarioDir, { recursive: true });
    
    // Copy all state files from data/app
    const filesToCopy = [
      'state.json',
      'activity-log.json',
      'messages.json',
      'chat.json',
      'fields.json',
      'variables.json',
      'approvals.json'
    ];
    
    for (const file of filesToCopy) {
      const srcPath = path.join(dataAppDir, file);
      const destPath = path.join(scenarioDir, file);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
    
    // Copy working document
    const workingDoc = path.join(workingDocumentsDir, 'default.docx');
    const destDoc = path.join(scenarioDir, 'default.docx');
    if (fs.existsSync(workingDoc)) {
      fs.copyFileSync(workingDoc, destDoc);
    } else {
      // Fallback to canonical
      const canonicalDoc = path.join(dataAppDir, 'documents', 'default.docx');
      if (fs.existsSync(canonicalDoc)) {
        fs.copyFileSync(canonicalDoc, destDoc);
      }
    }
    
    // Copy versions directory
    const versionsDestDir = path.join(scenarioDir, 'versions');
    if (!fs.existsSync(versionsDestDir)) {
      fs.mkdirSync(versionsDestDir, { recursive: true });
    }
    if (fs.existsSync(versionsDir)) {
      const versionFiles = fs.readdirSync(versionsDir);
      for (const vFile of versionFiles) {
        if (vFile.endsWith('.docx') || vFile.endsWith('.json')) {
          const srcPath = path.join(versionsDir, vFile);
          const destPath = path.join(versionsDestDir, vFile);
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }
    
    // Get user info
    const users = loadUsers();
    const user = users.find(u => u.id === userId) || { id: userId, label: 'Unknown User' };
    
    // Calculate stats
    const stats = {};
    try {
      const activityLog = JSON.parse(fs.readFileSync(path.join(scenarioDir, 'activity-log.json'), 'utf8'));
      stats.activities = activityLog.length;
    } catch {}
    try {
      const messages = JSON.parse(fs.readFileSync(path.join(scenarioDir, 'messages.json'), 'utf8'));
      stats.messages = messages.messages?.length || 0;
    } catch {}
    try {
      const variables = JSON.parse(fs.readFileSync(path.join(scenarioDir, 'variables.json'), 'utf8'));
      stats.variables = Object.keys(variables).length;
    } catch {}
    try {
      const approvals = JSON.parse(fs.readFileSync(path.join(scenarioDir, 'approvals.json'), 'utf8'));
      stats.approvals = approvals.approvers?.filter(a => a.approved).length || 0;
    } catch {}
    try {
      if (fs.existsSync(versionsDestDir)) {
        const vFiles = fs.readdirSync(versionsDestDir).filter(f => f.endsWith('.docx'));
        stats.versions = vFiles.length;
      }
    } catch {}
    
    // Create metadata.json
    const metadata = {
      id: slug,
      name: name.trim(),
      description: description.trim(),
      slug,
      created: new Date().toISOString(),
      createdBy: {
        userId: user.id,
        label: user.label
      },
      lastUsed: null,
      stats
    };
    
    fs.writeFileSync(
      path.join(scenarioDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf8'
    );
    
    // Log activity
    logActivity('system:scenario-saved', userId, { scenarioName: name, slug });
    
    console.log(`✅ Saved scenario: ${name} (${slug})`);
    
    return res.json({
      ok: true,
      scenario: {
        id: slug,
        label: name,
        description,
        created: metadata.created
      }
    });
    
  } catch (e) {
    console.error('Error saving scenario:', e);
    return res.status(500).json({ error: 'Failed to save scenario', details: e.message });
  }
});

// GET /api/v1/scenarios - List all scenarios (presets + user-saved)
app.get('/api/v1/scenarios', (req, res) => {
  try {
    // Load presets
    const presets = [
      {
        id: 'empty',
        label: 'Factory Reset',
        description: 'Reset to blank slate with 20 pre-populated signature/value variables.',
        type: 'preset'
      },
      {
        id: 'nearly-done',
        label: 'Almost Done',
        description: '90% complete negotiation with messages, variables, versions, and approvals.',
        type: 'preset'
      }
    ];
    
    // Load user scenarios
    const scenarios = [];
    const scenariosDir = path.join(dataAppDir, 'scenarios');
    
    if (fs.existsSync(scenariosDir)) {
      const dirs = fs.readdirSync(scenariosDir);
      for (const dir of dirs) {
        const metadataPath = path.join(scenariosDir, dir, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
          try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            scenarios.push({
              id: metadata.id || dir,
              label: metadata.name,
              description: metadata.description || '',
              created: metadata.created,
              lastUsed: metadata.lastUsed,
              type: 'user',
              stats: metadata.stats || {}
            });
          } catch (e) {
            console.error(`Error reading scenario metadata: ${dir}`, e);
          }
        }
      }
    }
    
    // Sort user scenarios by created date (newest first)
    scenarios.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    return res.json({ presets, scenarios });
    
  } catch (e) {
    console.error('Error listing scenarios:', e);
    return res.status(500).json({ error: 'Failed to list scenarios', details: e.message });
  }
});

// DELETE /api/v1/scenarios/:id - Delete a user-saved scenario
app.delete('/api/v1/scenarios/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { userId = 'user1' } = req.query;
    
    // Prevent deleting presets
    const reservedIds = ['empty', 'nearly-done'];
    if (reservedIds.includes(id)) {
      return res.status(403).json({ error: 'Cannot delete preset scenarios' });
    }
    
    // Check if scenario exists
    const scenariosDir = path.join(dataAppDir, 'scenarios');
    const scenarioDir = path.join(scenariosDir, id);
    
    if (!fs.existsSync(scenarioDir)) {
      return res.status(404).json({ error: 'Scenario not found' });
    }
    
    // Read metadata for logging
    let scenarioName = id;
    try {
      const metadata = JSON.parse(fs.readFileSync(path.join(scenarioDir, 'metadata.json'), 'utf8'));
      scenarioName = metadata.name || id;
    } catch {}
    
    // Delete the directory
    fs.rmSync(scenarioDir, { recursive: true, force: true });
    
    // Log activity
    logActivity('system:scenario-deleted', userId, { scenarioName, slug: id });
    
    console.log(`✅ Deleted scenario: ${scenarioName} (${id})`);
    
    return res.json({ ok: true });
    
  } catch (e) {
    console.error('Error deleting scenario:', e);
    return res.status(500).json({ error: 'Failed to delete scenario', details: e.message });
  }
});

// Checkout/Checkin endpoints
app.post('/api/v1/checkout', (req, res) => {
  const userId = req.body?.userId || 'user1';
  const clientVersion = req.body?.clientVersion || 0;
  
  if (serverState.checkedOutBy && serverState.checkedOutBy !== userId) {
    return res.status(409).json({ error: `Already checked out by ${serverState.checkedOutBy}` });
  }
  
  // Check if client is on current version
  const currentVersion = serverState.documentVersion || 1;
  const isOutdated = clientVersion < currentVersion;
  
  if (isOutdated && !req.body?.forceCheckout) {
    return res.status(409).json({ 
      error: 'version_outdated', 
      currentVersion, 
      clientVersion,
      message: 'Document has been updated. Do you want to check out the most recent version?'
    });
  }
  
  serverState.checkedOutBy = userId;
  serverState.checkedOutByAt = Date.now(); // Track checkout time
  serverState.lastUpdated = new Date().toISOString();
  persistState();

  // Log activity (skip in test mode)
  if (!testMode) {
    try {
      const docContext = getDocumentContext();
      logActivity('document:checkout', userId, {
        documentTitle: docContext.title,
        version: docContext.version,
        status: docContext.status,
        platform: req.body?.platform || 'web'
      });
    } catch (err) {
      console.error('Error logging checkout activity:', err);
      // Don't fail the request if logging fails
    }
  }

  broadcast({ type: 'checkout', userId });
  res.json({ ok: true, checkedOutBy: userId });
});

app.post('/api/v1/checkin', (req, res) => {
  const userId = req.body?.userId || 'user1';
  if (!serverState.checkedOutBy) {
    return res.status(409).json({ error: 'Not checked out' });
  }
  if (serverState.checkedOutBy !== userId) {
    const by = resolveUserLabel(serverState.checkedOutBy);
    return res.status(409).json({ error: `Checked out by ${by}` });
  }
  // Calculate checkout duration
  const checkoutDuration = serverState.checkedOutByAt 
    ? Math.round((Date.now() - serverState.checkedOutByAt) / 1000 / 60) // minutes
    : null;
  const durationText = checkoutDuration 
    ? checkoutDuration < 60 
      ? `${checkoutDuration} min${checkoutDuration !== 1 ? 's' : ''}` 
      : `${Math.round(checkoutDuration / 60)} hr${Math.round(checkoutDuration / 60) !== 1 ? 's' : ''}`
    : null;

  serverState.checkedOutBy = null;
  serverState.checkedOutByAt = null;
  serverState.lastUpdated = new Date().toISOString();
  persistState();

  // Log activity (skip in test mode)
  if (!testMode) {
    try {
      const docContext = getDocumentContext();
  logActivity('document:checkin', userId, {
        documentTitle: docContext.title,
        version: docContext.version,
        checkoutDuration: durationText,
        platform: req.body?.platform || 'web'
  });
    } catch (err) {
      console.error('Error logging checkin activity:', err);
      // Don't fail the request if logging fails
    }
  }

  broadcast({ type: 'checkin', userId });
  res.json({ ok: true });
});

// Cancel checkout: release lock without any additional actions
app.post('/api/v1/checkout/cancel', (req, res) => {
  const userId = req.body?.userId || 'user1';
  if (!serverState.checkedOutBy) {
    return res.status(409).json({ error: 'Not checked out' });
  }
  if (serverState.checkedOutBy !== userId) {
    const by = resolveUserLabel(serverState.checkedOutBy);
    return res.status(409).json({ error: `Checked out by ${by}` });
  }
  serverState.checkedOutBy = null;
  serverState.checkedOutByAt = null;
  serverState.lastUpdated = new Date().toISOString();
  persistState();

  // Log activity (skip in test mode)
  if (!testMode) {
    try {
      const docContext = getDocumentContext();
      logActivity('document:checkout:cancel', userId, {
        documentTitle: docContext.title,
        version: docContext.version,
        platform: req.body?.platform || 'web'
      });
    } catch (err) {
      console.error('Error logging cancel activity:', err);
      // Don't fail the request if logging fails
    }
  }

  broadcast({ type: 'checkoutCancel', userId });
  res.json({ ok: true });
});

// Override checkout (admin/editor capability): forcefully take ownership
app.post('/api/v1/checkout/override', (req, res) => {
  const userId = req.body?.userId || 'user1';
  const derivedRole = getUserRole(userId);
  const roleMap = loadRoleMap();
  const canOverride = !!(roleMap[derivedRole] && roleMap[derivedRole].override);
  // finalization removed
  if (!canOverride) return res.status(403).json({ error: 'Forbidden' });
  // Override: clear any existing checkout, reverting to Available to check out
  if (serverState.checkedOutBy) {
    const previousUserId = serverState.checkedOutBy;
    serverState.checkedOutBy = null;
    serverState.checkedOutByAt = null;
    serverState.lastUpdated = new Date().toISOString();
    persistState();
    
    // Log activity (skip in test mode)
    if (!testMode) {
      try { 
        const docContext = getDocumentContext();
        logActivity('document:checkout:override', userId, { 
          previousUserId,
          documentTitle: docContext.title,
          version: docContext.version,
          platform: req.body?.platform || 'web'
        }); 
      } catch (err) {
        console.error('Error logging override activity:', err);
      }
    }
    
    broadcast({ type: 'overrideCheckout', userId });
    return res.json({ ok: true, checkedOutBy: null });
  }
  // Nothing to clear; already available
  return res.json({ ok: true, checkedOutBy: null });
});

// API endpoint to refresh document context
app.post('/api/v1/refresh-document', async (req, res) => {
  try {
    await loadDocumentContext();
    res.json({
      ok: true,
      message: 'Document context refreshed',
      lastModified: DOCUMENT_LAST_MODIFIED ? new Date(DOCUMENT_LAST_MODIFIED).toLocaleString() : null,
      contextLength: DOCUMENT_CONTEXT.length
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Version comparison (Phase 0: plain text diff) - Word-first
app.post('/api/v1/versions/compare', async (req, res) => {
  try {
    const versionA = Number(req.body?.versionA);
    const versionB = Number(req.body?.versionB);
    if (!Number.isFinite(versionA) || !Number.isFinite(versionB)) {
      return res.status(400).json({ error: 'invalid_versions' });
    }

    const DiffMatchPatch = require('diff-match-patch');
    const mammoth = require('mammoth');

    async function getDocxPath(v) {
      const p = (v === 1)
        ? path.join(canonicalDocumentsDir, 'default.docx')
        : path.join(versionsDir, `v${v}.docx`);
      return p;
    }

    async function extractPlainText(filePath) {
      try {
        if (!filePath || !fs.existsSync(filePath)) return '';
        const result = await mammoth.extractRawText({ path: filePath });
        return String(result && result.value ? result.value : '').trim();
      } catch {
        return '';
      }
    }

    const pathA = await getDocxPath(versionA);
    const pathB = await getDocxPath(versionB);
    const [textA, textB] = await Promise.all([
      extractPlainText(pathA),
      extractPlainText(pathB)
    ]);

    const dmp = new DiffMatchPatch();
    const diffs = dmp.diff_main(String(textA || ''), String(textB || ''));
    try { dmp.diff_cleanupSemantic(diffs); } catch {}

    // Build concise difference entries
    const differences = [];
    let id = 1;
    let aIndex = 0; // cursor in A
    let bIndex = 0; // cursor in B
    const STR_A = String(textA || '');
    const STR_B = String(textB || '');
    const CONTEXT = 80;
    const AVG_CHARS_PER_PAGE = Number(process.env.DIFF_AVG_CHARS_PER_PAGE || 1200);
    const PARAS_PER_PAGE = Number(process.env.DIFF_PARAS_PER_PAGE || 8);
    function estimatePageNumberFromIndex(index, baseStr) {
      try {
        const byChars = AVG_CHARS_PER_PAGE > 0 ? (Math.floor(index / AVG_CHARS_PER_PAGE) + 1) : 1;
        const upto = String(baseStr || '').slice(0, Math.max(0, index));
        const breaks = upto.match(/(?:\r?\n\s*\r?\n)+/g);
        const paraCount = 1 + (breaks ? breaks.length : 0);
        const byParas = PARAS_PER_PAGE > 0 ? (Math.floor((paraCount - 1) / PARAS_PER_PAGE) + 1) : 1;
        return Math.max(byChars, byParas);
      } catch { return 1; }
    }
    for (const [op, chunk] of diffs) {
      const piece = String(chunk || '');
      const pieceLen = piece.length;
      if (op === 0) {
        aIndex += pieceLen;
        bIndex += pieceLen;
        continue;
      }
      const type = op; // -1 deletion, 1 insertion
      const isInsert = (type === 1);
      const isDelete = (type === -1);
      const baseIndex = isInsert ? bIndex : aIndex;
      const baseStr = isInsert ? STR_B : STR_A;
      const contextBefore = baseStr.slice(Math.max(0, baseIndex - CONTEXT), baseIndex);
      const contextAfter = baseStr.slice(baseIndex + pieceLen, baseIndex + pieceLen + CONTEXT);
      const snippet = piece.replace(/\s+/g, ' ').slice(0, 300);
      if (snippet) {
        differences.push({
          id: id++,
          type,
          text: snippet,
          pageNumber: estimatePageNumberFromIndex(baseIndex, baseStr),
          summary: (type === 1 ? 'Added' : 'Removed') + ' text',
          position: baseIndex,
          targetVersion: (type === 1 ? Number(versionB) : Number(versionA)),
          contextBefore,
          contextAfter
        });
        if (differences.length >= 50) break;
      }
      if (isInsert) {
        bIndex += pieceLen;
      } else if (isDelete) {
        aIndex += pieceLen;
      }
    }

    const debug = {
      pathA,
      pathB,
      existsA: !!(pathA && fs.existsSync(pathA)),
      existsB: !!(pathB && fs.existsSync(pathB)),
      lengthA: (textA || '').length,
      lengthB: (textB || '').length,
      diffs: differences.length
    };
    try {
      console.log('[versions/compare] A vs B:', versionA, versionB, '| paths:', pathA, pathB, '| diffs:', differences.length, '| lenA:', debug.lengthA, '| lenB:', debug.lengthB);
    } catch {}
    const includeDebug = String(req.query?.debug || req.body?.debug || '').toLowerCase() === 'true';
    const base = { versionA, versionB, differences };
    if (!differences.length) base.message = 'These versions are identical';
    return res.json(includeDebug ? Object.assign({}, base, { debug }) : base);
  } catch (e) {
    try { console.error('[versions/compare] failed:', e && e.message ? e.message : e); } catch {}
    return res.status(500).json({ error: 'compare_failed' });
  }
});

// Document navigation request → broadcast SSE for clients (Word add-in will handle)
app.post('/api/v1/document/navigate', async (req, res) => {
  try {
    const { text, changeType, position, contextBefore, contextAfter, targetVersion } = req.body || {};
    const cleanText = String(text || '').replace(/<[^>]*>/g, '').slice(0, 500);
    const payload = {
      text: cleanText,
      changeType: (changeType === 'addition' || changeType === 'deletion' || changeType === 'change') ? changeType : 'change',
      position: Number.isFinite(Number(position)) ? Number(position) : undefined,
      contextBefore: String(contextBefore || ''),
      contextAfter: String(contextAfter || ''),
      targetVersion: Number.isFinite(Number(targetVersion)) ? Number(targetVersion) : undefined,
      platform: 'word'
    };
    try { console.log('[document:navigate] broadcast', { len: cleanText.length, changeType, position, hasCtx: !!(payload.contextBefore || payload.contextAfter) }); } catch {}
    broadcast({ type: 'document:navigate', payload });
    return res.json({ ok: true });
  } catch (e) {
    try { console.error('document:navigate failed:', e && e.message ? e.message : e); } catch {}
    return res.status(500).json({ ok: false, error: 'navigate_failed' });
  }
});

// Client-originated events (prototype): accept and rebroadcast for parity
app.post('/api/v1/events/client', async (req, res) => {
  try {
    const { type = 'clientEvent', payload: rawPayload = {}, userId = 'user1', platform = 'web' } = req.body || {};
    const role = getUserRole(userId);
    const originPlatform = String(platform || 'web');
    const payload = (function(){
      const p = Object.assign({}, rawPayload);
      if (type === 'chat') {
        // Ensure platform-scoped Messages by tagging payload
        p.MessagePlatform = originPlatform;
      }
      return p;
    })();
    broadcast({ type, payload, userId, role, platform: originPlatform });

    // Extract text early for saving
    const text = String(payload?.text || '').trim();

    // Save AI chat messages to server
    if (type === 'chat' && text) {
      try {
        const message = `[${userId}] ${text}`;
        saveChatMessage(userId, message);
      } catch {}
    }

    if (type === 'chat' && text) {
      try {
        const systemPrompt = await getSystemPrompt();
        const result = await generateReply({ messages: [{ role: 'user', content: text }], systemPrompt });
        if (result && result.ok && result.content) {
          const replyText = String(result.content).trim();
            broadcast({
              type: 'chat',
            payload: { text: replyText, MessagePlatform: originPlatform },
              userId: 'bot',
              role: 'assistant',
              platform: 'server'
            });
            // Save bot reply to chat history
            try {
              const botMessage = `[bot] ${replyText}`;
              saveChatMessage(userId, botMessage);
            } catch {}
        } else {
          const msg = `LLM error: ${result && result.error ? result.error : 'Unknown error'}`;
          logActivity('system:error', 'system', { error: msg, source: 'llm' });
        }
      } catch (e) {
        const msg = `LLM error: ${e && e.message ? e.message : 'Unknown error'}`;
        logActivity('system:error', 'system', { error: msg, source: 'llm' });
      }
    } else if (type === 'chat:stop') {
      try { broadcast({ type: 'chat:reset', payload: { reason: 'user_stop', MessagePlatform: originPlatform }, userId, role: 'assistant', platform: 'server' }); } catch {}
    }

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'events_client_failed' });
  }
});

// Helper function for fallback scripted responses
function getFallbackResponse(userId) {
        const cfg = loadChatbotResponses();
  if (!cfg || !Array.isArray(cfg.messages) || !cfg.messages.length) {
    return 'Hello! How can I help you with your document today?';
  }

          const list = cfg.messages;
          const mode = (cfg.policy && cfg.policy.mode) || 'sequential';
          let pick = '';

          if (mode === 'sequential') {
            const key = String(userId || 'default');
            const current = chatbotStateByUser.get(key) || 0;
            const i = current % list.length;
            const next = current + 1;
            const loop = (cfg.policy && cfg.policy.loop) !== false;
            chatbotStateByUser.set(key, loop ? next : Math.min(next, list.length));
            pick = list[i];
          } else {
            pick = list[Math.floor(Math.random() * list.length)];
          }

  return pick ? String(pick) : 'Hello! How can I help you with your document today?';
}

// Chatbot: reset per-user scripted index (so sessions start from first message)
app.post('/api/v1/chatbot/reset', (req, res) => {
  try {
    const key = String(req.body?.userId || 'default');
    const originPlatform = String(req.body?.platform || 'web');
    chatbotStateByUser.delete(key);
    // Delete chat history from server
    resetUserChat(key);
    try { broadcast({ type: 'chat:reset', payload: { MessagePlatform: originPlatform }, userId: key, role: 'assistant', platform: 'server' }); } catch {}
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'reset_failed' });
  }
});

// System Prompt Editor API
app.get('/api/v1/chat/system-prompt', (req, res) => {
  try {
    const customPromptPath = path.join(dataAppDir, 'config', 'system-prompt.txt');
    let prompt = '';
    let hasCustom = false;
    
    if (fs.existsSync(customPromptPath)) {
      try {
        prompt = fs.readFileSync(customPromptPath, 'utf8');
        hasCustom = true;
      } catch {}
    }
    
    if (!prompt) {
      // Return default prompt with placeholder
      prompt = DEFAULT_SYSTEM_PROMPT;
    }
    
    const contextPreview = DOCUMENT_CONTEXT.slice(0, 500) + (DOCUMENT_CONTEXT.length > 500 ? '...' : '');
    
    res.json({ 
      prompt,
      hasCustom,
      documentContextPreview: contextPreview
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load system prompt' });
  }
});

app.post('/api/v1/chat/system-prompt', (req, res) => {
  try {
    const { prompt } = req.body || {};
    
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 10) {
      return res.status(400).json({ error: 'Prompt must be at least 10 characters' });
    }
    
    if (prompt.length > 2000) {
      return res.status(400).json({ error: 'Prompt too long (max 2000 characters)' });
    }
    
    const customPromptPath = path.join(dataAppDir, 'config', 'system-prompt.txt');
    const configDir = path.dirname(customPromptPath);
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(customPromptPath, prompt.trim(), 'utf8');
    
    // Log activity
    logActivity('system:prompt-update', req.body?.userId || 'system', { 
      promptLength: prompt.trim().length 
    });
    
    res.json({ ok: true, prompt: prompt.trim() });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save system prompt' });
  }
});

app.post('/api/v1/chat/system-prompt/reset', (req, res) => {
  try {
    const customPromptPath = path.join(dataAppDir, 'config', 'system-prompt.txt');
    
    if (fs.existsSync(customPromptPath)) {
      fs.unlinkSync(customPromptPath);
    }
    
    // Log activity
    logActivity('system:prompt-reset', req.body?.userId || 'system', {});
    
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to reset system prompt' });
  }
});

app.get('/api/v1/exhibits', (req, res) => {
  res.json({ items: listExhibits() });
});

app.post('/api/v1/exhibits/upload', upload.single('file'), (req, res) => {
  const uploaded = req.file?.path;
  if (!uploaded) return res.status(400).json({ error: 'No file' });
  
  const userId = req.body?.userId || 'user1';
  const platform = req.query?.platform || req.body?.platform || 'web';
  
  // Log activity
  logActivity('exhibit:upload', userId, {
    filename: req.file?.originalname || path.basename(uploaded),
    size: req.file?.size,
    platform
  });
  
  broadcast({ type: 'exhibitUpload', name: path.basename(uploaded) });
  res.json({ ok: true });
});

// DELETE /api/v1/exhibits/:filename - Delete exhibit file
app.delete('/api/v1/exhibits/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const userId = req.query.userId || req.body?.userId || 'user1';
    const platform = req.query.platform || req.body?.platform || 'web';
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    
    // Try to delete from both working and canonical directories
    const workingPath = path.join(workingExhibitsDir, filename);
    const canonicalPath = path.join(canonicalExhibitsDir, filename);
    
    let deleted = false;
    let fileSize = 0;
    
    if (fs.existsSync(workingPath)) {
      const stats = fs.statSync(workingPath);
      fileSize = stats.size;
      fs.unlinkSync(workingPath);
      deleted = true;
    }
    
    if (fs.existsSync(canonicalPath)) {
      if (!fileSize) {
        const stats = fs.statSync(canonicalPath);
        fileSize = stats.size;
      }
      fs.unlinkSync(canonicalPath);
      deleted = true;
    }
    
    if (!deleted) {
      return res.status(404).json({ error: 'Exhibit not found' });
    }
    
    // Log activity
    logActivity('exhibit:deleted', userId, {
      filename,
      size: fileSize,
      usedInDocuments: false, // TODO: Check if referenced in document
      platform
    });
    
    broadcast({ type: 'exhibitDeleted', name: filename });
    return res.json({ ok: true });
  } catch (e) {
    console.error('Error deleting exhibit:', e);
    return res.status(500).json({ error: 'Failed to delete exhibit' });
  }
});

// Compile: convert current DOCX to PDF (LibreOffice), then merge selected exhibits (PDF)
app.post('/api/v1/compile', async (req, res) => {
  try {
    const userId = req.body?.userId || 'user1';
    const platform = req.query?.platform || req.body?.platform || 'web';
    const names = Array.isArray(req.body?.exhibits) ? req.body.exhibits.filter(Boolean) : [];
    const outName = `packet-${Date.now()}.pdf`;
    const outPath = path.join(compiledDir, outName);
    // 1) Resolve current document path (DOCX)
    const docPath = resolveDefaultDocPath();
    if (!fs.existsSync(docPath)) return res.status(404).json({ error: 'no_default_doc' });
    // 2) Convert to PDF using LibreOffice (soffice)
    const tempDocPdf = path.join(compiledDir, `doc-${Date.now()}.pdf`);
    const convertedPath = await convertDocxToPdf(docPath, tempDocPdf);
    if (!convertedPath || !fs.existsSync(convertedPath)) return res.status(500).json({ error: 'convert_failed' });
    // 3) Collect exhibit PDFs
    const exhibitPaths = [];
    for (const n of names) {
      const w = path.join(workingExhibitsDir, n);
      const c = path.join(canonicalExhibitsDir, n);
      const p = fs.existsSync(w) ? w : c;
      if (p && fs.existsSync(p) && /\.pdf$/i.test(p)) exhibitPaths.push(p);
    }
    // 4) Merge into packet
    const buffers = [];
    buffers.push(fs.readFileSync(convertedPath));
    for (const p of exhibitPaths) {
      try { buffers.push(fs.readFileSync(p)); } catch {}
    }
    const merged = await mergePdfs(buffers);
    if (!merged) return res.status(500).json({ error: 'merge_failed' });
    fs.writeFileSync(outPath, merged);
    try { if (convertedPath && fs.existsSync(convertedPath)) fs.rmSync(convertedPath); } catch {}
    
    // Log activity (skip in test mode)
    if (!testMode) {
      try {
        const docContext = getDocumentContext();
        const compiledStats = fs.existsSync(outPath) ? fs.statSync(outPath) : null;
    logActivity('document:compile', userId, {
      format: 'pdf',
      includeExhibits: names.length > 0,
      exhibitCount: names.length,
          documentTitle: docContext.title,
          version: docContext.version,
          outputSize: compiledStats ? compiledStats.size : null,
      platform
    });
      } catch (err) {
        console.error('Error logging compile activity:', err);
      }
    }
    
    broadcast({ type: 'compile', name: outName });
    return res.json({ ok: true, url: `/compiled/${encodeURIComponent(outName)}` });
  } catch (e) {
    return res.status(500).json({ error: 'compile_failed' });
  }
});

// Helpers: LibreOffice conversion and PDF merge
async function convertDocxToPdf(inputPath, desiredOutPath) {
  try {
    const { execFile } = require('child_process');
    const baseOutDir = path.dirname(desiredOutPath);
    if (!fs.existsSync(baseOutDir)) fs.mkdirSync(baseOutDir, { recursive: true });

    // Candidates for Windows and general installs
    const exeCandidates = [];
    if (process.env.SOFFICE_PATH) exeCandidates.push(process.env.SOFFICE_PATH);
    exeCandidates.push('soffice');
    // Common Windows locations
    exeCandidates.push('C:/Program Files/LibreOffice/program/soffice.exe');
    exeCandidates.push('C:/Program Files (x86)/LibreOffice/program/soffice.exe');
    // soffice.com sometimes behaves better in headless mode on Windows
    exeCandidates.push('C:/Program Files/LibreOffice/program/soffice.com');
    exeCandidates.push('C:/Program Files (x86)/LibreOffice/program/soffice.com');

    // Try multiple arg variants
    const argVariants = [
      ['--headless', '--norestore', '--nolockcheck', '--convert-to', 'pdf', '--outdir', baseOutDir, inputPath],
      ['--headless', '--norestore', '--nolockcheck', '--convert-to', 'pdf:writer_pdf_Export', '--outdir', baseOutDir, inputPath],
    ];

    let success = false;
    let lastErr = null;
    for (const exe of exeCandidates) {
      for (const args of argVariants) {
        // eslint-disable-next-line no-await-in-loop
        const ok = await new Promise((resolve) => {
          try {
            execFile(exe, args, { windowsHide: true }, (err, _stdout, _stderr) => {
              lastErr = err || null;
              resolve(!err);
            });
          } catch (e) { lastErr = e; resolve(false); }
        });
        if (ok) { success = true; break; }
      }
      if (success) break;
    }
    if (!success) return null;

    // LibreOffice writes output to outdir with same base name
    const produced = path.join(baseOutDir, path.basename(inputPath).replace(/\.[^.]+$/, '.pdf'));
    if (!fs.existsSync(produced)) return null;
    try { fs.renameSync(produced, desiredOutPath); } catch { try { fs.copyFileSync(produced, desiredOutPath); } catch { return null; } }
    return desiredOutPath;
  } catch { return null; }
}

async function mergePdfs(pdfBuffers) {
  try {
    const { PDFDocument } = require('pdf-lib');
    const out = await PDFDocument.create();
    for (const buf of pdfBuffers) {
      if (!buf || !buf.length) continue;
      const src = await PDFDocument.load(buf);
      const pages = await out.copyPages(src, src.getPageIndices());
      for (const p of pages) out.addPage(p);
    }
    const bytes = await out.save();
    return Buffer.from(bytes);
  } catch { return null; }
}

// Send to Vendor (prototype): no-op with SSE echo
app.post('/api/v1/send-vendor', (req, res) => {
  const { from = 'user', message = '', vendorName = "Moti's Builders", userId = 'user1', vendorEmail = '' } = req.body || {};
  const payload = { from, message: String(message).slice(0, 200), vendorName };
  
  // Log activity (skip in test mode)
  if (!testMode) {
    try {
      const docContext = getDocumentContext();
  logActivity('document:send-vendor', userId, {
    vendor: vendorName,
    email: vendorEmail,
        documentTitle: docContext.title,
        version: docContext.version,
    platform: req.query?.platform || req.body?.platform || 'web'
  });
    } catch (err) {
      console.error('Error logging send-vendor activity:', err);
    }
  }
  
  broadcast({ type: 'sendVendor', payload, userId });
  res.json({ ok: true });
});

// UI schema for Send to Vendor modal
app.get('/api/v1/ui/modal/send-vendor', (req, res) => {
  try {
    const themePath = path.join(dataAppDir, 'theme.json');
    let theme = {};
    try { if (fs.existsSync(themePath)) theme = JSON.parse(fs.readFileSync(themePath, 'utf8')) || {}; } catch {}
    const modalTheme = theme?.modal || {};
    const users = loadUsers();
    const userId = req.query?.userId || 'user1';
    const current = users.find(u => (u?.id || u?.label) === userId) || {};
    const defaultFrom = current?.label || current?.id || 'OpenGov Staff';
    const schema = {
      id: 'sendVendor',
      title: 'Send to Vendor',
      style: { width: 720 },
      theme: {
        background: modalTheme.background || '#ffffff',
        headerBg: modalTheme.headerBg || '#ffffff',
        headerFg: modalTheme.headerFg || '#111827',
        border: modalTheme.border || '#e5e7eb',
        primary: modalTheme.primary || '#111827',
        muted: modalTheme.muted || '#6b7280'
      },
      description: 'Notify the vendor that the document is ready for them to review.',
      fields: [
        { name: 'from', label: 'From', type: 'text', required: true, value: defaultFrom },
        { name: 'vendorName', label: 'Vendor Name', type: 'text', required: true, value: "Moti's Builders" },
        { name: 'message', label: 'Message', type: 'textarea', required: true, maxLength: 200, placeholder: 'Message (max 200 chars)' }
      ],
      actions: [
        { id: 'cancel', label: 'Cancel', variant: 'secondary' },
        { id: 'save', label: 'Send', variant: 'primary' }
      ]
    };
    res.json({ schema });
  } catch (e) {
    res.status(500).json({ error: 'modal schema failed' });
  }
});

// SSE events
app.get('/api/v1/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  sseClients.add(res);
  res.write(`retry: ${SSE_RETRY_MS}\n\n`);
  res.flush?.();
  // Send an initial hello event so clients see activity immediately after connect
  try {
    const initial = {
      documentId: DOCUMENT_ID,
      revision: serverState.revision,
      type: 'hello',
      state: { checkedOutBy: serverState.checkedOutBy },
      ts: Date.now(),
    };
    res.write(`data: ${JSON.stringify(initial)}\n\n`);
    res.flush?.();
  } catch {}
  // Keep-alive comments to prevent proxy timeouts
  const keepalive = setInterval(() => {
    try { res.write(`: keepalive ${Date.now()}\n\n`); res.flush?.(); } catch {}
  }, 15000);
  req.on('close', () => { sseClients.delete(res); clearInterval(keepalive); });
});

// HTTPS preferred; try Office dev certs, then PFX, else fail (unless ALLOW_HTTP=true)
function tryCreateHttpsServer() {
  try {
    // 1) Office dev certs (shared with add-in 4000)
    try {
      // Lazy require to keep runtime optional
      const devCerts = require('office-addin-dev-certs');
      const httpsOptions = devCerts && devCerts.getHttpsServerOptions ? devCerts.getHttpsServerOptions() : null;
      if (httpsOptions && httpsOptions.key && httpsOptions.cert) {
        return https.createServer({ key: httpsOptions.key, cert: httpsOptions.cert, ca: httpsOptions.ca }, app);
      }
    } catch { /* ignore; may not be installed */ }
    // 2) PFX if available
    const pfxPath = process.env.SSL_PFX_PATH || path.join(rootDir, 'server', 'config', 'dev-cert.pfx');
    const pfxPass = process.env.SSL_PFX_PASS || 'password';
    if (fs.existsSync(pfxPath)) {
      const opts = { pfx: fs.readFileSync(pfxPath), passphrase: pfxPass };
      return https.createServer(opts, app);
    }
    // 3) PEM fallback
    const keyPath = process.env.SSL_KEY_PATH || path.join(rootDir, 'server', 'config', 'dev-key.pem');
    const certPath = process.env.SSL_CERT_PATH || path.join(rootDir, 'server', 'config', 'dev-cert.pem');
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      const opts = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
      return https.createServer(opts, app);
    }
  } catch { /* ignore */ }
  const allowHttp = String(process.env.ALLOW_HTTP || '').toLowerCase() === 'true' || String(process.env.NODE_ENV || '').toLowerCase() === 'test';
  if (allowHttp) return null;
  throw new Error('No HTTPS certificate available. Install Office dev certs or provide server/config/dev-cert.pfx. Set ALLOW_HTTP=true to use HTTP for dev only.');
}

// Initialize variables with seed data if none exist
function initializeVariables() {
  const variablesSeedPath = path.join(dataAppDir, 'variables.seed.json');
  try {
    console.log('🔍 Checking for variables at:', variablesFilePath);
    console.log('🔍 Seed file location:', variablesSeedPath);
    console.log('🔍 Seed file exists?', fs.existsSync(variablesSeedPath));
    
    if (!fs.existsSync(variablesFilePath) && fs.existsSync(variablesSeedPath)) {
      console.log('📦 Initializing variables from seed data...');
      fs.copyFileSync(variablesSeedPath, variablesFilePath);
      console.log('✅ Variables initialized with seed data');
    } else if (fs.existsSync(variablesFilePath)) {
      console.log('✅ Variables file already exists');
    } else if (!fs.existsSync(variablesSeedPath)) {
      console.error('❌ Seed file not found at:', variablesSeedPath);
    }
  } catch (e) {
    console.error('❌ Failed to initialize variables from seed:', e.message);
  }
}

// Initialize on startup
initializeVariables();

const httpsServer = tryCreateHttpsServer();
let serverInstance;
if (httpsServer) {
  serverInstance = httpsServer;
  httpsServer.listen(APP_PORT, () => {
    console.log(`HTTPS server running on https://localhost:${APP_PORT}`);
    console.log(`SuperDoc backend: ${SUPERDOC_BASE_URL}`);
  });
} else {
  serverInstance = http.createServer(app);
  serverInstance.listen(APP_PORT, () => {
    console.warn(`ALLOW_HTTP=true enabled. HTTP server running on http://localhost:${APP_PORT}`);
    console.warn('Install Office dev certs (preferred) or place dev-cert.pfx under server/config to enable HTTPS.');
  });
}

// Attach WS upgrade for collab proxy
try {
  serverInstance.on('upgrade', (req, socket, head) => {
    if (req.url && req.url.startsWith('/collab')) {
      collabProxy.upgrade(req, socket, head);
    }
  });
} catch {}


