import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { env } from "../config/env.js";
import { ragTools } from "../tools/rag.tools.js";
import { extractMessageText } from "../utils/message-content.js";

export interface RagResult {
  resposta: string;
}

export type RagStreamPhase = "searching" | "generating";

export type RagStreamEvent =
  | { type: "status"; phase: RagStreamPhase }
  | { type: "token"; text: string }
  | { type: "done"; resposta: string };

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
  return { resposta: extractMessageText(last?.content) };
}

export async function streamDocuments(
  input: string,
  onEvent: (event: RagStreamEvent) => void,
  options?: { signal?: AbortSignal },
): Promise<RagResult> {
  const run = await agent.streamEvents(
    { messages: [{ role: "user", content: input }] },
    { version: "v3", signal: options?.signal },
  );

  let streamedText = "";
  let hasEmittedGenerating = false;

  const toolCallsTask = (async () => {
    for await (const call of run.toolCalls) {
      if (call.name === "buscar_documentos") {
        onEvent({ type: "status", phase: "searching" });
        await call.output;
      }
    }
  })();

  const messagesTask = (async () => {
    for await (const msg of run.messages) {
      const toolCalls = await msg.toolCalls;

      if (toolCalls.length > 0) {
        await msg.text;
        continue;
      }

      if (!hasEmittedGenerating) {
        hasEmittedGenerating = true;
        onEvent({ type: "status", phase: "generating" });
      }

      for await (const token of msg.text) {
        streamedText += token;
        onEvent({ type: "token", text: token });
      }
    }
  })();

  await Promise.all([toolCallsTask, messagesTask]);

  const state = await run.output;
  const last = state.messages.at(-1);
  const resposta = streamedText || extractMessageText(last?.content);

  onEvent({ type: "done", resposta });
  return { resposta };
}
