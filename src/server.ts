import "dotenv/config";
import { env } from "./config/env.js";
import { buildApp } from "./app";
import { checkVectorStoreHasDocuments } from "./rag/vectorstore.js";

async function main() {
  const hasDocuments = await checkVectorStoreHasDocuments();

  if (!hasDocuments) {
    console.warn(
      "Aviso: nenhum documento indexado no pgvector. Execute `npm run rag:index` após configurar DATABASE_URL.",
    );
  }

  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server is running on ${env.HOST}:${env.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

main();
