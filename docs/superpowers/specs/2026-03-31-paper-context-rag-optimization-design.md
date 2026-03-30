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
2. **Analysis Complete**: Trigger embedding generation automatically
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
| New paper upload | Auto-trigger after analysis complete |
| Existing paper (no embeddings) | Generate on first chat query (async), fallback to full text temporarily |
| Model changed | "Regenerate index" button in Settings |

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

When user uses quote feature:

```typescript
if (quote) {
  // Ensure quoted paragraph is included in context
  relevantChunks = ensureQuoteIncluded(relevantChunks, quote, embeddings.chunks)
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
const relevantChunks = await retrieval.search(message, embeddings, topK=3);

const contextContent = buildRAGContext(analysis, relevantChunks);
const prompt = chatPromptTemplate.replaceAll('{content}', contextContent);
```

**Prompt template**: `{content}` placeholder semantics unchanged, only content source changes.

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
| `src/lib/retrieval.ts` | Vector retrieval |
| `src/app/api/embed/[id]/route.ts` | Embedding generation API |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/storage.ts` | Add `getEmbeddings()`, `saveEmbeddings()` |
| `src/lib/ai-config.ts` | Add embedding config reading |
| `src/app/api/chat/route.ts` | Use RAG context instead of full text |
| `src/types/index.ts` | Add `EmbeddingsData` type |
| `src/app/settings/page.tsx` | Add embedding model config UI |
| `src/components/chat-panel.tsx` | Add "Get more context" button |

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

export interface ChunkData {
  id: string;
  page: number;
  section: string;
  text: string;
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
```

## Implementation Notes

1. **Async embedding generation**: Don't block user on first query; generate in background
2. **Progress tracking**: Store generation status in metadata for UI display
3. **Error handling**: If embedding API fails, fallback to full text temporarily
4. **Quote priority**: Always include quoted paragraph in context when quote feature used
5. **Backwards compatibility**: Existing papers work seamlessly; embedding generated on-demand