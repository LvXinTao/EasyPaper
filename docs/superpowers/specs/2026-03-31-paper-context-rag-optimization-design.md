# Paper Context Optimization: RAG Retrieval-Augmented Generation

## Problem Statement

Currently, when users ask questions via Chat API, the entire paper content (`parsed.md`, typically ~50KB / ~12,000 tokens) is sent to the LLM as context. This results in:
- High latency (3-5 seconds per query)
- High token cost (~$0.03 per query with 12k input tokens)
- Poor scalability for longer papers

## Solution Overview

Implement RAG (Retrieval-Augmented Generation) to retrieve only relevant paper sections instead of sending full content:

```
Current: parsed.md → [send full text] → LLM response

Optimized: parsed.md → chunking → embedding API → embeddings.json
                                                     ↓
           user query → retrieve top-k chunks → [send summary + chunks] → LLM response
```

## Architecture

### New Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Embedding Service | `src/lib/embedding.ts` | Call embedding API, generate vectors |
| Chunker Service | `src/lib/chunker.ts` | Split parsed.md into semantic chunks |
| Retrieval Service | `src/lib/retrieval.ts` | Compute similarity, retrieve top-k chunks |
| Embeddings Storage | `storage.ts` | Store/load embeddings.json |
| Embed API | `src/app/api/embed/[id]/route.ts` | Trigger embedding generation |
| Settings Config | `ai-config.ts` | Embedding model configuration |

### Data Flow

1. **Paper Upload**: PDF → Vision parse → `parsed.md`
2. **Analysis Complete**: Frontend detects SSE `done: true` → Calls `/api/embed/{paperId}` POST
3. **Embedding Generation**: Chunking → Embedding API → Save `embeddings.json`
4. **Chat Query**: Embed query → Retrieve top-k → Build RAG context → Send to LLM

## Context Strategy

Send two-part context to LLM:

| Part | Content | Tokens | Purpose |
|------|---------|--------|---------|
| Macro | `analysis.json` summary (summary + methodology + experiments + conclusions) | ~500-800 | Paper overview |
| Micro | Retrieved top-3 relevant chunks | ~1500-2000 | Specific question details |

**Final context structure sent to LLM**:

```
[论文摘要]
- 核心思想：{summary}
- 方法论：{methodology}
- 实验：{experiments}
- 结论：{conclusions}

[与您问题相关的段落]
段落1 (第X页)：...
段落2 (第Y页)：...
段落3 (第Z页)：...

用户问题：...
```

## Chunking Strategy

### Rules

- Split by `\n\n` (Markdown paragraph boundary)
- Preserve section headers as chunk prefix (e.g., `## Methods\n...`)
- Target chunk size: 500-800 tokens
- Merge short adjacent paragraphs, truncate long ones
- Preserve `<!-- page N -->` markers for page localization

### Storage Structure

**`~/.easypaper/papers/{paperId}/embeddings.json`**:

```json
{
  "chunks": [
    { "id": "chunk_1", "page": 3, "section": "Methodology", "text": "..." }
  ],
  "embeddings": [
    [0.012, -0.034, 0.567, ...]
  ],
  "generatedAt": "2026-03-31T10:00:00Z",
  "model": "text-embedding-3-small"
}
```

**Embedding Status in `metadata.json`**:

```json
{
  "embeddingStatus": "pending" | "generating" | "generated" | "error",
  "embeddingError": "optional error message",
  "embeddingGeneratedAt": "2026-03-31T10:00:00Z"
}
```

Status values:
- `pending`: Not yet generated, will trigger on first chat query
- `generating`: Currently being generated (show spinner in UI)
- `generated`: Successfully generated
- `error`: Generation failed, fallback to full text

### Page Number Assignment

When a chunk spans multiple page markers (e.g., content from both page 3 and 4):
- Use the **first page marker** as the chunk's page number
- The chunk text still contains the `<!-- page N -->` markers for precise reference

### Chunk Boundary Handling

