import { createServer } from "node:http";
import mysql from "mysql2/promise";
import { createApp } from "./app.mjs";

const port = Number(process.env.PORT || 3000);
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.MYSQL_PASSWORD ||
    process.env.MYSQL_PASSWORD === "change-me-before-production" ||
    process.env.MYSQL_PASSWORD.length < 20)
)
  throw new Error("Set a unique MYSQL_PASSWORD of at least 20 characters.");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "mysql",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "label_studio",
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || "label_studio",
  connectionLimit: 10,
  charset: "utf8mb4",
  multipleStatements: true,
});

const app = createApp({ pool });
for (const warning of app.warnings) console.warn(warning);
await app.migrate();
// Expired rate-limit windows are pruned periodically by every replica.
setInterval(() => void app.prune().catch(() => {}), 10 * 60_000).unref();
createServer(app.handler).listen(port, "0.0.0.0", () =>
  console.log(`Label Studio API listening on ${port}`),
);
