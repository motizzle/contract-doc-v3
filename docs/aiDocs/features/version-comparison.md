# Version Comparison Tool (Word Add-in First)

## What This Does
A simple tool to compare two document versions and show the differences. Click on any difference to jump to that location in the Word document using Office.js APIs.

## User Experience
1. **Go to Versions tab** in Word add-in
2. **Click "Compare Versions"** 
3. **Select two versions** (Version A and Version B)
4. **Click "Compare"**
5. **See list of differences** with simple summaries
6. **Click any difference** to jump to that spot in the Word document

## Technical Implementation

### Server Side
```javascript
// New endpoint: POST /api/v1/versions/compare
app.post('/api/v1/versions/compare', async (req, res) => {
  const { versionA, versionB } = req.body;
  
  // Get the two document versions
  const docA = await getDocumentVersion(versionA);
  const docB = await getDocumentVersion(versionB);
  
  // Extract text from both documents
  const textA = await extractTextFromDocx(docA);
  const textB = await extractTextFromDocx(docB);
  
  // Find differences using simple text diff
  const differences = findDifferences(textA, textB);
  
  // Use Ollama to summarize each difference
  const summarizedDifferences = await summarizeDifferences(differences);
  
  res.json({
    versionA,
    versionB,
    differences: summarizedDifferences
  });
});

// Helper function to extract text from DOCX
async function extractTextFromDocx(filePath) {
  const docx = await import('docx');
  const buffer = await fs.readFile(filePath);
  const doc = await docx.Document.load(buffer);
  return doc.getText();
}

// Helper function to find differences
function findDifferences(textA, textB) {
  // Use a simple diff library like diff-match-patch
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(textA, textB);
  
  return diffs.map((diff, index) => ({
    id: index,
    type: diff[0], // -1 = deletion, 0 = equal, 1 = addition
    text: diff[1],
    position: calculatePosition(diff, textA)
  }));
}

// Helper function to summarize differences with Ollama
async function summarizeDifferences(differences) {
  const ollama = new OllamaClient('http://localhost:11434');
  
  return Promise.all(differences.map(async (diff) => {
    if (diff.type === 0) return null; // Skip equal text
    
    const summary = await ollama.generate({
      model: 'llama3.1',
      prompt: `Summarize this document change: ${diff.text}`,
      stream: false
    });
    
    return {
      ...diff,
      summary: summary.response,
      pageNumber: estimatePageNumber(diff.position)
    };
  }));
}
```

### Client Side
```javascript
// Add to existing tabs: "Comparison" tab
function ComparisonTab() {
  const [selectedVersions, setSelectedVersions] = useState({ versionA: null, versionB: null });
  const [differences, setDifferences] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const handleCompare = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/versions/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedVersions)
      });
      const result = await response.json();
      setDifferences(result.differences);
    } catch (error) {
      console.error('Comparison failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const jumpToDifference = async (difference) => {
    // Send navigation event to document
    await fetch('/api/v1/document/navigate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageNumber: difference.pageNumber,
        text: difference.text
      })
    });
    
    // Switch back to document view
    setActiveTab('AI');
  };
  
  return (
    <div className="comparison-tab">
      {/* Version Selection */}
      <div className="version-selector">
        <select onChange={(e) => setSelectedVersions(prev => ({ ...prev, versionA: e.target.value }))}>
          <option>Select Version A</option>
          {/* Populate with available versions */}
        </select>
        <select onChange={(e) => setSelectedVersions(prev => ({ ...prev, versionB: e.target.value }))}>
          <option>Select Version B</option>
          {/* Populate with available versions */}
        </select>
        <button onClick={handleCompare} disabled={loading}>
          {loading ? 'Comparing...' : 'Compare Versions'}
        </button>
      </div>
      
      {/* Differences List */}
      {differences && (
        <div className="differences-list">
          {differences.filter(d => d !== null).map(diff => (
            <div key={diff.id} className="difference-card">
              <div className="difference-header">
                <span className={`change-type ${diff.type === 1 ? 'addition' : 'deletion'}`}>
                  {diff.type === 1 ? 'Added' : 'Removed'}
                </span>
                <span className="page-number">Page {diff.pageNumber}</span>
              </div>
              <div className="difference-summary">{diff.summary}</div>
              <div className="difference-text">{diff.text}</div>
              <button onClick={() => jumpToDifference(diff)}>
                Jump to Location
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Document Navigation (Word Add-in with Office.js)
```javascript
// Server: Broadcast navigation via existing SSE
app.post('/api/v1/document/navigate', async (req, res) => {
  const { text, changeType } = req.body;
  
  // Use existing SSE broadcast system
  broadcast({
    type: 'document:navigate',
    payload: { 
      text, 
      changeType,
      timestamp: Date.now(),
      platform: 'word' // Only send to Word add-ins
    }
  });
  
  res.json({ success: true });
});

// Client: Listen for navigation events (Word add-in only)
window.addEventListener('document:navigate', async (event) => {
  const { text, changeType } = event.detail;
  
  // Only handle if we're in Word add-in
  if (typeof Office === 'undefined') return;
  
  try {
    await Word.run(async (context) => {
      // Search for the text
      const searchResults = context.document.body.search(text, {
        matchCase: false,
        matchWholeWord: false
      });
      
      if (searchResults.items.length > 0) {
        // Select and scroll to the text
        searchResults.items[0].select();
        searchResults.items[0].scrollIntoView();
        
        // Highlight based on change type
        if (changeType === 'addition') {
          searchResults.items[0].font.highlightColor = 'lightGreen';
        } else if (changeType === 'deletion') {
          searchResults.items[0].font.highlightColor = 'lightPink';
        } else {
          searchResults.items[0].font.highlightColor = 'yellow';
        }
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
// Simple difference object
{
  id: 1,
  type: 1, // 1 = addition, -1 = deletion
  text: "The actual changed text",
  summary: "Added new payment terms",
  pageNumber: 3
}

// Comparison result
{
  versionA: 2,
  versionB: 4,
  differences: [
    { id: 1, type: 1, text: "...", summary: "...", pageNumber: 3 },
    { id: 2, type: -1, text: "...", summary: "...", pageNumber: 5 }
  ]
}
```

## Environment Configuration
```bash
# .env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
```

## What This Doesn't Do
- Complex AI analysis or recommendations
- Side-by-side document comparison
- Advanced formatting or structural analysis
- Real-time collaboration
- Export or reporting features
- **Web/SuperDoc support** (Word add-in only for now)

## Future Extensibility
- **Easy to swap Ollama for OpenAI** by changing the client
- **Simple to add more difference types** (modifications, formatting changes)
- **Can add caching later** if needed
- **Can enhance summaries** with more detailed prompts
- **SuperDoc support** can be added later when SuperDoc navigation APIs are available
- **Web version** can be built using the same SSE infrastructure

## Implementation Strategy
1. **Phase 1**: Build for Word add-in only using Office.js APIs
2. **Phase 2**: Add SuperDoc support when navigation APIs are available
3. **Phase 3**: Enhance with additional features based on usage

This is a focused, simple implementation that does exactly what you asked for: compare versions, show differences, click to navigate in Word. SuperDoc support can be added later when the APIs are ready.
