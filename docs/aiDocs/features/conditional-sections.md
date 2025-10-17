# Conditional Sections & Document Automation

**Status:** 📋 Planned - Research Complete  
**Test Coverage:** Manual tests completed  
**Last Updated:** October 2025

## Related Documentation
- `features/conditional-sections-research.md` - Field annotations vs sections research
- `features/variables.md` - Variable system for conditional logic
- `architecture/USER-WORKFLOWS.md` - Planned user workflows

---

## Overview
Enable dynamic document composition through conditional sections that auto-insert/delete based on configurable rules. Sections are managed server-side and rendered using **SuperDoc's native `documentSection` feature**, providing a unified implementation across web viewer and Word add-in.

## Key Architecture Decision (October 2025)

**✅ Use SuperDoc Native Sections**

After testing, we confirmed that SuperDoc's `documentSection` nodes:
- ✅ **Persist** through save/reload cycles
- ✅ **Export** to .docx files correctly
- ✅ **Work identically** in web viewer AND Word add-in
- ✅ **Use same API** everywhere (no platform-specific code needed)

**Benefits:**
1. **Single Backend Process** - Same SuperDoc instance for both platforms
2. **Unified Implementation** - Same code works everywhere
3. **Native Features** - Leverage SuperDoc's intended design
4. **Simpler Codebase** - No Content Control workarounds
5. **Future-Proof** - SuperDoc updates improve our features

**Implementation:**
```javascript
// SAME CODE for web viewer AND Word add-in:
editor.commands.createDocumentSection({
  id: 'sec-001',
  title: 'Federal Compliance Requirements',
  html: '<p><strong>Content...</strong></p>'
});
```

---

## Core Concept

**Smart Documents that Adapt**
- Documents contain **sections** that can be toggled on/off
- Visibility controlled by **questions** with yes/no answers
- **Conditional rules**: "If X, then show/hide Y"
- **Cross-platform**: Identical behavior in Word add-in and web viewer
- **Server-managed**: Section definitions and rules stored centrally

**Example Use Case:**
```
Question: "Are you using federal funds?"
- If YES → Show "Federal Compliance Section"
- If NO → Hide "Federal Compliance Section"

Question: "Is this a multi-year contract?"
- If YES → Show "Renewal Terms Section"
- If NO → Hide "Renewal Terms Section"
```

---

## 1. Cross-Platform Parity

### Architecture (Using SuperDoc Native Sections)

**Server-Side** (Source of Truth)
```javascript
// data/app/sections.json
{
  "sections": {
    "sec-001": {
      "sectionId": "sec-001",
      "title": "Federal Compliance Requirements",
      "content": "<p><strong>Rich HTML content...</strong></p>",
      "insertWhen": {
        "questionId": "question-001",
        "answer": "yes"
      },
      "createdBy": "user1",
      "createdAt": "2025-10-15T10:00:00Z",
      "updatedAt": "2025-10-15T10:00:00Z"
    }
  }
}

// data/app/questions.json
{
  "questions": {
    "question-001": {
      "questionId": "question-001",
      "text": "Are you using federal funds?",
      "answer": null, // "yes" | "no" | null
      "affectsSection": ["sec-001"],
      "createdBy": "user1",
      "createdAt": "2025-10-15T10:00:00Z"
    }
  }
}
```

**Client-Side Rendering (UNIFIED)**

**Both Web Viewer AND Word Add-in:**
- Sections rendered as **SuperDoc `documentSection` nodes**
- Same API works on both platforms (no platform detection!)
- Insertion:
  ```javascript
  editor.commands.createDocumentSection({
    id: 'sec-001',
    title: 'Federal Compliance Requirements',
    html: '<p><strong>Content...</strong></p>'
  });
  ```
- Detection:
  ```javascript
  editor.view.state.doc.descendants((node, pos) => {
    if (node.type.name === 'documentSection') {
      // Found section at position
    }
  });
  ```
- Deletion:
  ```javascript
  editor.commands.removeSectionById('sec-001');
  ```

**Key Benefits:**
- ✅ **Single codebase** - No platform-specific logic
- ✅ **Native features** - Leverages SuperDoc's intended design
- ✅ **Simpler** - No Content Control workarounds
- ✅ **Unified backend** - Same SuperDoc instance for web and Word

