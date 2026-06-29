import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY é obrigatória"),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  DATABASE_SSL: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  RAG_COLLECTION: z.string().default("portfolio-matheus"),
  RAG_TABLE_NAME: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/, "RAG_TABLE_NAME inválido")
    .default("rag_documents"),
  PORT: z.coerce.number().default(3344),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  CORS_ORIGINS: z
    .string()
    .default("https://matheusqueiroz.dev.br,https://www.matheusqueiroz.dev.br"),
  RATE_LIMIT_MAX: z.coerce.number().default(20),
  RATE_LIMIT_TIME_WINDOW: z.string().default("1 minute"),
});

export const env = envSchema.parse(process.env);

export function getAllowedOrigins(): (string | RegExp)[] {
  const configured = env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (env.NODE_ENV === "development") {
    return [...configured, /^http:\/\/localhost:\d+$/];
  }

  return configured;
}
