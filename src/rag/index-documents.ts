import { loadDocuments } from "./load-documents.js";
import { splitDocuments } from "./split-documents.js";
import {
  clearVectorCollection,
  closeVectorPool,
  createHnswIndexIfNeeded,
  createIndexingStore,
} from "./vectorstore.js";

async function main(): Promise<void> {
  console.log("Carregando documentos...");
  const documents = await loadDocuments();

  if (documents.length === 0) {
    console.error("Nenhum documento encontrado em data/pdfs/ ou data/projects/");
    process.exit(1);
  }

  console.log(`Documentos carregados: ${documents.length}`);

  const chunks = await splitDocuments(documents);
  console.log(`Trechos gerados: ${chunks.length}`);

  const store = await createIndexingStore();

  console.log("Limpando índice anterior...");
  await clearVectorCollection();

  console.log("Indexando trechos no pgvector...");
  await store.addDocuments(chunks);

  console.log("Criando índice HNSW...");
  await createHnswIndexIfNeeded(store);

  console.log(`RAG indexado: ${documents.length} arquivo(s) → ${chunks.length} trecho(s)`);
  await closeVectorPool();
}

main().catch((error) => {
  console.error("Falha na indexação:", error);
  process.exit(1);
});
