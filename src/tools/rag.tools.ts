import { tool } from "langchain";
import { z } from "zod";
import { searchDocuments } from "../rag/search.js";

const PROJECT_SLUGS = [
  "oticas-queiroz",
  "m-agendy",
  "m-finnanceai",
  "task-agent-ai",
] as const;

export const buscarDocumentos = tool(
  async ({ pergunta, project_slug }) => {
    return searchDocuments(pergunta, project_slug);
  },
  {
    name: "buscar_documentos",
    description: `Busca trechos relevantes nos documentos (PDFs, textos e projetos) para responder a pergunta.
Use project_slug quando a pergunta for sobre um projeto específico.
Slugs disponíveis: ${PROJECT_SLUGS.join(", ")}`,
    schema: z.object({
      pergunta: z.string().describe("Pergunta para buscar nos documentos"),
      project_slug: z
        .enum(PROJECT_SLUGS)
        .optional()
        .describe("Slug do projeto quando a pergunta for sobre um projeto específico"),
    }),
  },
);

export const ragTools = [buscarDocumentos];
