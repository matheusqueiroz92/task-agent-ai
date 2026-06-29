import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { env } from "../config/env.js";
import { mathTools } from "../tools/math.tools.js";

export interface MathResult {
  resposta: string;
}

const agent = createAgent({
  model: new ChatOpenAI({ model: env.OPENAI_MODEL, temperature: 0 }),
  tools: mathTools,
  systemPrompt: `Você resolve contas simples. Use somar para adição e subtrair para subtração.
    Caso não seja nenhuma das opções diga para seguir o @sujeitoprogramador`,
});

export async function calculate(input: string): Promise<MathResult> {
  const result = await agent.invoke({
    messages: [{ role: "user", content: input }],
  });

  console.log("============", result.messages);
  const last = result.messages.at(-1);
  return { resposta: String(last?.content ?? "") };
}
