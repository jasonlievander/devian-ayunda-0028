import { createApp } from "./http/app";
import { MemoryStore } from "./infrastructure/memory-store";

const store = await MemoryStore.open({ seed: true });
const app = createApp({ store });

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

await app.listen({ port, host });

async function shutdown(): Promise<void> {
  await app.close();
}

process.once("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});
process.once("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});
