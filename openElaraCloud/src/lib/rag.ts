/**
 * RAG Service for OpenElara Cloud
 * 
 * PORTED FROM DESKTOP: src/main/rag/embeddingService.js
 * 
 * Provides retrieval-augmented generation through:
 * - Together.ai embeddings API (cloud-first, no native modules)
 * - Conversation history (auto-ingested)
 * - Custom knowledge files (markdown converted)
 * - User manual (always available)
 * 
 * Data stored in Firestore with embeddings for semantic search.
 * Uses M2-BERT-32k model which is available on Together.ai.
 */

import { db, auth } from './firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  deleteDoc,
  Timestamp,
  orderBy,
  limit,
  addDoc
} from 'firebase/firestore';
import { updateStorageUsage } from './storage';
import { getAPIKey } from './byok';

// ============================================================================
// EMBEDDING CONSTANTS
// ============================================================================

const EMBEDDING_MODEL = 'togethercomputer/m2-bert-80M-32k-retrieval';
const EMBEDDING_DIMENSION = 768; // M2-BERT output dimension

// LRU Cache for embeddings (in-memory)
const EMBEDDING_CACHE_MAX = 1000;
const embeddingCache = new Map<string, number[]>();
const cacheOrder: string[] = [];

// ============================================================================
// RAG DOCUMENT TYPES
// ============================================================================

export interface RAGDocument {
  id: string;
  userId: string;
  type: 'conversation' | 'knowledge' | 'manual';
  title: string;
  content: string;           // Markdown content
  tokens: number;            // Approximate token count
  embedding?: number[];      // Vector embedding from Together.ai
  createdAt: Date;
  updatedAt: Date;
  metadata: {
    source?: string;         // Original filename or 'conversation'
    conversationId?: string; // For conversation chunks
    tags?: string[];
  };
}

export interface RAGSearchResult {
  document: RAGDocument;
  relevance: number;         // 0-1 score (cosine similarity)
  snippet: string;           // Relevant excerpt
}

// ============================================================================
// EMBEDDING SERVICE (from desktop embeddingService.js)
// ============================================================================

/**
 * Get embedding from cache (LRU)
 */
function getCachedEmbedding(text: string): number[] | null {
  const key = `${EMBEDDING_MODEL}::${text.slice(0, 500)}`; // Cache key with truncated text
  if (embeddingCache.has(key)) {
    // Move to end (most recently used)
    const idx = cacheOrder.indexOf(key);
    if (idx > -1) {
      cacheOrder.splice(idx, 1);
      cacheOrder.push(key);
    }
    return embeddingCache.get(key) || null;
  }
  return null;
}

/**
 * Set embedding in cache (LRU)
 */
function setCachedEmbedding(text: string, embedding: number[]): void {
  const key = `${EMBEDDING_MODEL}::${text.slice(0, 500)}`;
  
  // Evict oldest if at capacity
  if (embeddingCache.size >= EMBEDDING_CACHE_MAX) {
    const oldest = cacheOrder.shift();
    if (oldest) embeddingCache.delete(oldest);
  }
  
  embeddingCache.set(key, embedding);
  cacheOrder.push(key);
}

/**
 * Get embedding from Together.ai API
 * Uses M2-BERT-32k which is available on Together.ai
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = getAPIKey('together');
  
  if (!apiKey) {
    throw new Error('Together.ai API Key required for embeddings. Configure in Settings → API Keys.');
  }
  
  // Check cache first
  const cached = getCachedEmbedding(text);
  if (cached) {
    console.debug('[RAG] Embedding cache HIT');
    return cached;
  }
  
  try {
    const response = await fetch('https://api.together.xyz/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Embedding API error: ${error.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    const embedding = data.data[0].embedding;
    
    // Cache result
    setCachedEmbedding(text, embedding);
    
    return embedding;
  } catch (error: any) {
    console.error('[RAG] Embedding error:', error.message);
    throw error;
  }
}

/**
 * Batch embed multiple texts
 */
export async function batchEmbed(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  
  for (const text of texts) {
    const embedding = await getEmbedding(text);
    results.push(embedding);
  }
  
  return results;
}

/**
 * Compute cosine similarity between two embeddings
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

// ============================================================================
// CONVERSATION HISTORY INGESTION
// ============================================================================

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

/**
 * Ingest a conversation into RAG with embeddings
 * Converts to markdown format for efficient retrieval
 */
