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

### Creating Sections

#### UI: Sections Tab (Sidepane)
```
┌────────────────────────────────────┐
│ Sections                      [+]  │ ← Create Section button
├────────────────────────────────────┤
│ ┌────────────────────────────────┐│
│ │ Federal Compliance             ││
│ │ 🟢 Visible • 3 rules           ││
│ │ [Edit] [Toggle] [Insert]      ││
│ └────────────────────────────────┘│
│ ┌────────────────────────────────┐│
│ │ Renewal Terms                  ││
│ │ 🔴 Hidden • 1 rule             ││
│ │ [Edit] [Toggle] [Insert]      ││
│ └────────────────────────────────┘│
│ ┌────────────────────────────────┐│
│ │ Payment Schedule               ││
│ │ 🟢 Visible • No rules          ││
│ │ [Edit] [Toggle] [Insert]      ││
│ └────────────────────────────────┘│
└────────────────────────────────────┘
```

#### Create Section Modal
```
┌──────────────────────────────────────┐
│ Create Section                   [X] │
├──────────────────────────────────────┤
│ Section Label:                       │
│ [Federal Compliance Requirements___] │
│                                      │
│ Section Content:                     │
│ ┌──────────────────────────────────┐│
│ │ All federal contracts must...    ││
│ │                                  ││
│ │ [Rich text editor]               ││
│ └──────────────────────────────────┘│
│                                      │
│ Initial Visibility:                  │
│ ○ Visible  ● Hidden                 │
│                                      │
│            [Cancel]  [Create]        │
└──────────────────────────────────────┘
```

#### Section Properties
```javascript
{
  sectionId: 'section_001', // Auto-generated
  label: 'Federal Compliance Requirements',
  content: 'Rich text content...', // HTML or markdown
  visible: false, // Default visibility
  position: 0, // Order in document
  rules: [], // Conditional rules
  style: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
    borderWidth: 2
  },
  metadata: {
    wordCount: 150,
    lastModified: '2025-03-15T10:00:00Z'
  }
}
```

### Managing Sections

#### Toggle Section On/Off
- **Manual Toggle**: Click "Toggle" button in sidepane
- **Instant Update**: Document updates immediately
- **Broadcast**: SSE notifies all clients
- **Override Rules**: Manual toggle temporarily overrides conditional logic
  - Show warning: "This section has conditional rules. Manual toggle will override them."

#### Edit Section
- Update label
- Edit content (rich text editor)
- Change default visibility
- Manage associated rules

#### Insert Section
- Click "Insert" to place section at cursor position
- In Word: Inserts Content Control
- In Web: Inserts SuperDoc annotation or styled div

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

### Phase 1: Foundation (5-7 days)
**Goal:** Basic sections with manual toggle

**Backend:**
- [ ] Data models for sections, questions, rules
- [ ] Storage: `data/app/sections.json`
- [ ] API endpoints:
  - `GET /api/v1/sections` - List all sections
  - `POST /api/v1/sections` - Create section
  - `PUT /api/v1/sections/:id` - Update section
  - `DELETE /api/v1/sections/:id` - Delete section
  - `PUT /api/v1/sections/:id/toggle` - Toggle visibility
- [ ] SSE broadcasting for section changes

**Frontend:**
- [ ] Sections tab in sidepane
- [ ] Section cards UI
- [ ] Create/edit section modal
- [ ] Manual toggle functionality
- [ ] Insert section into document (Word + Web)

**Document Rendering:**
- [ ] Word: Insert as Content Control
- [ ] Web: Insert as styled div or SuperDoc annotation
- [ ] Show/hide logic on both platforms

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

#### GET /api/v1/sections
```javascript
Response: {
  sections: {
    "section_001": { /* section object */ }
  }
}
```

#### POST /api/v1/sections
```javascript
Request: {
  label: "Federal Compliance Requirements",
  content: "Rich text content...",
  visible: false,
  position: 0
}
Response: {
  section: { /* created section */ }
}
```

#### PUT /api/v1/sections/:id/toggle
```javascript
Request: {
  visible: true,
  userId: "user1",
  override: true // Optional: manual override
}
Response: {
  section: { /* updated section */ },
  affectedRules: [...] // Rules that were overridden
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
// Section created
{
  type: 'section:created',
  section: { /* section object */ }
}

// Section visibility changed
{
  type: 'section:visibility',
  sectionId: 'section_001',
  visible: true,
  reason: 'manual' | 'rule' | 'answer'
}

// Question answered
{
  type: 'question:answered',
  questionId: 'question_001',
  answer: 'yes',
  affectedSections: ['section_001', 'section_002']
}

// Rule created/updated
{
  type: 'rule:updated',
  ruleId: 'rule_001',
  rule: { /* rule object */ }
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