**Synchronization:**
- SSE broadcasts when questions answered
- All clients auto-insert/delete sections based on answers
- Real-time updates across all users

---

## 2. Sections Management

### **Leveraging Native SuperDoc Sections**

**Key Insight:** SuperDoc's `documentSection` feature now works reliably and persists across save/reload cycles. We use this native feature with added conditional logic.

#### How Users Create Sections

**Option 1: From Sidepane (Recommended)**
- Create section template in "Sections" tab
- Configure title, content, and conditional rule
- Click "Insert" to add to document (or auto-inserts when conditions met)

**Option 2: In Document (Advanced)**
- Use SuperDoc's native section creation UI (if available)
- Section automatically detected and registered server-side
- Can add conditional logic afterward via sidepane

**Key Difference from Variables:**
- **Variables**: Small inline fields (company name, dates)
- **Sections**: Large blocks of content (entire paragraphs, clauses, tables)
- **Both**: Use SuperDoc, but different node types (`documentSection` vs `structuredContent`)

**Sidepane Role:**
- **Template library** of available sections
- **In-document view** showing what's currently inserted
- **Control panel** for conditional logic (questions and rules)

### Sections Tab (Sidepane) - Dashboard View

#### UI: Sections Dashboard
```
┌────────────────────────────────────┐
│ Sections in Document          🔄   │ ← Refresh/sync button
├────────────────────────────────────┤
│ 🔍 Search sections...              │
│ [All] [Visible] [Hidden] [Rules]   │ ← Filter tabs
├────────────────────────────────────┤
│ ┌────────────────────────────────┐│
│ │ Federal Compliance             ││ ← Detected from document
│ │ 🟢 Visible                     ││
│ │ Page 3 • 150 words             ││
│ │                                ││
│ │ Conditional Logic:             ││
│ │ ⚙️ No rules (always visible)   ││
│ │                                ││
│ │ [Add Rule] [Jump to] [Hide]    ││
│ └────────────────────────────────┘│
│ ┌────────────────────────────────┐│
│ │ Renewal Terms                  ││
│ │ 🔴 Hidden • 1 rule active      ││
│ │ Page 7 • 230 words             ││
│ │                                ││
│ │ IF "Multi-year?" = YES         ││
│ │ THEN Show this section         ││
│ │                                ││
│ │ [Edit Rule] [Jump to] [Show]   ││
│ └────────────────────────────────┘│
│ ┌────────────────────────────────┐│
│ │ Payment Schedule               ││
│ │ 🟢 Visible                     ││
│ │ Page 12 • 85 words             ││
│ │                                ││
│ │ ⚠️ Warning: No section found   ││ ← If deleted from doc
│ │ [Remove from tracking]         ││
│ └────────────────────────────────┘│
└────────────────────────────────────┘
```

### Section Detection & Sync

#### How Sections Are Discovered
**Unified Detection via SuperDoc `documentSection` Nodes**

SuperDoc's native section feature creates `documentSection` nodes that persist in the document. Same detection code works on web viewer AND Word add-in.

**Detection Code (UNIFIED for Both Platforms):**
```javascript
// Works identically in web viewer AND Word add-in
const editor = window.superdocInstance.editor;
const sectionsInDocument = [];

editor.view.state.doc.descendants((node, pos) => {
  if (node.type.name === 'documentSection') {
    const section = {
      sectionId: node.attrs.id,
      title: node.attrs.title,
      description: node.attrs.description,
      position: pos,
      isLocked: node.attrs.isLocked
    };
    
    sectionsInDocument.push(section);
  }
});

// Register with server
fetch(`${API_BASE}/api/v1/sections/sync`, {
  method: 'POST',
  body: JSON.stringify({ sectionsInDocument })
});
```

**Key Attributes:**
- `node.attrs.id` → Section ID (unique identifier)
- `node.attrs.title` → Section Title (display name)
- `node.attrs.description` → Optional description
- `node.attrs.isLocked` → Whether section can be edited
- `pos` → Position in document

**Benefits:**
- ✅ **Single API** - Same code for web and Word add-in
- ✅ **No platform detection** - No `if (Office)` checks needed
- ✅ **Native feature** - Leverages SuperDoc's intended design
- ✅ **Simpler** - Direct node inspection, no XML parsing
- ✅ **Reliable** - SuperDoc handles persistence automatically

