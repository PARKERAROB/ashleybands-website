#!/usr/bin/env node
// Standalone local client. No dependencies. Keep configuration outside shared folders.
import { readFile } from "node:fs/promises";
const [operation = "read"] = process.argv.slice(2);
try {
  const configPath = process.env.CARNEGIE_AGENT_CONFIG;
  if (!configPath) throw new Error("Set CARNEGIE_AGENT_CONFIG to your private connection file.");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const url = new URL(config.url);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/api/carnegie-2027/team/agent" ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))))
    throw new Error("Use the HTTPS workspace agent endpoint.");
  if (!/^cw_[a-f0-9]{64}$/.test(config.token || "")) throw new Error("Invalid connection file.");
  if (!["read", "write"].includes(operation)) throw new Error("Use read, or write with a JSON command on standard input.");
  const headers = { Authorization: `Bearer ${config.token}` };
  let body;
  if (operation === "write") {
    let input = "";
    for await (const chunk of process.stdin) { input += chunk; if (input.length > 100000) throw new Error("Command is too large."); }
    const command = JSON.parse(input);
    if (!Number.isInteger(command.revision) || typeof command.source !== "string" || !command.source.trim()) throw new Error("Read first, then provide the current revision and source.");
    body = JSON.stringify(command); headers["Content-Type"] = "application/json";
  }
  const response = await fetch(url, { method: operation === "write" ? "POST" : "GET", headers, body, redirect: "error", signal: AbortSignal.timeout(60000) });
  const result = await response.json();
  if (!response.ok) { process.stderr.write(`Workspace ${response.status}: ${result.error || "request failed"}\n`); process.exitCode = 1; }
  else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  // Never echo configuration, request headers or credentials.
  process.stderr.write(`${error instanceof SyntaxError ? "Invalid JSON configuration or command." : error.message}\n`);
  process.exitCode = 1;
}