```typescript
// chunker.ts - key logic
function splitIntoChunks(parsedContent: string): ChunkData[] {
  const blocks = parsedContent.split('\n\n');
  let currentChunk = '';
  let currentPage = 1;
  let currentSection = '';

  for (const block of blocks) {
    // Extract page marker if present
    const pageMatch = block.match(/<!-- page (\d+) -->/);
    if (pageMatch) currentPage = parseInt(pageMatch[1]);

    // Extract section header if present
    const sectionMatch = block.match(/^#{1,3} (.+)$/m);
    if (sectionMatch) currentSection = sectionMatch[1];

    // Accumulate chunk content
    currentChunk += block + '\n\n';

    // Check if chunk is large enough
    if (estimateTokens(currentChunk) >= MIN_CHUNK_SIZE) {
      chunks.push(createChunk(currentChunk, currentPage, currentSection));
      currentChunk = '';
    }
  }
  // Handle remaining content
  if (currentChunk.trim()) {
    chunks.push(createChunk(currentChunk, currentPage, currentSection));
  }
  return chunks;
}
```

## Embedding Configuration

### Settings UI (same pattern as existing AI config)

| Config | Env Variable | Settings Key | Default |
|--------|--------------|--------------|---------|
| Embedding Model | `AI_EMBEDDING_MODEL` | `embeddingModel` | `text-embedding-3-small` |
| Use Same API | - | `useSameApiForEmbedding` | `true` |

### API Reuse Logic

```typescript
if (settings.useSameApiForEmbedding) {
  // Reuse existing baseUrl + apiKey
  embeddingBaseUrl = settings.baseUrl
  embeddingApiKey = settings.apiKey
} else {
  // Allow separate embedding service
  embeddingBaseUrl = settings.embeddingBaseUrl
  embeddingApiKey = settings.embeddingApiKey
}
```

### Settings UI Changes

**Existing fields**:
- Base URL
- API Key
- Model
- Vision Model

**New fields**:
- Embedding Model: `text-embedding-3-small` (text input)
- Use same API service: checkbox (default checked)
  - When unchecked, show:
    - Embedding Base URL
    - Embedding API Key

### Generation Timing

| Scenario | Handling |
|----------|----------|
| New paper upload | Frontend calls `/api/embed/{paperId}` POST after analysis SSE completes |
| Existing paper (no embeddings) | Generate on first chat query (async), fallback to full text temporarily |
| Model changed | "Regenerate index" button in Settings |

### Embedding Generation Trigger

**Frontend trigger (primary)**:

```typescript
// In use-sse.ts or analysis completion handler
useEffect(() => {
  if (analysisStatus === 'analyzed' && !embeddingsExist) {
    fetch(`/api/embed/${paperId}`, { method: 'POST' });
  }
}, [analysisStatus]);
```

**Fallback trigger (chat API)**:

```typescript
// In chat/route.ts
const embeddings = await storage.getEmbeddings(paperId);
if (!embeddings) {
  // Trigger async generation, use full text for this query
  triggerEmbeddingGeneration(paperId); // Fire-and-forget
  const parsedContent = await storage.getParsedContent(paperId);
  // Use full text for this query only
}
```

### Rate Limiting & Batch Processing

When regenerating all indexes (multiple papers):

```typescript
// Concurrency control for batch embedding
const BATCH_SIZE = 5; // Process 5 papers concurrently
const DELAY_MS = 1000; // 1 second delay between batches

for (const batch of chunk(papers, BATCH_SIZE)) {
  await Promise.all(batch.map(p => generateEmbeddings(p.id)));
  await sleep(DELAY_MS); // Avoid rate limits
}
```

## Retrieval Strategy

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `topK` | 3 | Default retrieved chunk count |
| `fallbackTopK` | 5 | Additional chunks when user requests more context |

### Process

```
User query → Embed query vector → Compute cosine similarity with all chunks → Get top-K → Return chunks
```

### Quote Handling

When user uses quote feature, the quoted text must be included in context:

```typescript
// retrieval.ts
function ensureQuoteIncluded(
  relevantChunks: ChunkData[],
  quote: TextSelection,
  allChunks: ChunkData[]
): ChunkData[] {
  // Find chunk containing the quoted text
  const quotedChunk = findChunkByText(allChunks, quote.text);

  if (!quotedChunk) return relevantChunks; // Quote not found in chunks

  // Check if already in top-k
  const alreadyIncluded = relevantChunks.some(c => c.id === quotedChunk.id);
  if (alreadyIncluded) return relevantChunks;

  // Replace lowest similarity chunk with quoted chunk
  // (Assuming relevantChunks is sorted by similarity descending)
  const result = [...relevantChunks];
  result[result.length - 1] = quotedChunk;
  return result;
}

function findChunkByText(chunks: ChunkData[], searchText: string): ChunkData | null {
  // Normalize both texts for comparison
  const normalizedSearch = normalizeText(searchText);

  for (const chunk of chunks) {
    const normalizedChunk = normalizeText(chunk.text);
    // Check if chunk contains at least 80% of the quoted text
    const overlapRatio = calculateOverlap(normalizedSearch, normalizedChunk);
    if (overlapRatio >= 0.8) return chunk;
  }
  return null;
}
```