#### Server-Side Tracking
```javascript
// data/app/sections.json
{
  "sections": {
    "sec-001": {
      "sectionId": "sec-001",
      "title": "Federal Compliance Requirements",
      "content": "<p><strong>Rich HTML content...</strong></p>",
      "insertWhen": {
        "questionId": "question-001",
        "answer": "yes"
      },
      "currentlyInDocument": false, // Tracked via detection
      "lastSeen": "2025-10-15T10:00:00Z",
      "createdBy": "user1",
      "createdAt": "2025-10-15T10:00:00Z",
      "updatedAt": "2025-10-15T10:00:00Z"
    },
    "sec-002": {
      "sectionId": "sec-002",
      "title": "Renewal Terms",
      "content": "<p>Multi-year contract renewal terms...</p>",
      "insertWhen": {
        "questionId": "question-002",
        "answer": "yes"
      },
      "currentlyInDocument": true, // Currently inserted
      "lastSeen": "2025-10-15T10:05:00Z",
      "createdBy": "user1",
      "createdAt": "2025-10-15T10:00:00Z"
    }
  }
}
```

#### Sync Flow
```
1. Page loads → Detect sections in document
   ↓
2. Client scans for documentSection nodes
   ↓
3. Send to server: POST /api/v1/sections/sync
   {
     sectionsInDocument: [
       { sectionId: "sec-001", title: "...", position: 123 }
     ]
   }
   ↓
4. Server updates "currentlyInDocument" status
   ↓
5. SSE broadcasts current state to all clients
   ↓
6. Sidepane updates to show accurate status
```

### Managing Sections

#### Insert/Delete Sections
**From Sidepane:**
- **Template Library**: Click "Insert" to manually add section
- **Auto-Insert**: Answer question → section auto-inserts if conditions met
- **Manual Delete**: Click "Delete" on in-document section
- **Auto-Delete**: Change answer → section auto-deletes if conditions no longer met

**Implementation (UNIFIED):**
```javascript
// Insert (same code for web and Word add-in)
editor.commands.createDocumentSection({
  id: 'sec-001',
  title: 'Federal Compliance Requirements',
  html: '<p><strong>Content...</strong></p>'
});

// Delete (same code for web and Word add-in)
editor.commands.removeSectionById('sec-001');
```

**Manual Override:**
- Users can manually insert conditional sections before answering questions
- Users can manually delete auto-inserted sections
- Warning shown: "This section is controlled by a question"
- Status tracked separately: "Manual override" vs "Auto-managed"

#### Apply Conditional Logic
**Add Rule Button:**
- Opens rule editor modal
- Configure question → answer → action
- Rule saved server-side
- Associates rule with this section

**Edit Rules:**
- Modify existing rules
- Enable/disable rules
- Delete rules

#### Jump to Section
- Click "Jump to" button
- Document scrolls to section
- Section highlighted temporarily
- Works on both platforms (existing "Jump to location" feature)

#### Section Not Found
- If section deleted from document but still tracked
- Show warning in sidepane
- Offer "Remove from tracking" button
- Cleanup orphaned rules

---

## 3. Sidepane Controls

### Sections Tab Layout
```
┌────────────────────────────────────┐
│ ┌────────────────────────────────┐│
│ │ [All] [Visible] [Hidden]       ││ ← Filter tabs
│ └────────────────────────────────┘│
│                                    │
│ 🔍 Search sections...              │
│                                    │
│ Section Cards (scrollable list)   │
│ ┌────────────────────────────────┐│
│ │ Federal Compliance             ││
│ │ ────────────────────────────   ││
│ │ Status: 🟢 Visible             ││
│ │ Rules: 1 active                ││
│ │ Position: Page 3               ││
│ │                                ││
│ │ Conditional Logic:             ││
│ │ IF "Federal funds?" = YES      ││
│ │ THEN Show                      ││
│ │                                ││
│ │ [Edit Rules] [Toggle] [Delete] ││
│ └────────────────────────────────┘│
└────────────────────────────────────┘
```

### Section Card States
- **Visible** (🟢 green dot): Currently shown in document
- **Hidden** (🔴 red dot): Currently hidden from document
- **Conditional** (⚙️ gear icon): Has active conditional rules
- **Manual Override** (⚠️ warning icon): Manually toggled, overriding rules

