import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Document } from "@langchain/core/documents";
import { PDFParse } from "pdf-parse";

export type DocumentCategory =
  | "curriculo"
  | "projeto"
  | "faq"
  | "servico"
  | "perfil"
  | "geral";

export interface DocumentMetadata {
  source: string;
  category: DocumentCategory;
  project_slug?: string;
  project_name?: string;
  page?: number;
}

const DATA_ROOT = path.resolve(__dirname, "../../data");
const PDF_DIR = path.join(DATA_ROOT, "pdfs");
const PROJECTS_DIR = path.join(DATA_ROOT, "projects");

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".txt", ".md"]);

const FRONTMATTER_LINE = /^([a-z_]+):\s*(.+)$/i;

function inferCategoryFromFilename(filename: string): DocumentCategory {
  const lower = filename.toLowerCase();

  if (lower.includes("curriculo")) return "curriculo";
  if (lower.startsWith("info-faq")) return "faq";
  if (lower.startsWith("info-servicos") || lower.startsWith("info-projects")) return "servico";
  if (lower.startsWith("projeto-")) return "projeto";

  if (
    lower.startsWith("info-matheus") ||
    lower.startsWith("info-experiencia") ||
    lower.startsWith("info-formacao") ||
    lower.startsWith("info-tecnologias") ||
    lower.startsWith("info-contato") ||
    lower.startsWith("info-az-work") ||
    lower.startsWith("info-projetos")
  ) {
    return "perfil";
  }

  return "geral";
}

function parseFrontmatter(content: string): {
  body: string;
  metadata: Partial<DocumentMetadata>;
} {
  const lines = content.split("\n");
  const metadata: Partial<DocumentMetadata> = {};
  let bodyStartIndex = lines.length;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]?.trim() ?? "";

    if (line.startsWith("## ")) {
      bodyStartIndex = index;
      break;
    }

    const match = FRONTMATTER_LINE.exec(line);
    if (!match) continue;

    const [, key, value] = match;

    switch (key?.toLowerCase()) {
      case "slug":
        metadata.project_slug = value?.trim();
        break;
      case "categoria":
      case "category":
        metadata.category = value?.trim() as DocumentCategory;
        break;
      case "project_name":
        metadata.project_name = value?.trim();
        break;
      default:
        break;
    }
  }

  const body = lines.slice(bodyStartIndex).join("\n").trim();
  return { body, metadata };
}

function slugFromFilename(filename: string): string {
  return filename.replace(/^projeto-/, "").replace(/\.(txt|md)$/i, "");
}

async function collectFiles(dir: string): Promise<string[]> {
  let entries: string[];

  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const entryStat = await stat(fullPath);

    if (entryStat.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
      continue;
    }

    if (SUPPORTED_EXTENSIONS.has(path.extname(entry).toLowerCase())) {
      files.push(fullPath);
    }
  }

  return files;
}

async function loadPdf(filePath: string): Promise<Document[]> {
  const buffer = await readFile(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const basename = path.basename(filePath);

  try {
    const { pages } = await parser.getText();
    return pages.map(
      (page) =>
        new Document({
          pageContent: page.text,
          metadata: {
            source: basename,
            category: inferCategoryFromFilename(basename),
            page: page.num,
          } satisfies DocumentMetadata,
        }),
    );
  } finally {
    await parser.destroy();
  }
}

async function loadText(filePath: string): Promise<Document[]> {
  const content = await readFile(filePath, "utf-8");
  const basename = path.basename(filePath);
  const isProjectFile = filePath.includes(`${path.sep}projects${path.sep}`);

  if (isProjectFile) {
    const { body, metadata: frontmatter } = parseFrontmatter(content);
    const slug = frontmatter.project_slug ?? slugFromFilename(basename);

    return [
      new Document({
        pageContent: body || content,
        metadata: {
          source: basename,
          category: frontmatter.category ?? "projeto",
          project_slug: slug,
          project_name: frontmatter.project_name,
        } satisfies DocumentMetadata,
      }),
    ];
  }

  return [
    new Document({
      pageContent: content,
      metadata: {
        source: basename,
        category: inferCategoryFromFilename(basename),
      } satisfies DocumentMetadata,
    }),
  ];
}

export async function loadDocuments(): Promise<Document[]> {
  const files = [...(await collectFiles(PDF_DIR)), ...(await collectFiles(PROJECTS_DIR))];
  const documents: Document[] = [];

  for (const filePath of files) {
    const extension = path.extname(filePath).toLowerCase();

    if (extension === ".pdf") {
      documents.push(...(await loadPdf(filePath)));
      continue;
    }

    documents.push(...(await loadText(filePath)));
  }

  return documents;
}

export function getDocumentsDirs(): string[] {
  return [PDF_DIR, PROJECTS_DIR];
}