export async function ingestConversation(
  conversationId: string,
  messages: ConversationMessage[],
  title?: string
): Promise<RAGDocument> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  // Convert to markdown
  const markdown = convertConversationToMarkdown(messages, title);
  const tokens = estimateTokens(markdown);
  
  // Generate embedding for semantic search
  let embedding: number[] | undefined;
  try {
    // Use a summary of the conversation for embedding
    const summary = messages
      .filter(m => m.role !== 'system')
      .map(m => m.content)
      .join(' ')
      .slice(0, 8000); // Limit for embedding model
    embedding = await getEmbedding(summary);
  } catch (e) {
    console.warn('[RAG] Could not generate embedding:', e);
    // Continue without embedding - fallback to keyword search
  }
  
  // Check if conversation already exists
  const existingQuery = query(
    collection(db, 'users', user.uid, 'rag'),
    where('type', '==', 'conversation'),
    where('metadata.conversationId', '==', conversationId)
  );
  
  const existing = await getDocs(existingQuery);
  
  const ragDoc: Omit<RAGDocument, 'id'> = {
    userId: user.uid,
    type: 'conversation',
    title: title || `Conversation ${new Date().toLocaleDateString()}`,
    content: markdown,
    tokens,
    embedding,
    createdAt: existing.empty ? new Date() : existing.docs[0].data().createdAt?.toDate() || new Date(),
    updatedAt: new Date(),
    metadata: {
      source: 'conversation',
      conversationId,
    },
  };
  
  let docId: string;
  let sizeChange: number;
  
  if (!existing.empty) {
    // Update existing
    docId = existing.docs[0].id;
    const oldSize = existing.docs[0].data().content?.length || 0;
    sizeChange = markdown.length - oldSize;
    
    await updateDoc(doc(db, 'users', user.uid, 'rag', docId), {
      ...ragDoc,
      createdAt: Timestamp.fromDate(ragDoc.createdAt),
      updatedAt: Timestamp.fromDate(ragDoc.updatedAt),
    });
  } else {
    // Create new
    const docRef = await addDoc(collection(db, 'users', user.uid, 'rag'), {
      ...ragDoc,
      createdAt: Timestamp.fromDate(ragDoc.createdAt),
      updatedAt: Timestamp.fromDate(ragDoc.updatedAt),
    });
    docId = docRef.id;
    sizeChange = markdown.length;
  }
  
  // Update storage usage
  await updateStorageUsage(sizeChange, 'rag');
  
  return { id: docId, ...ragDoc };
}

function convertConversationToMarkdown(
  messages: ConversationMessage[],
  title?: string
): string {
  const lines: string[] = [];
  
  if (title) {
    lines.push(`# ${title}`);
    lines.push('');
  }
  
  lines.push(`_Conversation from ${new Date().toLocaleString()}_`);
  lines.push('');
  
  for (const msg of messages) {
    if (msg.role === 'system') continue; // Skip system prompts
    
    const speaker = msg.role === 'user' ? '**User**' : '**Elara**';
    lines.push(`${speaker}:`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  
  return lines.join('\n');
}

// ============================================================================
// KNOWLEDGE FILE INGESTION
// ============================================================================

/**
 * Ingest a knowledge file into RAG with embeddings
 * Supports: .txt, .md, .pdf (text extracted), .docx (text extracted)
 */
export async function ingestKnowledgeFile(
  file: File,
  tags?: string[]
): Promise<RAGDocument> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  // Convert file to markdown
  let content: string;
  
  if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
    content = await file.text();
  } else if (file.type === 'text/markdown' || file.name.endsWith('.md')) {
    content = await file.text();
  } else {
    // For other formats, try to extract text
    // In production, you'd use a PDF/DOCX parser
    content = await file.text();
  }
  
  // Wrap in markdown with metadata
  const markdown = `# ${file.name}\n\n_Uploaded: ${new Date().toLocaleString()}_\n\n---\n\n${content}`;
  const tokens = estimateTokens(markdown);
  
  // Generate embedding for semantic search
  let embedding: number[] | undefined;
  try {
    // Use content (truncated if needed) for embedding
    const textForEmbedding = content.slice(0, 8000);
    embedding = await getEmbedding(textForEmbedding);
  } catch (e) {
    console.warn('[RAG] Could not generate embedding for file:', e);
  }
  
  const ragDoc: Omit<RAGDocument, 'id'> = {
    userId: user.uid,
    type: 'knowledge',
    title: file.name,
    content: markdown,
    tokens,
    embedding,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      source: file.name,
      tags: tags || [],
    },
  };
  
  const docRef = await addDoc(collection(db, 'users', user.uid, 'rag'), {
    ...ragDoc,
    createdAt: Timestamp.fromDate(ragDoc.createdAt),
    updatedAt: Timestamp.fromDate(ragDoc.updatedAt),
  });
  
  // Update storage usage
  await updateStorageUsage(markdown.length, 'rag');
  
  return { id: docRef.id, ...ragDoc };
}

