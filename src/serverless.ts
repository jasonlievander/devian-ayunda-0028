import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";
import { createApp } from "./http/app";
import { MemoryStore } from "./infrastructure/memory-store";

let appPromise: Promise<FastifyInstance> | null = null;

async function getApp(): Promise<FastifyInstance> {
  if (appPromise === null) {
    appPromise = (async () => {
      const store = await MemoryStore.open({ seed: true });
      const app = createApp({ store });
      await app.ready();
      return app;
    })();
  }
  return appPromise;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  response.setHeader("x-idb-runtime", "demo-serverless-v3");
  try {
    const app = await getApp();
    app.server.emit("request", request, response);
  } catch (error) {
    appPromise = null;
    const message = error instanceof Error ? error.message : String(error);
    console.error("FUNCTION_INIT_ERROR", error);
    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(
        JSON.stringify({
          error: { code: "FUNCTION_INIT_ERROR", message },
        }),
      );
    }
  }
}