### Quick Actions
- **Toggle**: Show/hide section immediately
- **Edit Rules**: Open rules editor
- **Jump to Section**: Scroll to section in document (if visible)
- **Delete**: Remove section (with confirmation)

---

## 4. Conditional Logic System

### Questions (The "X" in "If X...")

#### Question Types (Start Simple)
**Boolean Questions** (Phase 1)
```javascript
{
  questionId: 'q_federal_funds',
  text: 'Are you using federal funds?',
  type: 'boolean',
  answer: null, // null | 'yes' | 'no'
  options: ['yes', 'no']
}
```

**Future Question Types** (Phase 2+)
- Multiple choice: "Which state is the contract in?"
- Numeric: "What is the contract value?" (> $1M, < $1M)
- Date: "When does the contract start?" (before/after date)
- Text: "What is the vendor name?" (equals, contains)

#### Managing Questions

**Questions Tab (Sidepane)**
```
┌────────────────────────────────────┐
│ Questions                     [+]  │
├────────────────────────────────────┤
│ ┌────────────────────────────────┐│
│ │ Are you using federal funds?   ││
│ │ Answer: ● Yes  ○ No  ○ N/A    ││
│ │ Affects: 3 sections            ││
│ └────────────────────────────────┘│
│ ┌────────────────────────────────┐│
│ │ Is this a multi-year contract? ││
│ │ Answer: ○ Yes  ● No  ○ N/A    ││
│ │ Affects: 1 section             ││
│ └────────────────────────────────┘│
│ ┌────────────────────────────────┐│
│ │ Requires performance bond?     ││
│ │ Answer: ○ Yes  ○ No  ● N/A    ││
│ │ Affects: 2 sections            ││
│ └────────────────────────────────┘│
└────────────────────────────────────┘
```

**Answering Questions:**
- Click radio button to set answer
- **Immediate Effect**: All dependent sections update automatically
- **Visual Feedback**: Show which sections were affected
  - Toast: "3 sections updated based on your answer"
- **SSE Broadcast**: All clients see the change

### Rules (The "Then" in "If X, Then Y")

#### Simple Rule Structure
```javascript
{
  ruleId: 'rule_001',
  questionId: 'q_federal_funds',
  condition: 'equals', // equals | not_equals
  value: 'yes',
  action: 'show', // show | hide
  targetSectionId: 'section_001',
  enabled: true
}
```

**Human-Readable Format:**
```
IF "Are you using federal funds?" = YES
THEN Show "Federal Compliance Requirements"
```

#### Rule Editor Modal
```
┌──────────────────────────────────────┐
│ Edit Conditional Rule            [X] │
├──────────────────────────────────────┤
│ IF this question is answered:        │
│ ┌──────────────────────────────────┐│
│ │ Are you using federal funds?  ▼ ││ ← Dropdown
│ └──────────────────────────────────┘│
│                                      │
│ And the answer is:                   │
│ ● Equals  ○ Does not equal          │
│                                      │
│ ┌──────────────────────────────────┐│
│ │ Yes                           ▼ ││ ← Answer dropdown
│ └──────────────────────────────────┘│
│                                      │
│ THEN perform this action:            │
│ ● Show  ○ Hide                      │
│                                      │
│ On this section:                     │
│ ┌──────────────────────────────────┐│
│ │ Federal Compliance Req.       ▼ ││ ← Section dropdown
│ └──────────────────────────────────┘│
│                                      │
│ Preview:                             │
│ ┌──────────────────────────────────┐│
│ │ IF "Federal funds?" = YES        ││
│ │ THEN Show "Federal Compliance"   ││
│ └──────────────────────────────────┘│
│                                      │
│            [Cancel]  [Save Rule]     │
└──────────────────────────────────────┘
```

#### Multiple Rules per Section
```javascript
// Section can have multiple rules (OR logic)
{
  sectionId: 'section_warranty',
  label: 'Extended Warranty Terms',
  rules: [
    'rule_001', // IF contract_value > $100k THEN show
    'rule_002'  // IF multi_year = yes THEN show
  ]
  // Section shows if ANY rule evaluates to "show"
}
```

