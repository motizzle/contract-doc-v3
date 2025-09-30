# Enhanced Version Comparison Tool (Word Add-in First) - Detailed Structural Support

## What This Does
A tool to compare two document versions and show detailed differences, including structural changes like added/removed paragraphs, tables, and formatting. Click on any difference to jump to that location in the Word document using Office.js APIs. Uses HTML extraction for better fidelity than plain text.

## User Experience
1. **Go to Versions tab** in Word add-in
2. **Click "Compare Versions"** 
3. **Select two versions** (Version A and Version B)
4. **Click "Compare"**
5. **See list of differences** with AI-generated summaries highlighting structural context (e.g., "Added bullet list on approvals")
6. **Click any difference** to jump to that spot in the Word document

## Technical Implementation

### Server Side
```javascript
// Enhanced endpoint: POST /api/v1/versions/compare
app.post('/api/v1/versions/compare', async (req, res) => {
  try {
    const versionA = Number(req.body?.versionA);
    const versionB = Number(req.body?.versionB);
    if (!Number.isFinite(versionA) || !Number.isFinite(versionB)) {
      return res.status(400).json({ error: 'invalid_versions' });
    }
    
    // Extract HTML content from both documents (structural preservation)
    const htmlA = await extractHtmlFromDocx(getVersionPath(versionA));
    const htmlB = await extractHtmlFromDocx(getVersionPath(versionB));
    
    // Find detailed differences using diff-match-patch on HTML
    const differences = findStructuralDifferences(htmlA, htmlB);
    
    // Use Ollama to summarize each difference with structural awareness
    const summarizedDifferences = await summarizeDifferences(differences);
    
    res.json({
      versionA,
      versionB,
      differences: summarizedDifferences
    });
  } catch (e) {
    return res.status(500).json({ error: 'compare_failed' });
  }
});

// Helper: Extract HTML from DOCX using mammoth.js (preserves structure)
async function extractHtmlFromDocx(filePath) {
  if (!fs.existsSync(filePath)) return '';
  try {
    const mammoth = await import('mammoth/mammoth.browser.js'); // Or node version
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    return result.value; // HTML with <p>, <table>, <strong>, etc.
  } catch {
    // Fallback to plain text if HTML extraction fails
    return extractTextFromDocx(filePath);
  }
}

// Fallback plain text extraction
async function extractTextFromDocx(filePath) {
  const docx = await import('docx');
  const buffer = await fs.readFile(filePath);
  const doc = await docx.Document.load(buffer);
  return doc.getText();
}

// Helper: Find structural differences with diff-match-patch
function findStructuralDifferences(htmlA, htmlB) {
  const DiffMatchPatch = require('diff-match-patch');
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(htmlA, htmlB);
  
  return diffs
    .filter(([type]) => type !== 0) // Skip unchanged
    .map(([type, text], index) => {
      // Infer structure type from HTML snippet (simple regex)
      const structureType = inferStructureType(text);
      const position = dmp.diff_prettyHtml(diffs, 0, index).length; // Approx offset
      
      return {
        id: index + 1,
        type, // -1=delete, 1=insert
        text, // HTML snippet for detailed view
        position,
        pageNumber: estimatePageNumber(position),
        structureType // e.g., 'paragraph', 'table', 'heading'
      };
    });
}

// Helper: Infer structure from HTML (basic)
function inferStructureType(html) {
  if (html.includes('<table')) return 'table';
  if (html.includes('<p>') || html.includes('<ul>')) return 'paragraph';
  if (html.includes('<h1>') || html.includes('<h2>')) return 'heading';
  return 'text';
}

// Helper: Summarize with Ollama, aware of structure
async function summarizeDifferences(differences) {
  const ollama = new OllamaClient(process.env.OLLAMA_BASE_URL);
  
  return Promise.all(differences.map(async (diff) => {
    const prompt = `Analyze this DOCX ${diff.type === 1 ? 'addition' : 'deletion'} (HTML snippet, structure: ${diff.structureType}): ${diff.text}. Summarize the change, mentioning any structural elements like tables or formatting. Keep concise and actionable.`;
    
    const summary = await ollama.generate({
      model: process.env.OLLAMA_MODEL || 'llama3.1',
      prompt,
      stream: false
    });
    
    return {
      ...diff,
      summary: summary.response,
      pageNumber: diff.pageNumber
    };
  })).then(results => results.filter(Boolean));
}

// Helper: Estimate page number from position (heuristic for formatted HTML)
function estimatePageNumber(position) {
  const avgCharsPerPage = 2500; // Adjusted for HTML density
  return Math.floor(position / avgCharsPerPage) + 1;
}

// Get version file path
function getVersionPath(version) {
  return version === 1 
    ? path.join(canonicalDocumentsDir, 'default.docx')
    : path.join(versionsDir, `v${version}.docx`);
}
```

