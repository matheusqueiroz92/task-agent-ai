import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { env } from "../config/env.js";
import { ragTools } from "../tools/rag.tools.js";

export interface RagResult {
  resposta: string;
}

const agent = createAgent({
  model: new ChatOpenAI({ model: env.OPENAI_MODEL, temperature: 0 }),
  tools: ragTools,
  systemPrompt: `Você responde perguntas com base nos documentos sobre Matheus Queiroz,
desenvolvedor web fullstack, fundador da AZ Work Center (https://matheusqueiroz.dev.br).

Regras:
- Sempre chame buscar_documentos antes de responder
- Se a pergunta for sobre um projeto específico, passe project_slug na tool:
  oticas-queiroz (Óticas Queiroz), m-agendy (M.Agendy), m-finnanceai (M.FinnanceAI), task-agent-ai (este chatbot)
- Use apenas o que vier dos documentos retornados pela tool
- Se não encontrar a informação, diga que não está nos documentos e indique contato:
  contato@matheusqueiroz.dev.br ou WhatsApp (77) 98833-4370
- Responda em português, de forma clara e profissional`,
});

export async function askDocuments(input: string): Promise<RagResult> {
  const result = await agent.invoke({
    messages: [{ role: "user", content: input }],
  });

  const last = result.messages.at(-1);
  return { resposta: String(last?.content ?? "") };
}
