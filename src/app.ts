import Fastify from "fastify";
import cors from "@fastify/cors";
import { getAllowedOrigins } from "./config/env.js";
import { mathRoutes } from "./routes/math.routes";
import { ragRoutes } from "./routes/rag.routes";

export async function buildApp() {
  const app = Fastify({
    logger:
      process.env.NODE_ENV === "production"
        ? true
        : {
            transport: {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
              },
            },
          },
  });

  await app.register(cors, {
    origin: getAllowedOrigins(),
    methods: ["GET", "POST", "OPTIONS"],
  });

  await app.register(mathRoutes);
  await app.register(ragRoutes);

  return app;
}

