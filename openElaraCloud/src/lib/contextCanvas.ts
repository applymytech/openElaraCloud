import { db, auth } from './firebase';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  orderBy,
} from 'firebase/firestore';

// ============================================================================
// TYPES
// ============================================================================

export interface ContextCanvasFile {
  id: string;
  userId: string;
  filename: string;
  content: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    originalName?: string;
    language?: string; // For code files
    lineCount?: number;
  };
}

export interface ContextCanvasState {
  files: Map<string, ContextCanvasFile>;
  totalSize: number;
  totalTokens: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Max file size: 100KB (to keep context manageable)
const MAX_FILE_SIZE = 100 * 1024;

// Max total canvas size: 500KB
const MAX_CANVAS_SIZE = 500 * 1024;

// Max files in canvas
const MAX_FILES = 10;

// Supported file types
const SUPPORTED_EXTENSIONS = [
  '.txt', '.md', '.json', '.yaml', '.yml', '.xml',
  '.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.c', '.cpp', '.h',
  '.css', '.scss', '.less', '.html', '.htm',
  '.sql', '.sh', '.bash', '.ps1', '.bat',
  '.rs', '.go', '.rb', '.php', '.swift', '.kt',
  '.r', '.m', '.lua', '.pl', '.scala',
  '.toml', '.ini', '.env', '.cfg', '.conf',
];

// ============================================================================
// LOCAL STATE (in-memory cache synced with Firestore)
// ============================================================================

let canvasState: ContextCanvasState = {
  files: new Map(),
  totalSize: 0,
  totalTokens: 0,
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Load context canvas from Firestore
 */
export async function loadContextCanvas(): Promise<ContextCanvasState> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  const canvasQuery = await getDocs(
    query(
      collection(db, 'users', user.uid, 'contextCanvas'),
      orderBy('createdAt', 'asc')
    )
  );
  
  canvasState.files.clear();
  canvasState.totalSize = 0;
  canvasState.totalTokens = 0;
  
  for (const docSnap of canvasQuery.docs) {
    const data = docSnap.data();
    const file: ContextCanvasFile = {
      id: docSnap.id,
      userId: data.userId,
      filename: data.filename,
      content: data.content,
      mimeType: data.mimeType || 'text/plain',
      size: data.size || data.content?.length || 0,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      metadata: data.metadata,
    };
    
    canvasState.files.set(file.filename, file);
    canvasState.totalSize += file.size;
    canvasState.totalTokens += estimateTokens(file.content);
  }
  
  return canvasState;
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Pin a file to the context canvas
 */
export async function pinFile(
  file: File | { name: string; content: string; type?: string }
): Promise<ContextCanvasFile> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  // Validate file extension
  const extension = getFileExtension(file.name);
  if (!SUPPORTED_EXTENSIONS.includes(extension.toLowerCase())) {
    throw new Error(`Unsupported file type: ${extension}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`);
  }
  
  // Get content
  let content: string;
  if (file instanceof File) {
    content = await file.text();
  } else {
    content = file.content;
  }
  
  const size = content.length;
  
  // Check file size
  if (size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${formatBytes(size)}. Max: ${formatBytes(MAX_FILE_SIZE)}`);
  }
  
  // Check canvas capacity
  if (canvasState.files.size >= MAX_FILES && !canvasState.files.has(file.name)) {
    throw new Error(`Canvas full: ${MAX_FILES} files max. Unpin some files first.`);
  }
  
  // Check total size (excluding existing file if updating)
  const existingFile = canvasState.files.get(file.name);
  const existingSize = existingFile?.size || 0;
  if (canvasState.totalSize - existingSize + size > MAX_CANVAS_SIZE) {
    throw new Error(`Canvas size limit exceeded. Max: ${formatBytes(MAX_CANVAS_SIZE)}`);
  }
  
  // Detect language for code files
  const language = detectLanguage(file.name);
  
  const canvasFile: Omit<ContextCanvasFile, 'id'> = {
    userId: user.uid,
    filename: file.name,
    content,
    mimeType: (file instanceof File ? file.type : file.type) || 'text/plain',
    size,
    createdAt: existingFile?.createdAt || new Date(),
    updatedAt: new Date(),
    metadata: {
      originalName: file.name,
      language,
      lineCount: content.split('\n').length,
    },
  };
  
  let docId: string;
  
  if (existingFile) {
    // Update existing
    docId = existingFile.id;
    await updateDoc(doc(db, 'users', user.uid, 'contextCanvas', docId), {
      ...canvasFile,
      createdAt: Timestamp.fromDate(canvasFile.createdAt),
      updatedAt: Timestamp.fromDate(canvasFile.updatedAt),
    });
    
    // Update local state
    canvasState.totalSize -= existingFile.size;
    canvasState.totalTokens -= estimateTokens(existingFile.content);
  } else {
    // Create new
    const docRef = await addDoc(collection(db, 'users', user.uid, 'contextCanvas'), {
      ...canvasFile,
      createdAt: Timestamp.fromDate(canvasFile.createdAt),
      updatedAt: Timestamp.fromDate(canvasFile.updatedAt),
    });
    docId = docRef.id;
  }
  
  const result: ContextCanvasFile = { id: docId, ...canvasFile };
  
  // Update local state
  canvasState.files.set(file.name, result);
  canvasState.totalSize += size;
  canvasState.totalTokens += estimateTokens(content);
  
  return result;
}

/**
 * Unpin a file from the context canvas
 */
export async function unpinFile(filename: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  const file = canvasState.files.get(filename);
  if (!file) {
    throw new Error(`File not in canvas: ${filename}`);
  }
  
  await deleteDoc(doc(db, 'users', user.uid, 'contextCanvas', file.id));
  
  // Update local state
  canvasState.files.delete(filename);
  canvasState.totalSize -= file.size;
  canvasState.totalTokens -= estimateTokens(file.content);
}

/**
 * Clear all files from the context canvas
 */
export async function clearCanvas(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  
  const canvasQuery = await getDocs(
    collection(db, 'users', user.uid, 'contextCanvas')
  );
  
  // Delete all documents
  const deletePromises = canvasQuery.docs.map(docSnap =>
    deleteDoc(doc(db, 'users', user.uid, 'contextCanvas', docSnap.id))
  );
  
  await Promise.all(deletePromises);
  
  // Reset local state
  canvasState.files.clear();
  canvasState.totalSize = 0;
  canvasState.totalTokens = 0;
}

// ============================================================================
// CONTEXT BUILDING (for chat integration)
// ============================================================================

/**
 * Build context canvas prefix for message injection
 * Matches desktop app format exactly
 */
export function buildContextCanvasPrefix(): string {
  if (canvasState.files.size === 0) {
    return '--- START OF CONTEXT CANVAS ---\n[No files in context canvas this turn]\n--- END OF CONTEXT CANVAS ---\n\n';
  }
  
  let prefix = '--- START OF CONTEXT CANVAS ---\n';
  
  for (const [filename, file] of Array.from(canvasState.files.entries())) {
    prefix += `\n{${filename}}\n${file.content}\n`;
  }
  
  prefix += '--- END OF CONTEXT CANVAS ---\n\n';
  
  return prefix;
}

/**
 * Get context canvas as a simple object (for API calls)
 * Returns { filename: content } format
 */
export function getContextCanvasFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  
  for (const [filename, file] of Array.from(canvasState.files.entries())) {
    files[filename] = file.content;
  }
  
  return files;
}

/**
 * Build full context with attached files and RAG
 * This is the main function for preparing messages with context
 */
export function buildFullContextPrefix(
  attachedFiles?: { filename: string; content: string }[],
  ragContext?: string | null
): string {
  let prefix = '';
  
  // 1. Context Canvas (persistent)
  prefix += buildContextCanvasPrefix();
  
  // 2. Attached Files (single-turn)
  if (attachedFiles && attachedFiles.length > 0) {
    prefix += '--- START OF ATTACHED FILES ---\n';
    for (const file of attachedFiles) {
      prefix += `\n{${file.filename}}\n${file.content}\n`;
    }
    prefix += '--- END OF ATTACHED FILES ---\n\n';
  } else {
    prefix += '--- START OF ATTACHED FILES ---\n[No files attached this turn]\n--- END OF ATTACHED FILES ---\n\n';
  }
  
  // 3. RAG Context
  if (ragContext) {
    prefix += `${ragContext}\n\n`;
  }
  
  // 4. Separator before user request
  if (prefix) {
    prefix += `
════════════════════════════════════════════════════════════════
██  USER REQUEST - THIS IS THE TASK  ██
════════════════════════════════════════════════════════════════

`;
  }
  
  return prefix;
}

// ============================================================================
// GETTERS
// ============================================================================

/**
 * Get current canvas state
 */
export function getCanvasState(): ContextCanvasState {
  return canvasState;
}

/**
 * Get list of pinned files
 */
export function getPinnedFiles(): ContextCanvasFile[] {
  return Array.from(canvasState.files.values());
}

/**
 * Check if a file is pinned
 */
export function isFilePinned(filename: string): boolean {
  return canvasState.files.has(filename);
}

/**
 * Get canvas statistics
 */
export function getCanvasStats(): {
  fileCount: number;
  totalSize: number;
  totalTokens: number;
  maxFiles: number;
  maxSize: number;
} {
  return {
    fileCount: canvasState.files.size,
    totalSize: canvasState.totalSize,
    totalTokens: canvasState.totalTokens,
    maxFiles: MAX_FILES,
    maxSize: MAX_CANVAS_SIZE,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.slice(lastDot) : '';
}

function detectLanguage(filename: string): string | undefined {
  const ext = getFileExtension(filename).toLowerCase();
  
  const languageMap: Record<string, string> = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescriptreact',
    '.jsx': 'javascriptreact',
    '.py': 'python',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.html': 'html',
    '.htm': 'html',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.xml': 'xml',
    '.md': 'markdown',
    '.sql': 'sql',
    '.sh': 'bash',
    '.bash': 'bash',
    '.ps1': 'powershell',
    '.bat': 'batch',
    '.rs': 'rust',
    '.go': 'go',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.r': 'r',
    '.m': 'objective-c',
    '.lua': 'lua',
    '.pl': 'perl',
    '.scala': 'scala',
  };
  
  return languageMap[ext];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function estimateTokens(text: string): number {
  // ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  MAX_FILE_SIZE,
  MAX_CANVAS_SIZE,
  MAX_FILES,
  SUPPORTED_EXTENSIONS,
};
