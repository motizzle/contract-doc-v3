# AI System Prompt Editor

**Status:** ✅ Implemented  
**Test Coverage:** Manual testing  
**Last Updated:** September 2024  
**Platforms:** Word Add-in, Web  
**Related:** AI Chat, Document Context

## Related Documentation
- `architecture/USER-WORKFLOWS.md` - AI interaction workflows
- `features/llm-chatbot.md` - LLM integration details

---

## Overview

Users can view and customize the system prompt that guides the AI assistant's behavior and personality. This allows organizations to tailor the AI's responses to their specific domain, tone, and use cases.

---

## Current System Prompt

The AI chat currently uses the following system prompt (defined in `server/src/server.js:75-85`):

```javascript
function getSystemPrompt() {
  return process.env.LLM_SYSTEM_PROMPT || `You are OG Assist, an AI assistant aware of the current document context.

Current Document Context:
${DOCUMENT_CONTEXT}

Answer helpfully and provide insights based on the current document context. Reference specific details from the contract when relevant. Be concise but informative.`;
}
```

**Components:**
- **Identity**: "OG Assist" - the AI assistant name
- **Context Awareness**: Document context is automatically injected
- **Instructions**: Answer helpfully, reference document details, be concise
- **Override**: Can be set via `LLM_SYSTEM_PROMPT` environment variable

---

## User Story

**As a** contract manager or administrator  
**I want to** customize the AI assistant's system prompt  
**So that** the AI responds with the right tone, domain knowledge, and guidelines for my organization

---

## Feature Specification

### UI Components

#### 1. Edit Prompt Button
**Location**: AI tab, next to "Refresh Doc" button  
**Label**: "Edit Prompt"  
**Style**: Secondary button variant  
**Behavior**: Opens System Prompt Editor modal

#### 2. System Prompt Editor Modal

**Title**: "AI System Prompt"

**Content:**
- **Read-only section**: "Current Document Context" 
  - Shows that document context is automatically injected
  - Displays current document excerpt or indicator
  
- **Editable textarea**: System prompt text
  - Multi-line textarea (min 6 rows, auto-expand)
  - Default shows current prompt
  - Placeholder indicates the `{DOCUMENT_CONTEXT}` variable

- **Helper text**: 
  - "The `{DOCUMENT_CONTEXT}` placeholder will be automatically replaced with the current document content."
  - "This prompt guides how the AI responds to your questions."

**Actions:**
- **Save** (primary): Save custom prompt
- **Reset to Default**: Restore original system prompt
- **Cancel** (secondary): Close without saving

**Validation:**
- Minimum 10 characters
- Maximum 2000 characters
- Cannot be empty

---

## Implementation Details

### Frontend (shared-ui/components.react.js)

