import { Document } from "@langchain/core/documents";
import {
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
} from "@langchain/textsplitters";

const generalSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});

const projectSplitter = new MarkdownTextSplitter({
  chunkSize: 900,
  chunkOverlap: 100,
});

function isProjectDocument(doc: Document): boolean {
  return doc.metadata.category === "projeto" || Boolean(doc.metadata.project_slug);
}

export async function splitDocuments(documents: Document[]): Promise<Document[]> {
  const projectDocs = documents.filter(isProjectDocument);
  const generalDocs = documents.filter((doc) => !isProjectDocument(doc));

  const [projectChunks, generalChunks] = await Promise.all([
    projectSplitter.splitDocuments(projectDocs),
    generalSplitter.splitDocuments(generalDocs),
  ]);

  return [...projectChunks, ...generalChunks];
}