#### Rule Evaluation Logic
```javascript
function evaluateSectionVisibility(section, questions, rules) {
  // If no rules, use default visibility
  if (!section.rules || section.rules.length === 0) {
    return section.visible;
  }
  
  // Evaluate each rule
  const ruleResults = section.rules.map(ruleId => {
    const rule = rules[ruleId];
    if (!rule || !rule.enabled) return null;
    
    const question = questions[rule.questionId];
    if (!question || question.answer === null) return null;
    
    // Check condition
    let conditionMet = false;
    if (rule.condition === 'equals') {
      conditionMet = question.answer === rule.value;
    } else if (rule.condition === 'not_equals') {
      conditionMet = question.answer !== rule.value;
    }
    
    // Return action if condition met
    if (conditionMet) {
      return rule.action === 'show';
    }
    
    return null;
  }).filter(r => r !== null);
  
  // OR logic: Show if ANY rule says show
  if (ruleResults.includes(true)) return true;
  
  // AND logic for hide: Hide if ANY rule says hide
  if (ruleResults.includes(false)) return false;
  
  // Default: use section's default visibility
  return section.visible;
}
```

---

## 5. User Workflow Example

### Scenario: Creating a Contract with Conditional Sections

**Step 1: Create Questions**
1. Go to Questions tab
2. Click "+ Add Question"
3. Enter: "Are you using federal funds?"
4. Save (answer defaults to N/A)

**Step 2: Create Section**
1. Go to Sections tab
2. Click "+ Create Section"
3. Label: "Federal Compliance Requirements"
4. Content: [Enter compliance text]
5. Initial visibility: Hidden
6. Save

**Step 3: Create Rule**
1. In Sections tab, find "Federal Compliance Requirements"
2. Click "Edit Rules"
3. Click "+ Add Rule"
4. Configure:
   - Question: "Are you using federal funds?"
   - Condition: Equals
   - Value: Yes
   - Action: Show
5. Save rule

**Step 4: Answer Question**
1. Go to Questions tab
2. Find "Are you using federal funds?"
3. Click "Yes"
4. **Result**: "Federal Compliance Requirements" section appears in document

**Step 5: Change Answer**
1. Click "No" instead
2. **Result**: Section disappears immediately

---

## Implementation Phases

### Phase 1: Questions System (3-4 days)
**Goal:** Foundation for conditional logic

**Backend:**
- [ ] Data model: `data/app/questions.json`
- [ ] API endpoints:
  - `GET /api/v1/questions` - List all questions
  - `POST /api/v1/questions` - Create question
  - `PUT /api/v1/questions/:id` - Update question text
  - `PUT /api/v1/questions/:id/answer` - Set answer
  - `DELETE /api/v1/questions/:id` - Delete question
- [ ] SSE broadcasting for question changes

**Frontend:**
- [ ] Questions tab in sidepane
- [ ] Question cards with Yes/No radio buttons
- [ ] Create question modal
- [ ] Answer selection with immediate feedback
- [ ] SSE listeners for real-time updates

**Testing:**
- [ ] Create question via UI
- [ ] Answer question (no sections yet, just save answer)
- [ ] Verify SSE broadcasts to all clients
- [ ] Test multi-user scenario

**Deliverable:** Working questions tab with create/answer/delete

### Phase 2: Sections System (2-3 days)
**Goal:** Section templates using SuperDoc native sections

**Backend:**
- [ ] Data model: `data/app/sections.json`
- [ ] API endpoints:
  - `GET /api/v1/sections` - List all section templates
  - `POST /api/v1/sections` - Create section template
  - `PUT /api/v1/sections/:id` - Update section
  - `DELETE /api/v1/sections/:id` - Delete section
  - `POST /api/v1/sections/sync` - Sync in-document sections
- [ ] SSE broadcasting for section changes

**Frontend:**
- [ ] Sections tab in sidepane (template library + in-document view)
- [ ] Section template cards
- [ ] Create section modal (title, content, conditional rule)
- [ ] Rich text editor for section content (simple WYSIWYG)
- [ ] Manual insert button for each template
- [ ] **Unified Detection (SAME CODE for web + Word!):**
  ```javascript
  editor.view.state.doc.descendants((node, pos) => {
    if (node.type.name === 'documentSection') {
      // Found section - register with server
    }
  });
  ```

