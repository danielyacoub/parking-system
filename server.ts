import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

import { createServer, type IncomingMessage } from "node:http";

import next from "next";
import { Server } from "socket.io";

import { connectDB, disconnectDB } from "./src/lib/db";
import { startMqttListener } from "./src/lib/mqtt";
import { isRealtimeEventName } from "./src/lib/realtime";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "./src/types/parking";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const internalSecret =
  process.env.INTERNAL_BROADCAST_SECRET ?? "hk-parking-internal-dev";
const socketPath = "/api/socket_io";

async function readJsonBody(
  request: IncomingMessage,
  maxBytes = 64_000,
): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;

    if (size > maxBytes) {
      throw new Error("Request body is too large.");
    }

    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  await connectDB()
    .then(() => console.log("[db] MongoDB connected"))
    .catch((error) => {
      console.error(
        "[db] MongoDB unavailable at startup. The app will retry on demand.",
        error instanceof Error ? error.message : error,
      );
    });

  let io: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

  const httpServer = createServer(async (request, response) => {
    const pathname = request.url?.split("?")[0];

    if (pathname === "/internal/broadcast") {
      if (request.method !== "POST") {
        response.writeHead(405).end();
        return;
      }

      if (request.headers["x-internal-secret"] !== internalSecret) {
        response.writeHead(401).end();
        return;
      }

      try {
        const body = (await readJsonBody(request)) as {
          event?: unknown;
          payload?: unknown;
        };

        if (!isRealtimeEventName(body.event)) {
          response.writeHead(400).end("Unknown realtime event.");
          return;
        }

        io?.emit(body.event, body.payload as never);
        response.writeHead(204).end();
      } catch (error) {
        console.error(
          "[realtime] Invalid broadcast:",
          error instanceof Error ? error.message : error,
        );
        response.writeHead(400).end("Invalid broadcast body.");
      }

      return;
    }

    handle(request, response);
  });

  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: socketPath,
    serveClient: false,
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN ?? true,
      credentials: true,
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[socket] Client connected: ${socket.id}`);

    socket.on("disconnect", (reason) => {
      console.log(`[socket] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  const mqttClient = startMqttListener(io);

  httpServer.listen(port, hostname, () => {
    console.log(`[next] HK Parking ready on http://localhost:${port}`);
    console.log(`[socket] Socket.io listening on ${socketPath}`);
  });

  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`\n[server] ${signal} received. Shutting down…`);

    try {
      mqttClient?.end(true);
      await new Promise<void>((resolve) => {
        io.close(() => resolve());
      });
      httpServer.closeAllConnections();
      await disconnectDB();
    } catch (error) {
      console.error("[server] Shutdown error:", error);
    }

    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("[server] Fatal startup error:", error);
  process.exit(1);
});
