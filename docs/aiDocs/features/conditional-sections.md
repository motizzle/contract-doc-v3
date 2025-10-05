# Conditional Sections & Document Automation

## Overview
Enable dynamic document composition through conditional sections that show/hide based on configurable rules. Sections are managed server-side (like variables) and rendered natively on each platform (Word + Web), with visibility controlled by simple conditional logic.

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

### Architecture (Similar to Variables)

**Server-Side** (Source of Truth)
```javascript
// data/app/sections.json
{
  "sections": {
    "section_001": {
      "sectionId": "section_001",
      "label": "Federal Compliance Requirements",
      "content": "...", // Rich text content
      "visible": true,
      "position": 0, // Order in document
      "rules": ["rule_001"], // Conditional rules that control this
      "createdAt": "2025-03-15T10:00:00Z",
      "updatedAt": "2025-03-15T10:00:00Z"
    }
  },
  "questions": {
    "question_001": {
      "questionId": "question_001",
      "text": "Are you using federal funds?",
      "answer": null, // "yes" | "no" | null
      "type": "boolean"
    }
  },
  "rules": {
    "rule_001": {
      "ruleId": "rule_001",
      "questionId": "question_001",
      "condition": "equals", // equals | not_equals
      "value": "yes",
      "action": "show", // show | hide
      "targetSectionId": "section_001"
    }
  }
}
```

**Client-Side Rendering**

**Word Add-in:**
- Sections rendered as **Content Controls** (like variables)
- Content Control has:
  - `tag`: `section_001`
  - `title`: Section label
  - `content`: Rich text from server
  - `appearance`: 'BoundingBox' (visible section boundary)
  - Custom style/color to distinguish from variables

**Web Viewer:**
- Sections rendered as **SuperDoc Section Annotations** (new plugin)
- Or fallback to styled `<div>` with section metadata
- Visual indicator (border, background, section label)

**Synchronization:**
- SSE broadcasts when sections/questions/rules change
- Clients re-evaluate rules and show/hide sections
- Both platforms update in real-time

---

## 2. Sections Management

### **Leveraging Native Section Support**

**Key Insight:** SuperDoc (web) and Word already support sections natively. We don't reinvent this - we **enhance** it with conditional logic.

#### How Users Create Sections
**In the Document** (Primary Method):
- **Web (SuperDoc)**: Click in document → "Insert Section" → Name it
- **Word**: Click in document → Insert Content Control → Set properties
- **Natural workflow**: Create sections where you need them

**Sidepane Role:**
- **Dashboard view** of all sections in document
- **Control panel** for conditional logic
- **Not** a creation tool - just management

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
**Web (SuperDoc):**
- Listen for SuperDoc section creation/deletion events
- Auto-detect sections in document on load
- Extract section ID, title, position, content

**Word (Content Controls):**
- Scan document for Content Controls with type="section" (or custom tag)
- Extract Control ID, title, position, content
- Monitor for changes via Word JS API events

#### Server-Side Tracking
```javascript
// data/app/sections.json
{
  "sections": {
    "section_sdoc_abc123": { // SuperDoc section ID
      "sectionId": "section_sdoc_abc123",
      "label": "Federal Compliance Requirements",
      "source": "superdoc", // superdoc | word
      "visible": true,
      "rules": [], // Conditional rules applied to this
      "lastSeen": "2025-03-15T10:00:00Z",
      "metadata": {
        "pageNumber": 3,
        "wordCount": 150,
        "createdBy": "user1"
      }
    },
    "section_word_xyz789": { // Word Content Control ID
      "sectionId": "section_word_xyz789",
      "label": "Renewal Terms",
      "source": "word",
      "visible": false, // Hidden by rule
      "rules": ["rule_001"],
      "lastSeen": "2025-03-15T10:05:00Z"
    }
  }
}
```

#### Sync Flow
```
1. User creates section in document
   ↓
2. Platform detects new section
   ↓
3. Send to server: POST /api/v1/sections/register
   {
     sectionId: "section_sdoc_abc123",
     label: "Federal Compliance",
     source: "superdoc"
   }
   ↓
4. Server stores section metadata
   ↓
5. SSE broadcasts to all clients
   ↓
6. Sidepane updates to show new section
```

### Managing Sections

#### Toggle Section Visibility
**From Sidepane:**
- Click "Hide" or "Show" button
- Section visibility updates in document
- **Both platforms**: Section hidden/shown using native APIs
  - SuperDoc: `section.setVisibility(false)`
  - Word: `contentControl.appearance = 'Hidden'` or custom CSS class

**Manual Toggle:**
- Temporarily overrides conditional rules
- Warning shown if rules exist
- Can be reset to "Follow Rules" mode

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

### Phase 1: Section Discovery & Dashboard (3-4 days)
**Goal:** Detect sections in document and display in sidepane

**Backend:**
- [ ] Data models for sections, questions, rules
- [ ] Storage: `data/app/sections.json`
- [ ] API endpoints:
  - `POST /api/v1/sections/register` - Register section from document
  - `GET /api/v1/sections` - List all tracked sections
  - `PUT /api/v1/sections/:id/toggle` - Toggle visibility
  - `DELETE /api/v1/sections/:id/untrack` - Remove from tracking
- [ ] SSE broadcasting for section changes

**Frontend:**
- [ ] Sections tab in sidepane (dashboard view)
- [ ] Section cards UI (read-only display)
- [ ] Scan document for existing sections on load
- [ ] Listen for section create/delete events in document
- [ ] Auto-register new sections with server

**Platform Integration:**
- [ ] **Web (SuperDoc):** Hook into section creation/deletion events
- [ ] **Word:** Scan Content Controls, detect section-type controls
- [ ] Show/hide logic using native APIs
  - SuperDoc: `section.setVisibility()`
  - Word: `contentControl.appearance` or CSS class

### Phase 2: Questions System (3-4 days)
**Goal:** Question management and answers

**Backend:**
- [ ] API endpoints:
  - `GET /api/v1/questions` - List all questions
  - `POST /api/v1/questions` - Create question
  - `PUT /api/v1/questions/:id` - Update question
  - `PUT /api/v1/questions/:id/answer` - Set answer
  - `DELETE /api/v1/questions/:id` - Delete question

**Frontend:**
- [ ] Questions tab in sidepane
- [ ] Question cards with radio buttons
- [ ] Create/edit question modal
- [ ] Answer selection UI
- [ ] Visual feedback when questions affect sections

### Phase 3: Conditional Rules (4-5 days)
**Goal:** Connect questions to sections

**Backend:**
- [ ] API endpoints:
  - `GET /api/v1/rules` - List all rules
  - `POST /api/v1/rules` - Create rule
  - `PUT /api/v1/rules/:id` - Update rule
  - `DELETE /api/v1/rules/:id` - Delete rule
- [ ] Rule evaluation engine
- [ ] Automatic section visibility updates

**Frontend:**
- [ ] Rule editor modal
- [ ] Rule configuration UI
- [ ] Rule preview
- [ ] Show rule status on section cards
- [ ] Real-time section updates when answers change

### Phase 4: UX Enhancements (2-3 days)
**Goal:** Polish and usability

**Frontend:**
- [ ] Drag-and-drop section reordering
- [ ] Search/filter sections and questions
- [ ] Bulk operations (delete multiple, toggle multiple)
- [ ] Rule templates (common patterns)
- [ ] Validation and error handling
- [ ] Undo/redo for section changes
- [ ] Keyboard shortcuts

**Backend:**
- [ ] Activity logging for section operations
- [ ] Section versioning (track changes to sections)
- [ ] Export rules as JSON

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

