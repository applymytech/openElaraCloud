/**
 * File Conversion Service for OpenElara Cloud
 *
 * Browser-based file conversion using:
 * - FileReader API for text/code files
 * - Browser native canvas for basic image operations
 * - Third-party libraries for advanced conversions
 *
 * Converts files TO markdown for AI context ingestion.
 */

// ============================================================================
// SUPPORTED FORMATS
// ============================================================================

export const SUPPORTED_TEXT_FORMATS = [
	".txt",
	".md",
	".markdown",
	".json",
	".csv",
	".xml",
	".yaml",
	".yml",
	".html",
	".htm",
	".rtf",
];

export const SUPPORTED_CODE_FORMATS = [
	".js",
	".ts",
	".jsx",
	".tsx",
	".py",
	".java",
	".c",
	".cpp",
	".h",
	".hpp",
	".cs",
	".go",
	".rs",
	".rb",
	".php",
	".swift",
	".kt",
	".scala",
	".r",
	".sql",
	".sh",
	".bash",
	".ps1",
	".bat",
	".cmd",
	".css",
	".scss",
	".sass",
	".less",
	".vue",
	".svelte",
	".astro",
	".toml",
	".ini",
	".cfg",
	".conf",
	".env",
];

export const SUPPORTED_IMAGE_FORMATS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"];

export function getSupportedExtensions(): string[] {
	return [...SUPPORTED_TEXT_FORMATS, ...SUPPORTED_CODE_FORMATS, ...SUPPORTED_IMAGE_FORMATS];
}

export function isTextFile(filename: string): boolean {
	const ext = getExtension(filename);
	return SUPPORTED_TEXT_FORMATS.includes(ext) || SUPPORTED_CODE_FORMATS.includes(ext);
}

export function isCodeFile(filename: string): boolean {
	const ext = getExtension(filename);
	return SUPPORTED_CODE_FORMATS.includes(ext);
}

export function isImageFile(filename: string): boolean {
	const ext = getExtension(filename);
	return SUPPORTED_IMAGE_FORMATS.includes(ext);
}

function getExtension(filename: string): string {
	const lastDot = filename.lastIndexOf(".");
	if (lastDot === -1) {
		return "";
	}
	return filename.slice(lastDot).toLowerCase();
}

// ============================================================================
// LANGUAGE DETECTION FOR CODE FILES
// ============================================================================

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
	".js": "javascript",
	".ts": "typescript",
	".jsx": "jsx",
	".tsx": "tsx",
	".py": "python",
	".java": "java",
	".c": "c",
	".cpp": "cpp",
	".h": "c",
	".hpp": "cpp",
	".cs": "csharp",
	".go": "go",
	".rs": "rust",
	".rb": "ruby",
	".php": "php",
	".swift": "swift",
	".kt": "kotlin",
	".scala": "scala",
	".r": "r",
	".sql": "sql",
	".sh": "bash",
	".bash": "bash",
	".ps1": "powershell",
	".bat": "batch",
	".cmd": "batch",
	".css": "css",
	".scss": "scss",
	".sass": "sass",
	".less": "less",
	".vue": "vue",
	".svelte": "svelte",
	".astro": "astro",
	".html": "html",
	".htm": "html",
	".xml": "xml",
	".json": "json",
	".yaml": "yaml",
	".yml": "yaml",
	".toml": "toml",
	".ini": "ini",
	".md": "markdown",
	".markdown": "markdown",
};

function getLanguage(filename: string): string {
	const ext = getExtension(filename);
	return EXTENSION_TO_LANGUAGE[ext] || "text";
}

// ============================================================================
// CONVERSION RESULT TYPE
// ============================================================================

export interface ConversionResult {
	success: boolean;
	markdown?: string;
	filename: string;
	originalSize: number;
	convertedSize?: number;
	error?: string;
}

// ============================================================================
// TEXT/CODE FILE CONVERSION
// ============================================================================

/**
 * Convert a text or code file to markdown
 */
export async function convertTextFile(file: File): Promise<ConversionResult> {
	try {
		const content = await readFileAsText(file);
		const ext = getExtension(file.name);

		let markdown: string;

		if (ext === ".md" || ext === ".markdown") {
			// Already markdown - just clean it up
			markdown = content;
		} else if (ext === ".json") {
			markdown = convertJsonToMarkdown(content, file.name);
		} else if (ext === ".csv") {
			markdown = convertCsvToMarkdown(content, file.name);
		} else if (ext === ".html" || ext === ".htm") {
			markdown = convertHtmlToMarkdown(content, file.name);
		} else if (isCodeFile(file.name)) {
			markdown = convertCodeToMarkdown(content, file.name);
		} else {
			// Plain text - wrap in markdown
			markdown = `# ${file.name}\n\n${content}`;
		}

		return {
			success: true,
			markdown,
			filename: file.name,
			originalSize: file.size,
			convertedSize: new Blob([markdown]).size,
		};
	} catch (error: any) {
		return {
			success: false,
			filename: file.name,
			originalSize: file.size,
			error: error.message || "Conversion failed",
		};
	}
}

