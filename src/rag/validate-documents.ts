import { loadDocuments } from "./load-documents.js";

async function validateDocuments(): Promise<void> {
  const documents = await loadDocuments();
  const bySource = new Map<string, number>();

  for (const doc of documents) {
    const source = String(doc.metadata.source ?? "unknown");
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
  }

  console.log(`Total de documentos carregados: ${documents.length}\n`);

  for (const [source, count] of [...bySource.entries()].sort()) {
    const sample = documents.find((doc) => doc.metadata.source === source);
    const meta = sample?.metadata ?? {};
    console.log(
      `- ${source}: ${count} parte(s) | category=${meta.category ?? "n/a"} | slug=${meta.project_slug ?? "n/a"}`,
    );
  }

  const curriculo = documents.filter((doc) => doc.metadata.category === "curriculo");
  if (curriculo.length === 0) {
    console.warn(
      "\nAviso: nenhum PDF de currículo encontrado. Adicione curriculo-matheus-queiroz.pdf em data/pdfs/",
    );
  } else {
    console.log(`\nCurrículo indexável: ${curriculo.length} página(s).`);
  }
}

validateDocuments().catch((error) => {
  console.error(error);
  process.exit(1);
});