**Testing:**
- [ ] Create section template
- [ ] Manually insert template into document using `createDocumentSection()`
- [ ] Verify section appears in "In Document" list
- [ ] Refresh page - section still there (persistence verified!)
- [ ] Save document - section persists in .docx
- [ ] Test in both web AND Word add-in (should be identical!)

**Deliverable:** Section templates can be created, inserted, and detected

### Phase 3: Auto-Insert/Delete Logic (3-4 days)
**Goal:** Conditional magic using unified SuperDoc APIs

**Backend:**
- [ ] Rule evaluation engine (when question answered, which sections to insert/delete)
- [ ] Modify `PUT /api/v1/questions/:id/answer` to evaluate rules
- [ ] Return `triggeredInsertions` and `triggeredDeletions`
- [ ] SSE event: `question:answered` with affected sections

**Frontend:**
- [ ] **Auto-Insert Handler (UNIFIED for web + Word!):**
  ```javascript
  window.addEventListener('question:answered', (event) => {
    const { triggeredInsertions, triggeredDeletions } = event.detail;
    
    // Insert sections (same code everywhere!)
    triggeredInsertions.forEach(section => {
      editor.commands.createDocumentSection({
        id: section.sectionId,
        title: section.title,
        html: section.content
      });
    });
    
    // Delete sections (same code everywhere!)
    triggeredDeletions.forEach(sectionId => {
      editor.commands.removeSectionById(sectionId);
    });
  });
  ```
- [ ] Visual feedback (toasts, highlights)
- [ ] Update section status in sidepane
- [ ] Show which sections each question affects

**Testing:**
- [ ] Answer question "yes" → Section auto-inserts at end of doc
- [ ] Change to "no" → Section auto-deletes
- [ ] Change back to "yes" → Section re-inserts
- [ ] Multiple sections per question
- [ ] Multi-user: User A answers, User B sees section insert
- [ ] **Critical:** Test in both web AND Word add-in (should behave identically!)

**Deliverable:** Fully working conditional sections with auto-insert/delete

### Phase 4: Polish & UX (2-3 days)
**Goal:** Production-ready feature

**Backend:**
- [ ] Activity logging (question answers, section insertions/deletions)
- [ ] Validation (warn if deleting question with active sections)
- [ ] Prevent circular dependencies

**Frontend:**
- [ ] Search/filter questions and sections
- [ ] Bulk operations (delete multiple questions)
- [ ] Enhanced status indicators
- [ ] Preview section content before insert
- [ ] Help & onboarding (tooltips, empty states)
- [ ] Confirmation dialogs for destructive actions

**Testing:**
- [ ] Full E2E workflow (create question → create section → answer → verify insert)
- [ ] Cross-platform parity check (web vs Word add-in)
- [ ] Multi-user scenario (2+ users)
- [ ] Performance with 20+ questions, 50+ sections
- [ ] Activity log completeness

**Deliverable:** Production-ready conditional sections feature

---

## API Specifications

### Sections Endpoints

#### POST /api/v1/sections/register
**Purpose:** Register a section that was created in the document

```javascript
Request: {
  sectionId: "section_sdoc_abc123", // Native ID from platform
  label: "Federal Compliance Requirements",
  source: "superdoc" | "word",
  visible: true,
  metadata: {
    pageNumber: 3,
    wordCount: 150
  }
}
Response: {
  section: { /* registered section */ },
  isNew: true // true if first time seeing this section
}
```

#### GET /api/v1/sections
**Purpose:** Get all tracked sections

```javascript
Response: {
  sections: {
    "section_sdoc_abc123": {
      sectionId: "section_sdoc_abc123",
      label: "Federal Compliance Requirements",
      source: "superdoc",
      visible: true,
      rules: ["rule_001"],
      lastSeen: "2025-03-15T10:00:00Z"
    }
  }
}
```

#### PUT /api/v1/sections/:id/toggle
**Purpose:** Toggle section visibility (show/hide)

```javascript
Request: {
  visible: false,
  userId: "user1",
  override: true // Optional: manual override of rules
}
Response: {
  section: { /* updated section */ },
  affectedRules: [...], // Rules that were overridden
  evaluatedRules: [...] // Rules that were evaluated
}
```