/**
 * Read file as text using FileReader API
 */
function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.readAsText(file);
	});
}

/**
 * Read file as data URL (for images)
 */
function readFileAsDataURL(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.readAsDataURL(file);
	});
}

// ============================================================================
// FORMAT-SPECIFIC CONVERTERS
// ============================================================================

/**
 * Convert JSON to readable markdown
 */
function convertJsonToMarkdown(content: string, filename: string): string {
	try {
		const json = JSON.parse(content);
		const prettyJson = JSON.stringify(json, null, 2);
		return `# ${filename}\n\n\`\`\`json\n${prettyJson}\n\`\`\``;
	} catch {
		// Invalid JSON - treat as plain text
		return `# ${filename}\n\n\`\`\`json\n${content}\n\`\`\``;
	}
}

/**
 * Convert CSV to markdown table
 */
function convertCsvToMarkdown(content: string, filename: string): string {
	const lines = content.split("\n").filter((line) => line.trim());
	if (lines.length === 0) {
		return `# ${filename}\n\n(Empty CSV file)`;
	}

	const rows = lines.map((line) => parseCSVRow(line));

	if (rows.length === 0) {
		return `# ${filename}\n\n(No data)`;
	}

	// First row is header
	const header = rows[0];
	const headerRow = `| ${header.join(" | ")} |`;
	const separator = `| ${header.map(() => "---").join(" | ")} |`;

	const dataRows = rows.slice(1).map((row) => {
		// Pad row to match header length
		while (row.length < header.length) {
			row.push("");
		}
		return `| ${row.join(" | ")} |`;
	});

	return `# ${filename}\n\n${headerRow}\n${separator}\n${dataRows.join("\n")}`;
}

/**
 * Parse a single CSV row (handles quoted values)
 */
function parseCSVRow(line: string): string[] {
	const result: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === "," && !inQuotes) {
			result.push(current.trim());
			current = "";
		} else {
			current += char;
		}
	}

	result.push(current.trim());
	return result;
}

/**
 * Convert HTML to markdown (basic)
 */
function convertHtmlToMarkdown(content: string, filename: string): string {
	// Create a temporary DOM element to parse HTML
	const parser = new DOMParser();
	const doc = parser.parseFromString(content, "text/html");

	// Extract text content with basic structure
	let markdown = `# ${filename}\n\n`;

	// Get title if present
	const title = doc.querySelector("title");
	if (title?.textContent) {
		markdown += `**Title:** ${title.textContent}\n\n`;
	}

	// Convert body content
	const body = doc.body;
	if (body) {
		markdown += convertNodeToMarkdown(body);
	}

	return markdown;
}

/**
 * Recursively convert DOM nodes to markdown
 */
function convertNodeToMarkdown(node: Node): string {
	let result = "";

	for (const child of Array.from(node.childNodes)) {
		if (child.nodeType === Node.TEXT_NODE) {
			const text = child.textContent?.trim();
			if (text) {
				result += `${text} `;
			}
		} else if (child.nodeType === Node.ELEMENT_NODE) {
			const element = child as Element;
			const tag = element.tagName.toLowerCase();

			switch (tag) {
				case "h1":
					result += `\n# ${element.textContent}\n\n`;
					break;
				case "h2":
					result += `\n## ${element.textContent}\n\n`;
					break;
				case "h3":
					result += `\n### ${element.textContent}\n\n`;
					break;
				case "h4":
				case "h5":
				case "h6":
					result += `\n#### ${element.textContent}\n\n`;
					break;
				case "p":
					result += `\n${convertNodeToMarkdown(element)}\n`;
					break;
				case "br":
					result += "\n";
					break;
				case "strong":
				case "b":
					result += `**${element.textContent}**`;
					break;
				case "em":
				case "i":
					result += `*${element.textContent}*`;
					break;
				case "code":
					result += `\`${element.textContent}\``;
					break;
				case "pre":
					result += `\n\`\`\`\n${element.textContent}\n\`\`\`\n`;
					break;
				case "a": {
					const href = element.getAttribute("href");
					result += `[${element.textContent}](${href || "#"})`;
					break;
				}
				case "ul":
				case "ol":
					result += `\n${convertListToMarkdown(element, tag === "ol")}\n`;
					break;
				case "li":
					// Handled by parent list converter
					break;
				case "blockquote":
					result += `\n> ${element.textContent}\n`;
					break;
				case "script":
				case "style":
				case "nav":
				case "footer":
				case "header":
					// Skip these elements
					break;
				default:
					result += convertNodeToMarkdown(element);
			}
		}
	}

	return result;
}

