import { PGVectorStore, type DistanceStrategy } from "@langchain/pgvector";
import { OpenAIEmbeddings } from "@langchain/openai";
import pg from "pg";
import { env } from "../config/env.js";

const EMBEDDING_DIMENSIONS = 1536;

let pool: pg.Pool | null = null;
let vectorStorePromise: Promise<PGVectorStore> | null = null;
let initialized = false;

export function createEmbeddings(): OpenAIEmbeddings {
  return new OpenAIEmbeddings({
    model: "text-embedding-3-small",
    apiKey: env.OPENAI_API_KEY,
  });
}

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    });
  }

  return pool;
}

function getPgVectorConfig() {
  return {
    pool: getPool(),
    tableName: env.RAG_TABLE_NAME,
    collectionName: env.RAG_COLLECTION,
    collectionTableName: "langchain_collections",
    columns: {
      idColumnName: "id",
      vectorColumnName: "vector",
      contentColumnName: "content",
      metadataColumnName: "metadata",
    },
    distanceStrategy: "cosine" as DistanceStrategy,
    scoreNormalization: "similarity" as const,
  };
}

async function ensureInitialized(): Promise<void> {
  if (initialized) return;

  const embeddings = createEmbeddings();
  await PGVectorStore.initialize(embeddings, {
    ...getPgVectorConfig(),
    dimensions: EMBEDDING_DIMENSIONS,
  });

  initialized = true;
}

export async function getVectorStore(): Promise<PGVectorStore> {
  if (!vectorStorePromise) {
    vectorStorePromise = (async () => {
      await ensureInitialized();
      return new PGVectorStore(createEmbeddings(), getPgVectorConfig());
    })();
  }

  return vectorStorePromise;
}

export async function createIndexingStore(): Promise<PGVectorStore> {
  await ensureInitialized();
  return new PGVectorStore(createEmbeddings(), getPgVectorConfig());
}

export async function clearVectorCollection(): Promise<void> {
  const client = await getPool().connect();

  try {
    await client.query(`TRUNCATE TABLE ${env.RAG_TABLE_NAME}`);
  } finally {
    client.release();
  }
}

export async function createHnswIndexIfNeeded(store: PGVectorStore): Promise<void> {
  try {
    await store.createHnswIndex({
      dimensions: EMBEDDING_DIMENSIONS,
      efConstruction: 64,
      m: 16,
    });
    console.log("Índice HNSW criado ou já existente.");
  } catch (error) {
    console.warn("Não foi possível criar índice HNSW:", error);
  }
}

export async function checkVectorStoreHasDocuments(): Promise<boolean> {
  const client = await getPool().connect();

  try {
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM ${env.RAG_TABLE_NAME}`,
    );
    return Number(result.rows[0]?.count ?? 0) > 0;
  } finally {
    client.release();
  }
}

export async function closeVectorPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    vectorStorePromise = null;
    initialized = false;
  }
}
