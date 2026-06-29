import type { FastifyInstance } from "fastify";
import { calculate } from "../services/math.service.js";

export async function mathRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ status: "ok" }));

  app.post<{ Body: { input: string } }>("/api/math", async (request, reply) => {
    const input = request.body.input?.trim();

    if (!input) {
      return reply.status(400).send({ error: "Input is required" });
    }

    try {
      return await calculate(input);
    } catch (error) {
      request.log.error(error);
      return reply.status(502).send({ error: "Failed to generate the response" });
    }
  });
}