/**
 * Convert list elements to markdown
 */
function convertListToMarkdown(list: Element, ordered: boolean): string {
	const items = list.querySelectorAll(":scope > li");
	return Array.from(items)
		.map((item, index) => {
			const prefix = ordered ? `${index + 1}.` : "-";
			return `${prefix} ${item.textContent?.trim()}`;
		})
		.join("\n");
}

/**
 * Convert code file to markdown with syntax highlighting
 */
function convertCodeToMarkdown(content: string, filename: string): string {
	const language = getLanguage(filename);
	return `# ${filename}\n\n\`\`\`${language}\n${content}\n\`\`\``;
}

// ============================================================================
// IMAGE CONVERSION (Browser-based)
// ============================================================================

export interface ImageConversionOptions {
	format: "png" | "jpeg" | "webp";
	quality?: number; // 0-1 for jpeg/webp
	maxWidth?: number;
	maxHeight?: number;
}

export interface ImageConversionResult {
	success: boolean;
	dataUrl?: string;
	blob?: Blob;
	width?: number;
	height?: number;
	originalSize: number;
	convertedSize?: number;
	error?: string;
}

/**
 * Convert an image to a different format using canvas
 */
export async function convertImage(file: File, options: ImageConversionOptions): Promise<ImageConversionResult> {
	try {
		// Load image
		const dataUrl = await readFileAsDataURL(file);
		const img = await loadImage(dataUrl);

		// Calculate dimensions (with optional resize)
		let { width, height } = img;

		if (options.maxWidth && width > options.maxWidth) {
			const ratio = options.maxWidth / width;
			width = options.maxWidth;
			height = Math.round(height * ratio);
		}

		if (options.maxHeight && height > options.maxHeight) {
			const ratio = options.maxHeight / height;
			height = options.maxHeight;
			width = Math.round(width * ratio);
		}

		// Create canvas and draw image
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;

		const ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("Failed to get canvas context");
		}

		ctx.drawImage(img, 0, 0, width, height);

		// Convert to desired format
		const mimeType = `image/${options.format}`;
		const quality = options.quality ?? 0.92;

		const resultDataUrl = canvas.toDataURL(mimeType, quality);
		const resultBlob = await canvasToBlob(canvas, mimeType, quality);

		return {
			success: true,
			dataUrl: resultDataUrl,
			blob: resultBlob,
			width,
			height,
			originalSize: file.size,
			convertedSize: resultBlob.size,
		};
	} catch (error: any) {
		return {
			success: false,
			originalSize: file.size,
			error: error.message || "Image conversion failed",
		};
	}
}

/**
 * Load an image from data URL
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error("Failed to load image"));
		img.src = dataUrl;
	});
}

/**
 * Convert canvas to blob
 */
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) {
					resolve(blob);
				} else {
					reject(new Error("Failed to create blob"));
				}
			},
			mimeType,
			quality,
		);
	});
}

/**
 * Get image metadata
 */
export async function getImageMetadata(file: File): Promise<{
	width: number;
	height: number;
	format: string;
	size: number;
}> {
	const dataUrl = await readFileAsDataURL(file);
	const img = await loadImage(dataUrl);

	return {
		width: img.naturalWidth,
		height: img.naturalHeight,
		format: getExtension(file.name).slice(1),
		size: file.size,
	};
}

// ============================================================================
// BATCH CONVERSION
// ============================================================================

/**
 * Convert multiple files to markdown
 */
export async function batchConvertToMarkdown(files: File[]): Promise<ConversionResult[]> {
	const results: ConversionResult[] = [];

	for (const file of files) {
		if (isTextFile(file.name)) {
			results.push(await convertTextFile(file));
		} else {
			results.push({
				success: false,
				filename: file.name,
				originalSize: file.size,
				error: "Unsupported file format for markdown conversion",
			});
		}
	}

	return results;
}

/**
 * Convert multiple images
 */
export async function batchConvertImages(
	files: File[],
	options: ImageConversionOptions,
): Promise<ImageConversionResult[]> {
	const results: ImageConversionResult[] = [];

	for (const file of files) {
		if (isImageFile(file.name)) {
			results.push(await convertImage(file, options));
		} else {
			results.push({
				success: false,
				originalSize: file.size,
				error: "Not an image file",
			});
		}
	}

	return results;
}

// ============================================================================
// UTILITY: Format bytes for display
// ============================================================================

export function formatBytes(bytes: number): string {
	if (bytes === 0) {
		return "0 B";
	}
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