```javascript
// Add to ChatConsole footer alongside Reset and Refresh Doc buttons
const editPromptBtn = React.createElement(UIButton, { 
  label: 'Edit Prompt', 
  onClick: () => window.dispatchEvent(new CustomEvent('react:open-modal', { 
    detail: { id: 'system-prompt-editor' } 
  })), 
  tone: 'secondary' 
});

// System Prompt Editor Modal
function SystemPromptEditorModal(props) {
  const { onClose } = props || {};
  const [prompt, setPrompt] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  
  // Load current prompt on mount
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/v1/chat/system-prompt`);
        if (r.ok) {
          const data = await r.json();
          setPrompt(data.prompt || '');
        }
      } catch {}
      setLoading(false);
    })();
  }, []);
  
  const save = async () => {
    try {
      await fetch(`${API_BASE}/api/v1/chat/system-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      onClose?.();
    } catch {}
  };
  
  const resetToDefault = async () => {
    try {
      await fetch(`${API_BASE}/api/v1/chat/system-prompt/reset`, {
        method: 'POST'
      });
      // Reload prompt
      const r = await fetch(`${API_BASE}/api/v1/chat/system-prompt`);
      if (r.ok) {
        const data = await r.json();
        setPrompt(data.prompt || '');
      }
    } catch {}
  };
  
  // Modal UI with textarea, helper text, and actions
}
```

### Backend API (server/src/server.js)

```javascript
// GET current system prompt
app.get('/api/v1/chat/system-prompt', (req, res) => {
  try {
    const customPromptPath = path.join(dataAppDir, 'config', 'system-prompt.txt');
    let prompt = '';
    
    if (fs.existsSync(customPromptPath)) {
      prompt = fs.readFileSync(customPromptPath, 'utf8');
    } else {
      // Return default prompt
      prompt = `You are OG Assist, an AI assistant aware of the current document context.

Current Document Context:
{DOCUMENT_CONTEXT}

Answer helpfully and provide insights based on the current document context. Reference specific details from the contract when relevant. Be concise but informative.`;
    }
    
    res.json({ 
      prompt,
      hasCustom: fs.existsSync(customPromptPath),
      documentContext: DOCUMENT_CONTEXT.slice(0, 500) + (DOCUMENT_CONTEXT.length > 500 ? '...' : '')
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load system prompt' });
  }
});

// POST update system prompt
app.post('/api/v1/chat/system-prompt', (req, res) => {
  try {
    const { prompt } = req.body || {};
    
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 10) {
      return res.status(400).json({ error: 'Invalid prompt' });
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
    
    res.json({ ok: true, prompt: prompt.trim() });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save system prompt' });
  }
});

// POST reset to default
app.post('/api/v1/chat/system-prompt/reset', (req, res) => {
  try {
    const customPromptPath = path.join(dataAppDir, 'config', 'system-prompt.txt');
    
    if (fs.existsSync(customPromptPath)) {
      fs.unlinkSync(customPromptPath);
    }
    
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to reset system prompt' });
  }
});

// Update getSystemPrompt() to check for custom prompt
function getSystemPrompt() {
  loadDocumentContext();
  
  const customPromptPath = path.join(dataAppDir, 'config', 'system-prompt.txt');
  let basePrompt = '';
  
  if (fs.existsSync(customPromptPath)) {
    basePrompt = fs.readFileSync(customPromptPath, 'utf8');
  } else {
    basePrompt = process.env.LLM_SYSTEM_PROMPT || `You are OG Assist, an AI assistant aware of the current document context.

Current Document Context:
{DOCUMENT_CONTEXT}

Answer helpfully and provide insights based on the current document context. Reference specific details from the contract when relevant. Be concise but informative.`;
  }
  
  // Replace placeholder with actual document context
  return basePrompt.replace(/{DOCUMENT_CONTEXT}/g, DOCUMENT_CONTEXT);
}
```

### Storage

**File**: `data/app/config/system-prompt.txt`
- Plain text file
- Created when user customizes prompt
- Deleted when reset to default
- Persists across server restarts
- Not tracked in git (add to .gitignore)

---

## Use Cases

### Use Case 1: Domain-Specific Assistant
**Scenario**: A procurement team wants the AI to focus on vendor terms and compliance.

**Custom Prompt**:
```
You are ProcureBot, a procurement specialist AI familiar with vendor contracts and compliance requirements.

Current Document Context:
{DOCUMENT_CONTEXT}

Focus your responses on:
- Vendor obligations and service levels
- Payment terms and penalties
- Compliance clauses (GDPR, SOC2, etc.)
- Risk mitigation language

Be direct and cite specific sections from the contract.
```

### Use Case 2: Executive Summary Style
**Scenario**: Executives want concise, business-focused answers.

**Custom Prompt**:
```
You are Executive Assist, providing concise contract analysis for busy executives.

Current Document Context:
{DOCUMENT_CONTEXT}

Keep responses:
- Under 3 sentences when possible
- Focus on business impact and risks
- Use bullet points for multiple items
- Highlight dollar amounts and dates
```

### Use Case 3: Training Mode
**Scenario**: Training new contract analysts to understand contract language.

**Custom Prompt**:
```
You are Contract Mentor, helping new analysts learn contract review.

Current Document Context:
{DOCUMENT_CONTEXT}

When answering:
- Explain legal terminology in plain language
- Point out standard vs. unusual clauses
- Suggest what questions to ask about ambiguous terms
- Teach pattern recognition for common issues
```

---

## Edge Cases & Considerations

1. **Document Context Size**: Large documents may exceed LLM token limits
   - Solution: Truncate or summarize document context
   - Show warning if context is truncated

2. **Prompt Injection**: User could craft malicious prompts
   - Solution: Basic sanitization, remove system instructions
   - Could add admin-only mode in future

3. **Multiple Users**: Different users may want different prompts
   - Current: Single system-wide prompt
   - Future: Per-user or per-role prompts

4. **Factory Reset**: Should reset prompt?
   - Yes: Delete custom prompt file on factory reset

5. **Backup**: No automatic backup of custom prompts
   - Users should document important customizations externally

---

## Testing

### Manual Tests

1. ✅ Open Edit Prompt modal, verify current prompt loads
2. ✅ Modify prompt, save, verify bot uses new prompt
3. ✅ Reset to default, verify original prompt restored
4. ✅ Cancel without saving, verify no changes
5. ✅ Test with very long prompt (>2000 chars), verify error
6. ✅ Test with empty prompt, verify error
7. ✅ Verify `{DOCUMENT_CONTEXT}` gets replaced with actual content
8. ✅ Factory reset removes custom prompt

### API Tests

```javascript
// Test prompt CRUD operations
describe('System Prompt API', () => {
  it('GET /api/v1/chat/system-prompt returns default');
  it('POST /api/v1/chat/system-prompt saves custom prompt');
  it('POST /api/v1/chat/system-prompt validates length');
  it('POST /api/v1/chat/system-prompt/reset removes custom prompt');
  it('getSystemPrompt() replaces {DOCUMENT_CONTEXT} placeholder');
});
```

---

## Future Enhancements

1. **Prompt Templates**: Pre-built prompts for common scenarios
   - Procurement focus
   - Legal review
   - Executive summary
   - Training mode

2. **Prompt History**: Track previous prompts, allow rollback

3. **Per-User Prompts**: Different prompts for different roles
   - Admins, editors, viewers

4. **Prompt Testing**: Preview bot responses with custom prompt before saving

5. **Variables**: Support more placeholders
   - `{USER_NAME}` - Current user
   - `{DOCUMENT_TITLE}` - Document name
   - `{VERSION}` - Document version

6. **Prompt Sharing**: Export/import prompts between deployments

---

## Security & Permissions

**Who can edit?**
- Initially: All users
- Future: Admin-only setting

**Audit logging:**
- Log prompt changes to activity log
- Include user ID, timestamp, prompt excerpt

---

## Documentation

### User Guide Section

**Customizing the AI Assistant**

The AI assistant uses a "system prompt" to guide its personality, knowledge focus, and response style. You can customize this prompt to match your organization's needs.

**To edit the system prompt:**

1. Click the **AI** tab
2. Click **Edit Prompt** (next to Refresh Doc button)
3. Modify the prompt text
4. Click **Save**

**Tips:**
- Use `{DOCUMENT_CONTEXT}` where you want document content injected
- Be specific about tone and focus areas
- Keep it under 2000 characters
- Test the results after saving

**To reset to default:**
Click **Reset to Default** in the prompt editor.

---

## Acceptance Criteria

- [ ] Edit Prompt button appears next to Refresh Doc
- [ ] Modal opens showing current system prompt
- [ ] Can edit and save custom prompt
- [ ] Can reset to default prompt
- [ ] Bot responses reflect custom prompt immediately
- [ ] Prompt persists across server restart
- [ ] Factory reset clears custom prompt
- [ ] Validation prevents empty/too-long prompts
- [ ] Document context is injected correctly

---

## Related Files

- `server/src/server.js` - System prompt logic
- `shared-ui/components.react.js` - ChatConsole, modal
- `data/app/config/system-prompt.txt` - Custom prompt storage
- `server/src/lib/llm.js` - LLM integration