### Document Navigation (Word Add-in with Office.js)
```javascript
// Server: Broadcast navigation via SSE
app.post('/api/v1/document/navigate', async (req, res) => {
  try {
    const { text, changeType, position, structureType } = req.body;
    
    // Clean text for Word search (strip HTML tags)
    const cleanText = text.replace(/<[^>]*>/g, '');
    
    // Use existing SSE broadcast system
    broadcast({
      type: 'document:navigate',
      payload: { 
        text: cleanText, 
        changeType,
        position,
        structureType,
        timestamp: Date.now(),
        platform: 'word' // Target Word add-ins
      }
    });
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'navigate_failed' });
  }
});

// Client: Listen for navigation events (Word add-in only)
window.addEventListener('document:navigate', async (event) => {
  const { text, changeType, position, structureType } = event.detail;
  
  // Only handle if we're in Word add-in
  if (typeof Office === 'undefined') return;
  
  try {
    await Word.run(async (context) => {
      // Search for the cleaned text
      const searchResults = context.document.body.search(text, {
        matchCase: false,
        matchWholeWord: false
      });
      
      if (searchResults.items.length > 0) {
        // Select and scroll to the text
        const range = searchResults.items[0];
        range.select();
        range.scrollIntoView();
        
        // Highlight based on change type and structure
        let highlightColor = 'yellow';
        if (changeType === 'addition') {
          highlightColor = 'lightGreen';
        } else if (changeType === 'deletion') {
          highlightColor = 'lightPink';
        }
        
        // Optional: Apply structure-specific styling (e.g., table highlight)
        if (structureType === 'table') {
          // Extend range to table if possible
          range.expandTo(Word.RangeLocation.table);
        }
        
        range.font.highlightColor = highlightColor;
      }
      
      await context.sync();
    });
  } catch (error) {
    console.error('Word navigation failed:', error);
  }
});
```

## Data Structure
```javascript
// Enhanced difference object with structural detail
{
  id: 1,
  type: 1, // 1 = addition, -1 = deletion
  text: "<p><strong>New payment terms</strong></p>", // HTML snippet
  summary: "Added bold paragraph on payment terms (Ollama analysis)",
  position: 450, // Character offset for navigation
  pageNumber: 2,
  structureType: "paragraph" // 'paragraph', 'table', 'heading', 'text'
}

// Comparison result
{
  versionA: 2,
  versionB: 4,
  differences: [
    { id: 1, type: 1, text: "<table><tr><td>Item</td><td>Cost</td></tr></table>", summary: "Inserted expense table", pageNumber: 3, structureType: "table" },
    { id: 2, type: -1, text: "<p>Old clause</p>", summary: "Removed outdated section", pageNumber: 5, structureType: "paragraph" }
  ]
}
```

## Environment Configuration
```bash
# .env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
DIFF_MODE=html  # 'html' for structural, 'text' for plain (future swaps)
# Dependencies: npm install mammoth diff-match-patch
```

## Dependencies
- `mammoth`: HTML extraction from DOCX (structural preservation)
- `diff-match-patch`: Granular diff computation on HTML/text
- `docx`: Fallback plain text extraction

## What This Doesn't Do
- Pixel-level formatting diffs (e.g., exact font size changes)
- Image or embedded object comparisons
- Real-time collaboration during comparison
- Export or reporting features
- **Web/SuperDoc support** (Word add-in only for now; Phase 2)

## Future Extensibility
- **Swap Extraction**: From HTML (mammoth) to full XML (jszip + xml2js) for deeper structure (e.g., moved sections, exact formatting)
- **AI Provider**: Easy swap Ollama for OpenAI/Groq by changing the client in summarizeDifferences
- **Enhanced Diffs**: Add more difference types (moves, format-only changes) via XML parsing
- **Caching**: Memoize extractions and diffs for repeated comparisons
- **Page Accuracy**: Integrate better estimation using Word APIs or XML layout analysis
- **SuperDoc Support**: Add when navigation APIs available (Phase 2)
- **Web Version**: Use same SSE infrastructure, with HTML rendering for previews

## Implementation Strategy
1. **Phase 1 (Current)**: Enhanced detailed comparison for Word add-in using HTML extraction, diff-match-patch, and Ollama structural summaries
2. **Phase 2**: Full XML structural analysis and SuperDoc support
3. **Phase 3**: Advanced features like visual diff previews and export

This enhanced implementation provides detailed, structural-aware comparisons while maintaining the simple, focused UX. Future XML extensibility allows for even deeper analysis without changing the core API/UI structure.