// ============================================================================
// RAG SEARCH - SEMANTIC SEARCH WITH EMBEDDINGS
// ============================================================================

/**
 * Search RAG documents using semantic similarity (embeddings)
 * Falls back to keyword search if embeddings unavailable
 */
export async function searchRAG(
  queryText: string,
  maxResults: number = 5,
  options: {
    minSimilarity?: number;
    type?: 'conversation' | 'knowledge' | 'all';
    useKeywordFallback?: boolean;
  } = {}
): Promise<RAGSearchResult[]> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  const { 
    minSimilarity = 0.3, 
    type = 'all',
    useKeywordFallback = true 
  } = options;
  
  // Get all RAG documents
  let ragQuery;
  if (type !== 'all') {
    ragQuery = await getDocs(
      query(
        collection(db, 'users', user.uid, 'rag'),
        where('type', '==', type)
      )
    );
  } else {
    ragQuery = await getDocs(
      collection(db, 'users', user.uid, 'rag')
    );
  }
  
  const documents: RAGDocument[] = ragQuery.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  } as RAGDocument));
  
  if (documents.length === 0) {
    return [];
  }
  
  // Try semantic search with embeddings
  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await getEmbedding(queryText);
  } catch (e) {
    console.warn('[RAG] Could not get query embedding, falling back to keyword search:', e);
  }
  
  const results: RAGSearchResult[] = [];
  
  for (const doc of documents) {
    let relevance = 0;
    
    // Use embedding similarity if available
    if (queryEmbedding && doc.embedding && doc.embedding.length > 0) {
      relevance = cosineSimilarity(queryEmbedding, doc.embedding);
    } else if (useKeywordFallback) {
      // Fallback to keyword search
      relevance = calculateKeywordRelevance(doc.content, queryText);
    }
    
    if (relevance >= minSimilarity) {
      const snippet = findBestSnippet(doc.content, queryText.toLowerCase().split(/\s+/));
      results.push({ document: doc, relevance, snippet });
    }
  }
  
  // Sort by relevance (highest first)
  results.sort((a, b) => b.relevance - a.relevance);
  
  return results.slice(0, maxResults);
}

/**
 * Search using ONLY semantic similarity (no keyword fallback)
 * Use when you want pure vector search
 */
export async function semanticSearchRAG(
  queryText: string,
  maxResults: number = 5,
  minSimilarity: number = 0.5
): Promise<RAGSearchResult[]> {
  return searchRAG(queryText, maxResults, {
    minSimilarity,
    useKeywordFallback: false,
  });
}

/**
 * Calculate keyword relevance score (0-1)
 */
function calculateKeywordRelevance(content: string, queryText: string): number {
  const contentLower = content.toLowerCase();
  const queryTerms = queryText.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  if (queryTerms.length === 0) return 0;
  
  let matches = 0;
  let weightedScore = 0;
  
  for (const term of queryTerms) {
    if (contentLower.includes(term)) {
      matches++;
      
      // Boost for exact phrase matches
      const exactPhrase = queryTerms.join(' ');
      if (contentLower.includes(exactPhrase)) {
        weightedScore += 0.5;
      }
      
      // Boost for multiple occurrences
      const occurrences = (contentLower.match(new RegExp(term, 'g')) || []).length;
      weightedScore += Math.min(occurrences * 0.1, 0.3);
    }
  }
  
  const baseScore = matches / queryTerms.length;
  return Math.min(1, baseScore + weightedScore);
}