**Quote context priority**:

When quote is used, the quoted chunk takes precedence over the lowest-similarity chunk in top-k, ensuring the user's focus is always included.

### Low Confidence Threshold

If top-1 chunk similarity < 0.3, show warning:

```typescript
const LOW_CONFIDENCE_THRESHOLD = 0.3;

if (relevantChunks[0].similarity < LOW_CONFIDENCE_THRESHOLD) {
  // Include in SSE response: { lowConfidence: true }
  // Frontend shows hint: "检索结果相关性较低，可能需要获取更多上下文"
}
```

## Chat API Modification

**`src/app/api/chat/route.ts`**:

```typescript
// Before
const parsedContent = await storage.getParsedContent(paperId);
const prompt = chatPromptTemplate.replaceAll('{content}', parsedContent);

// After
const analysis = await storage.getAnalysis(paperId);
const embeddings = await storage.getEmbeddings(paperId);

if (!embeddings) {
  // Fallback: trigger async generation, use full text for this query
  triggerEmbeddingGeneration(paperId);
  const parsedContent = await storage.getParsedContent(paperId);
  const prompt = chatPromptTemplate.replaceAll('{content}', parsedContent);
} else {
  const relevantChunks = await retrieval.search(message, embeddings, topK);
  if (quote) {
    relevantChunks = ensureQuoteIncluded(relevantChunks, quote, embeddings.chunks);
  }
  const contextContent = buildRAGContext(analysis, relevantChunks);
  const prompt = chatPromptTemplate.replaceAll('{content}', contextContent);
}
```

### buildRAGContext Function

```typescript
// retrieval.ts
function buildRAGContext(
  analysis: PaperAnalysis | null,
  chunks: ChunkData[]
): string {
  const parts: string[] = [];

  // Macro: Analysis summary
  if (analysis) {
    parts.push('[论文摘要]');
    parts.push(`- 核心思想：${analysis.summary.content}`);
    parts.push(`- 方法论：${analysis.methodology.content}`);
    parts.push(`- 实验：${analysis.experiments.content}`);
    parts.push(`- 结论：${analysis.conclusions.content}`);
    parts.push('');
  }

  // Micro: Relevant chunks
  parts.push('[与您问题相关的段落]');
  for (const chunk of chunks) {
    parts.push(`段落 (第${chunk.page}页，${chunk.section || '正文'})：`);
    parts.push(chunk.text);
    parts.push('');
  }

  return parts.join('\n');
}
```

**Prompt template**: `{content}` placeholder semantics unchanged, only content source changes.

### "Get More Context" Button Implementation

```typescript
// Frontend: chat-panel.tsx
const handleGetMoreContext = async () => {
  // Re-send the same question with higher topK
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      paperId,
      sessionId,
      message: lastUserMessage,
      expandContext: true  // Signal to use topK=5+3=8
    })
  });
};

// Backend: chat/route.ts
const topK = expandContext ? 8 : 3;
const relevantChunks = await retrieval.search(message, embeddings, topK);
```

### "Regenerate All Indexes" Button

```typescript
// API endpoint: /api/embed/regenerate-all
export async function POST(request: Request) {
  const papers = await storage.listPapers();

  // Batch process with rate limiting
  for (const batch of chunk(papers, BATCH_SIZE)) {
    await Promise.all(batch.map(async (paper) => {
      await storage.updateMetadata(paper.id, { embeddingStatus: 'generating' });
      try {
        await generateEmbeddings(paper.id);
        await storage.updateMetadata(paper.id, {
          embeddingStatus: 'generated',
          embeddingGeneratedAt: new Date().toISOString()
        });
      } catch (error) {
        await storage.updateMetadata(paper.id, {
          embeddingStatus: 'error',
          embeddingError: error.message
        });
      }
    }));
    await sleep(DELAY_MS);
  }

  return { success: true };
}
```