#### DELETE /api/v1/sections/:id/untrack
**Purpose:** Stop tracking a section (doesn't delete from document)

```javascript
Request: {
  userId: "user1"
}
Response: {
  ok: true,
  deletedRules: ["rule_001", "rule_002"] // Associated rules also deleted
}
```

### Questions Endpoints

#### POST /api/v1/questions
```javascript
Request: {
  text: "Are you using federal funds?",
  type: "boolean",
  options: ["yes", "no"]
}
Response: {
  question: { /* created question */ }
}
```

#### PUT /api/v1/questions/:id/answer
```javascript
Request: {
  answer: "yes",
  userId: "user1"
}
Response: {
  question: { /* updated question */ },
  affectedSections: [
    { sectionId: "section_001", oldVisible: false, newVisible: true }
  ]
}
```

### Rules Endpoints

#### POST /api/v1/rules
```javascript
Request: {
  questionId: "question_001",
  condition: "equals",
  value: "yes",
  action: "show",
  targetSectionId: "section_001"
}
Response: {
  rule: { /* created rule */ }
}
```

---

## SSE Events

```javascript
// Section registered (detected in document)
{
  type: 'section:registered',
  section: {
    sectionId: 'section_sdoc_abc123',
    label: 'Federal Compliance Requirements',
    source: 'superdoc',
    visible: true
  }
}

// Section visibility changed
{
  type: 'section:visibility',
  sectionId: 'section_sdoc_abc123',
  visible: false,
  reason: 'manual' | 'rule' | 'answer',
  triggeredBy: 'user1' | 'rule_001'
}

// Section untracked (removed from tracking)
{
  type: 'section:untracked',
  sectionId: 'section_sdoc_abc123',
  reason: 'deleted' | 'manual'
}

// Question answered
{
  type: 'question:answered',
  questionId: 'question_001',
  answer: 'yes',
  affectedSections: [
    { sectionId: 'section_001', oldVisible: false, newVisible: true },
    { sectionId: 'section_002', oldVisible: false, newVisible: true }
  ]
}

// Rule created/updated
{
  type: 'rule:updated',
  ruleId: 'rule_001',
  rule: { /* rule object */ },
  affectedSections: ['section_001']
}
```

---

## Technical Considerations

### Performance
- **Large Documents**: Limit to 50 sections initially
- **Rule Evaluation**: Cache results, re-evaluate only on question answer change
- **SSE**: Batch section updates to reduce network traffic

### Conflict Resolution
- **Multiple Users**: Last write wins for question answers
- **Manual Overrides**: Track override timestamp, auto-expire after session?
- **Rule Conflicts**: If rules conflict, show > hide (safer default)

### Data Integrity
- **Question Deletion**: Warn if question has active rules
- **Section Deletion**: Confirm if section has content
- **Rule Validation**: Ensure question and section exist

### Future Enhancements (Out of Scope for Initial Release)
- **Complex Conditions**: AND/OR logic, nested conditions
- **Computed Fields**: "If contract_value > $100k"
- **Section Templates**: Pre-built sections for common scenarios
- **Version Control**: Track section changes over time
- **Approval Workflows**: Require approval to show certain sections
- **AI Suggestions**: "This contract might need a warranty section"

---

## Success Metrics

1. **Functionality**
   - Sections show/hide correctly on both platforms
   - SSE updates propagate within 500ms
   - Support 50+ sections without performance degradation

2. **Usability**
   - Users can create a conditional section in < 2 minutes
   - 90% of users understand conditional logic without help
   - Zero confusion about section visibility state

3. **Reliability**
   - 100% accuracy in rule evaluation
   - No lost data when toggling sections
   - Graceful handling of network failures

---

## Open Questions

1. **Rich Text Editor**: Use SuperDoc editor or simple textarea?
2. **Section Numbering**: Auto-number sections? (1, 2, 3...)
3. **Nested Sections**: Support sections within sections?
4. **Export**: How do sections appear in PDF/Word exports?
5. **Permissions**: Can some users only answer questions, not create sections?

---

## Related Features

- **Variables**: Sections use similar server-side management pattern
- **Versions**: Sections should be versioned with document
- **Activity Log**: Log all section operations
- **Approvals**: Can approval be required to change section visibility?

---

## Mockups Needed

1. Sections tab in sidepane
2. Section card (visible/hidden/conditional states)
3. Create section modal
4. Questions tab
5. Question card with answer selection
6. Rule editor modal
7. Section in document (Word + Web)