function findBestSnippet(content: string, terms: string[]): string {
  const contentLower = content.toLowerCase();
  
  // Find first occurrence of any term
  let bestIndex = -1;
  let bestTerm = '';
  for (const term of terms) {
    if (term.length < 3) continue;
    const idx = contentLower.indexOf(term);
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
      bestIndex = idx;
      bestTerm = term;
    }
  }
  
  if (bestIndex === -1) {
    return content.slice(0, 300) + '...';
  }
  
  // Extract surrounding context with more on the right
  const start = Math.max(0, bestIndex - 80);
  const end = Math.min(content.length, bestIndex + 220);
  
  let snippet = content.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  
  return snippet;
}

/**
 * Hybrid search: combines semantic and keyword search
 * Weights: 70% semantic, 30% keyword
 */
export async function hybridSearchRAG(
  queryText: string,
  maxResults: number = 5
): Promise<RAGSearchResult[]> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  const ragQuery = await getDocs(
    collection(db, 'users', user.uid, 'rag')
  );
  
  const documents: RAGDocument[] = ragQuery.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  } as RAGDocument));
  
  if (documents.length === 0) return [];
  
  // Get query embedding
  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await getEmbedding(queryText);
  } catch (e) {
    console.warn('[RAG] Embedding failed, using keyword only');
  }
  
  const results: RAGSearchResult[] = [];
  
  for (const doc of documents) {
    // Calculate semantic score
    let semanticScore = 0;
    if (queryEmbedding && doc.embedding && doc.embedding.length > 0) {
      semanticScore = cosineSimilarity(queryEmbedding, doc.embedding);
    }
    
    // Calculate keyword score
    const keywordScore = calculateKeywordRelevance(doc.content, queryText);
    
    // Hybrid score: weight semantic higher when available
    let relevance: number;
    if (semanticScore > 0) {
      relevance = (semanticScore * 0.7) + (keywordScore * 0.3);
    } else {
      relevance = keywordScore;
    }
    
    if (relevance > 0.2) {
      const snippet = findBestSnippet(doc.content, queryText.toLowerCase().split(/\s+/));
      results.push({ document: doc, relevance, snippet });
    }
  }
  
  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, maxResults);
}

// ============================================================================
// BUILD RAG CONTEXT FOR CHAT
// ============================================================================

/**
 * Build a context string from RAG results for injection into chat
 */
export async function buildRAGContext(userMessage: string): Promise<string | null> {
  try {
    const results = await searchRAG(userMessage, 3);
    
    if (results.length === 0) return null;
    
    const contextParts: string[] = [
      '## Relevant Context from Your Knowledge Base\n',
    ];
    
    for (const result of results) {
      contextParts.push(`### ${result.document.title}`);
      contextParts.push(result.snippet);
      contextParts.push('');
    }
    
    return contextParts.join('\n');
  } catch (e) {
    console.warn('RAG search failed:', e);
    return null;
  }
}

// ============================================================================
// RAG MANAGEMENT
// ============================================================================

/**
 * List all RAG documents
 */
export async function listRAGDocuments(): Promise<RAGDocument[]> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  const ragQuery = await getDocs(
    query(
      collection(db, 'users', user.uid, 'rag'),
      orderBy('updatedAt', 'desc')
    )
  );
  
  return ragQuery.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  } as RAGDocument));
}

/**
 * Delete a RAG document
 */
export async function deleteRAGDocument(docId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  const docRef = doc(db, 'users', user.uid, 'rag', docId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const size = docSnap.data().content?.length || 0;
    await deleteDoc(docRef);
    await updateStorageUsage(-size, 'rag');
  }
}

/**
 * Get RAG stats
 */
export async function getRAGStats(): Promise<{
  totalDocuments: number;
  totalTokens: number;
  byType: Record<string, number>;
}> {
  const documents = await listRAGDocuments();
  
  const stats = {
    totalDocuments: documents.length,
    totalTokens: documents.reduce((sum, d) => sum + d.tokens, 0),
    byType: {} as Record<string, number>,
  };
  
  for (const doc of documents) {
    stats.byType[doc.type] = (stats.byType[doc.type] || 0) + 1;
  }
  
  return stats;
}

// ============================================================================
// UTILITIES
// ============================================================================

function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}