## Fallback & UX

### Fallback Scenarios

| Scenario | Handling |
|----------|----------|
| LLM indicates "need more info" | Show "Get more context" button |
| User unsatisfied | Show "Get more context" button |
| Low retrieval confidence | Auto-prompt "May need more context" |
| No embeddings.json | Generate async on first query, temporarily use full text |

### Frontend Interaction

```
[Chat message area]
┌─────────────────────────────────┐
│ User: What datasets were used?  │
├─────────────────────────────────┤
│ AI: Based on the paper...       │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 📄 获取更多上下文            │ │ ← Clickable button
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### Index Status Display (Settings page)

```
Paper Index Status:
✅ paper_1 (generated, using text-embedding-3-small)
⏳ paper_2 (generating...)
○ paper_3 (not generated, auto-generate on first query)

[Regenerate all indexes] button
```

## Performance Estimate

| Metric | Before | After |
|--------|--------|-------|
| Context tokens | ~12,000 | ~2,500 |
| Response latency | 3-5 seconds | 1-2 seconds |
| Cost per query | ~$0.03 | ~$0.008 |
| One-time embedding cost | - | ~$0.05-0.10 |

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `src/lib/embedding.ts` | Embedding API calls |
| `src/lib/chunker.ts` | Paper chunking logic |
| `src/lib/retrieval.ts` | Vector retrieval, buildRAGContext, ensureQuoteIncluded |
| `src/app/api/embed/[id]/route.ts` | Single paper embedding generation API (POST) |
| `src/app/api/embed/regenerate-all/route.ts` | Batch regenerate all indexes (POST) |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/storage.ts` | Add `getEmbeddings()`, `saveEmbeddings()`, update `getMetadata()` to include embeddingStatus |
| `src/lib/ai-config.ts` | Add embedding config reading |
| `src/app/api/chat/route.ts` | Use RAG context, add expandContext param, fallback logic |
| `src/types/index.ts` | Add `EmbeddingsData`, `ChunkData`, `EmbeddingSettings`, `EmbeddingStatus` types |
| `src/app/settings/page.tsx` | Add embedding model config UI, index status display |
| `src/components/chat-panel.tsx` | Add "Get more context" button, low confidence warning |
| `src/hooks/use-sse.ts` | Trigger embedding generation after analysis completes |

### Dependencies

```json
{
  "compute-cosine-similarity": "^1.0.0"
}
```

Lightweight npm dependency only (~KB), no local model files required.

## Type Definitions

```typescript
// src/types/index.ts

export type EmbeddingStatus = 'pending' | 'generating' | 'generated' | 'error';

export interface ChunkData {
  id: string;
  page: number;
  section: string;
  text: string;
  similarity?: number;  // Added during retrieval
}

export interface EmbeddingsData {
  chunks: ChunkData[];
  embeddings: number[][];  // Each embedding is a vector array
  generatedAt: string;
  model: string;
}

export interface EmbeddingSettings {
  embeddingModel: string;
  useSameApiForEmbedding: boolean;
  embeddingBaseUrl?: string;
  embeddingApiKey?: string;
}

// Add to PaperMetadata
export interface PaperMetadata {
  // ... existing fields
  embeddingStatus?: EmbeddingStatus;
  embeddingError?: string;
  embeddingGeneratedAt?: string;
}
```

## Implementation Notes

1. **Async embedding generation**: Don't block user on first query; generate in background, show spinner in UI
2. **Progress tracking**: `embeddingStatus` in metadata enables UI progress display and error handling
3. **Error handling**: If embedding API fails (`embeddingStatus: 'error'`), fallback to full text with error notification
4. **Quote priority**: Always include quoted paragraph in context when quote feature used
5. **Backwards compatibility**: Existing papers work seamlessly; embedding generated on-demand
6. **Rate limiting**: Batch embedding uses `BATCH_SIZE=5` with 1s delays to avoid API rate limits
7. **Low confidence threshold**: `0.3` - below this, show "may need more context" hint
8. **Page assignment**: Chunks spanning page boundaries use the first page marker as their page number
9. **Chunk size**: `MIN_CHUNK_SIZE=500` tokens, avoid too-small chunks for better semantic coherence