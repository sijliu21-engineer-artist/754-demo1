import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { registerAuthRoutes } from "./auth_routes.tsx";
import { registerRecordRoutes } from "./record_routes.tsx";
import { registerChatRoutes } from "./chat_routes.tsx";
import { registerReportRoutes } from "./report_routes.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-CaseMate-Session"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-ba71e98d/health", (c) => {
  return c.json({ status: "ok" });
});

registerAuthRoutes(app);
registerRecordRoutes(app);
registerChatRoutes(app);
registerReportRoutes(app);

Deno.serve(app.fetch);
