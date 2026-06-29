import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { env } from "../config/env.js";
import { askDocuments, streamDocuments } from "../services/rag.service.js";
import { startSse, writeSse } from "../utils/sse.js";

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

      ragApp.post<{ Body: { input: string } }>("/api/rag/stream", async (request, reply) => {
        const input = request.body.input?.trim();

        if (!input) {
          return reply.status(400).send({ error: "The input field cannot be empty." });
        }

        reply.hijack();
        startSse(reply.raw);

        const abortController = new AbortController();
        const onAborted = () => abortController.abort();

        if (request.raw.aborted) {
          abortController.abort();
        } else {
          request.raw.once("aborted", onAborted);
        }

        try {
          await streamDocuments(
            input,
            (event) => {
              switch (event.type) {
                case "status":
                  writeSse(reply.raw, "status", { phase: event.phase });
                  break;
                case "token":
                  writeSse(reply.raw, "token", { text: event.text });
                  break;
                case "done":
                  writeSse(reply.raw, "done", { resposta: event.resposta });
                  break;
              }
            },
            { signal: abortController.signal },
          );
        } catch (error) {
          if (!abortController.signal.aborted) {
            request.log.error(error);
            writeSse(reply.raw, "error", { error: "Failed to query documents" });
          }
        } finally {
          request.raw.off("aborted", onAborted);
          reply.raw.end();
        }
      });
    },
    { prefix: "" },
  );
}
