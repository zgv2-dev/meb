import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";

// Same port as production (deno serve) so /dashboard login links work in dev
const port = Number(Deno.env.get("PORT") || "8000");

export default defineConfig({
  plugins: [
    fresh(),
    {
      // Vite loads main.ts on the first request; request it at startup so local long polling begins right away
      name: "start-bot-on-listen",
      configureServer(server) {
        server.httpServer?.once("listening", () => {
          fetch(`http://localhost:${port}/health`).then((res) => res.body?.cancel()).catch(() => {});
        });
      },
    },
  ],
  server: { port },
});
