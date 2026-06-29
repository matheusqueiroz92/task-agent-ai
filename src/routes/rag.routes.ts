import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { env } from "../config/env.js";
import { askDocuments } from "../services/rag.service.js";

export async function ragRoutes(app: FastifyInstance): Promise<void> {
  await app.register(
    async (ragApp) => {
      await ragApp.register(rateLimit, {
        max: env.RATE_LIMIT_MAX,
        timeWindow: env.RATE_LIMIT_TIME_WINDOW,
      });

      ragApp.post<{ Body: { input: string } }>("/api/rag", async (request, reply) => {
        const input = request.body.input?.trim();

        if (!input) {
          return reply.status(400).send({ error: "The input field cannot be empty." });
        }

        try {
          return await askDocuments(input);
        } catch (error) {
          request.log.error(error);
          return reply.status(502).send({ error: "Failed to query documents" });
        }
      });
    },
    { prefix: "" },
  );
}
