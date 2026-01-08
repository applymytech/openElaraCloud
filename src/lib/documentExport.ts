/**
 * Document Export System
 * 
 * Provides utilities for exporting AI-generated content in various formats:
 * - Markdown (.md)
 * - HTML (.html)
 * - Plain text (.txt)
 * - JSON (structured data)
 */

import { marked } from 'marked';

export type ExportFormat = 'markdown' | 'html' | 'txt' | 'json';

export interface ExportOptions {
  filename?: string;
  format: ExportFormat;
  includeMetadata?: boolean;
  metadata?: DocumentMetadata;
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  created?: Date;
  aiModel?: string;
  description?: string;
  tags?: string[];
}

/**
 * Export content to specified format and trigger browser download
 */
export async function exportDocument(
  content: string,
  options: ExportOptions
): Promise<void> {
  const { format, filename, includeMetadata, metadata } = options;
  
  let exportContent: string;
  let mimeType: string;
  let extension: string;
  
  switch (format) {
    case 'markdown':
      exportContent = includeMetadata 
        ? addMarkdownMetadata(content, metadata)
        : content;
      mimeType = 'text/markdown';
      extension = 'md';
      break;
    
    case 'html':
      exportContent = await convertToHTML(content, metadata, includeMetadata);
      mimeType = 'text/html';
      extension = 'html';
      break;
    
    case 'txt':
      exportContent = stripMarkdown(content);
      mimeType = 'text/plain';
      extension = 'txt';
      break;
    
    case 'json':
      exportContent = JSON.stringify({
        content,
        metadata,
        exportedAt: new Date().toISOString(),
      }, null, 2);
      mimeType = 'application/json';
      extension = 'json';
      break;
    
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
  
  // Trigger download
  const blob = new Blob([exportContent], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `document_${Date.now()}.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Add YAML frontmatter metadata to markdown
 */
function addMarkdownMetadata(content: string, metadata?: DocumentMetadata): string {
  if (!metadata) return content;
  
  let frontmatter = '---\n';
  if (metadata.title) frontmatter += `title: "${metadata.title}"\n`;
  if (metadata.author) frontmatter += `author: "${metadata.author}"\n`;
  if (metadata.created) frontmatter += `date: "${metadata.created.toISOString()}"\n`;
  if (metadata.aiModel) frontmatter += `ai_model: "${metadata.aiModel}"\n`;
  if (metadata.description) frontmatter += `description: "${metadata.description}"\n`;
  if (metadata.tags && metadata.tags.length > 0) {
    frontmatter += `tags: [${metadata.tags.map(t => `"${t}"`).join(', ')}]\n`;
  }
  frontmatter += '---\n\n';
  
  return frontmatter + content;
}

/**
 * Convert markdown to HTML with styling
 */
async function convertToHTML(
  content: string,
  metadata?: DocumentMetadata,
  includeMetadata?: boolean
): Promise<string> {
  const htmlBody = marked.parse(content) as string;
  
  const metadataSection = includeMetadata && metadata ? `
    <div class="document-metadata">
      ${metadata.title ? `<h1>${metadata.title}</h1>` : ''}
      ${metadata.author ? `<p class="author">By ${metadata.author}</p>` : ''}
      ${metadata.created ? `<p class="date">${metadata.created.toLocaleDateString()}</p>` : ''}
      ${metadata.description ? `<p class="description">${metadata.description}</p>` : ''}
      ${metadata.tags ? `<p class="tags">Tags: ${metadata.tags.join(', ')}</p>` : ''}
    </div>
    <hr/>
  ` : '';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${metadata?.title || 'Document'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      color: #333;
      background: #fff;
    }
    .document-metadata {
      margin-bottom: 40px;
      padding-bottom: 20px;
    }
    .document-metadata h1 {
      margin: 0 0 10px 0;
      font-size: 2.5em;
    }
    .document-metadata .author,
    .document-metadata .date,
    .document-metadata .description,
    .document-metadata .tags {
      margin: 5px 0;
      color: #666;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
    }
    h1 { font-size: 2em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }
    code {
      background: #f6f8fa;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    pre {
      background: #f6f8fa;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
    }
    pre code {
      background: none;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #ddd;
      margin: 0;
      padding-left: 20px;
      color: #666;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
    }
    table th,
    table td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    table th {
      background: #f6f8fa;
      font-weight: 600;
    }
    a {
      color: #0366d6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    hr {
      border: none;
      border-top: 2px solid #eee;
      margin: 32px 0;
    }
    @media print {
      body {
        margin: 0;
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  ${metadataSection}
  ${htmlBody}
  ${includeMetadata && metadata?.aiModel ? `
    <hr/>
    <footer style="font-size: 0.9em; color: #666; margin-top: 40px;">
      <p>Generated by ${metadata.aiModel} on ${new Date().toLocaleString()}</p>
    </footer>
  ` : ''}
</body>
</html>`;
}

/**
 * Strip markdown formatting for plain text export
 */
function stripMarkdown(content: string): string {
  return content
    .replace(/#{1,6}\s+/g, '') // Remove headings
    .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.+?)\*/g, '$1') // Remove italic
    .replace(/__(.+?)__/g, '$1') // Remove underline bold
    .replace(/_(.+?)_/g, '$1') // Remove underline italic
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links, keep text
    .replace(/!\[(.+?)\]\(.+?\)/g, '$1') // Remove images, keep alt text
    .replace(/```[\s\S]*?```/g, (match) => {
      // Preserve code blocks but remove language marker
      return match.replace(/```\w*\n/g, '').replace(/```/g, '');
    })
    .replace(/`(.+?)`/g, '$1') // Remove inline code markers
    .replace(/^>\s+/gm, '') // Remove blockquote markers
    .replace(/^\s*[-*+]\s+/gm, '• ') // Convert lists to bullets
    .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
    .trim();
}

/**
 * Export chat conversation as markdown
 */
export async function exportChatConversation(
  messages: Array<{ role: string; content: string }>,
  options: {
    filename?: string;
    format?: ExportFormat;
    includeMetadata?: boolean;
    characterName?: string;
  } = {}
): Promise<void> {
  const { format = 'markdown', includeMetadata = true, characterName } = options;
  
  // Build conversation content
  let content = '';
  for (const msg of messages) {
    const speaker = msg.role === 'user' ? 'You' : (characterName || 'Assistant');
    content += `**${speaker}:** ${msg.content}\n\n---\n\n`;
  }
  
  const metadata: DocumentMetadata = {
    title: 'Chat Conversation',
    author: characterName || 'AI Assistant',
    created: new Date(),
    description: 'Exported chat conversation',
  };
  
  await exportDocument(content, {
    filename: options.filename || `chat_${Date.now()}`,
    format,
    includeMetadata,
    metadata,
  });
}

/**
 * Copy content to clipboard (alternative to download)
 */
export async function copyToClipboard(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
