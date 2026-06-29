import type { Document } from "@langchain/core/documents";
import type { PGVectorStore } from "@langchain/pgvector";
import { getVectorStore } from "./vectorstore.js";

export const SEARCH_CONFIG = {
  generalK: 8,
  fetchK: 20,
  lambda: 0.7,
  similarityThreshold: 0.75,
  projectK: 6,
  maxChunksPerSource: 2,
} as const;

function dedupeBySource(docs: Document[], maxPerSource: number): Document[] {
  const counts = new Map<string, number>();
  const result: Document[] = [];

  for (const doc of docs) {
    const source = String(doc.metadata.source ?? "unknown");
    const count = counts.get(source) ?? 0;

    if (count >= maxPerSource) continue;

    counts.set(source, count + 1);
    result.push(doc);
  }

  return result;
}

function formatResults(docs: Document[]): string {
  if (docs.length === 0) {
    return "Nenhum documento relevante encontrado acima do limiar de similaridade.";
  }

  return docs
    .map((doc) => {
      const meta = doc.metadata;
      const parts = [`Fonte: ${meta.source}`];

      if (meta.project_name) parts.push(`Projeto: ${meta.project_name}`);
      if (meta.category) parts.push(`Categoria: ${meta.category}`);

      return `${parts.join(" | ")}\nConteúdo: ${doc.pageContent}`;
    })
    .join("\n\n---\n\n");
}

async function filterByScore(
  store: PGVectorStore,
  query: string,
  k: number,
  filter?: Record<string, string>,
): Promise<Document[]> {
  const results = await store.similaritySearchWithScore(query, k, filter);

  return results
    .filter(([, score]) => score >= SEARCH_CONFIG.similarityThreshold)
    .map(([doc]) => doc);
}

export async function searchGeneral(query: string): Promise<string> {
  const store = await getVectorStore();

  const docs = await store.maxMarginalRelevanceSearch(query, {
    k: SEARCH_CONFIG.generalK,
    fetchK: SEARCH_CONFIG.fetchK,
    lambda: SEARCH_CONFIG.lambda,
  });

  const deduped = dedupeBySource(docs, SEARCH_CONFIG.maxChunksPerSource);
  return formatResults(deduped);
}

export async function searchByProject(query: string, projectSlug: string): Promise<string> {
  const store = await getVectorStore();
  const filter = { project_slug: projectSlug };

  const docs = await filterByScore(store, query, SEARCH_CONFIG.projectK, filter);
  const deduped = dedupeBySource(docs, SEARCH_CONFIG.maxChunksPerSource);

  if (deduped.length > 0) {
    return formatResults(deduped);
  }

  const fallbackDocs = await store.maxMarginalRelevanceSearch(query, {
    k: SEARCH_CONFIG.generalK,
    fetchK: SEARCH_CONFIG.fetchK,
    lambda: SEARCH_CONFIG.lambda,
    filter,
  });

  return formatResults(dedupeBySource(fallbackDocs, SEARCH_CONFIG.maxChunksPerSource));
}

export async function searchDocuments(
  query: string,
  projectSlug?: string,
): Promise<string> {
  if (projectSlug) {
    return searchByProject(query, projectSlug);
  }

  return searchGeneral(query);
}
