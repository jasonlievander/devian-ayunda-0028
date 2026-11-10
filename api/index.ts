import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/http/app";
import { MemoryStore } from "../src/infrastructure/memory-store";

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
  const app = await getApp();
  app.server.emit("request", request, response);
}
