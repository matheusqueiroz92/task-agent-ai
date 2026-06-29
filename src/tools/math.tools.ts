import { tool } from "langchain";
import { z } from "zod";

const numerosSchema = z.object({
  a: z.number().describe("Primeiro número"),
  b: z.number().describe("Segundo número"),
});

export const somar = tool(({ a, b }) => String(a + b), {
  name: "somar",
  description: "Soma dois números",
  schema: numerosSchema,
});

export const subtrair = tool(({ a, b }) => String(a - b), {
  name: "subtrair",
  description: "Subtrai o segundo número do primeiro",
  schema: numerosSchema,
});

export const mathTools = [somar, subtrair];
