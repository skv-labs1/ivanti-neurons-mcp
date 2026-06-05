// ────────────────────────────────────────────────────────────
// Ivanti Neurons MCP Server – Stateless Streamable HTTP
// Protocol: MCP 2025-03-26
// Transport: POST /api/mcp  (JSON-RPC 2.0)
// No SDK, no external dependencies – pure Node.js 18+
//
// Credentials priority:
//   1. Custom HTTP headers (from browser admin page / test panel)
//   2. Vercel environment variables (for Claude Desktop / VS Code)
// ────────────────────────────────────────────────────────────

import { dexTools,  handleDexTool  } from "../lib/tools/dex.js";
import { itsmTools, handleItsmTool } from "../lib/tools/itsm.js";
import { mdmTools,  handleMdmTool  } from "../lib/tools/mdm.js";

const SERVER_INFO = {
  name: "ivanti-neurons-mcp",
  version: "1.0.0",
};

const PROTOCOL_VERSION = "2025-03-26";

// ── Aggregate all tool definitions ──────────────────────────
const ALL_TOOLS = [...dexTools, ...itsmTools, ...mdmTools];

// Build a name → module lookup
const dexNames  = new Set(dexTools.map((t) => t.name));
const itsmNames = new Set(itsmTools.map((t) => t.name));
const mdmNames  = new Set(mdmTools.map((t) => t.name));

// ── Header-to-env mapping ───────────────────────────────────
const HEADER_ENV_MAP = {
  "x-neurons-base-url":    "NEURONS_BASE_URL",
  "x-neurons-bearer-token":"NEURONS_BEARER_TOKEN",
  "x-itsm-base-url":       "ITSM_BASE_URL",
  "x-itsm-api-key":        "ITSM_API_KEY",
  "x-mdm-base-url":        "MDM_BASE_URL",
  "x-mdm-username":        "MDM_USERNAME",
  "x-mdm-password":        "MDM_PASSWORD",
};

/**
 * Temporarily override process.env from request headers.
 * Returns a restore function to revert the originals.
 */
function applyHeaderOverrides(reqHeaders) {
  const originals = {};
  for (const [header, envKey] of Object.entries(HEADER_ENV_MAP)) {
    const val = reqHeaders[header];
    if (val) {
      originals[envKey] = process.env[envKey];
      process.env[envKey] = val;
    }
  }
  return function restore() {
    for (const [envKey, orig] of Object.entries(originals)) {
      if (orig === undefined) delete process.env[envKey];
      else process.env[envKey] = orig;
    }
  };
}

// ── JSON-RPC helpers ────────────────────────────────────────
function jsonRpcOk(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id, code, message, data) {
  return { jsonrpc: "2.0", id, error: { code, message, ...(data ? { data } : {}) } };
}

// ── Route a single JSON-RPC request ────────────────────────
async function handleRequest(req) {
  const { id, method, params } = req;

  // Notifications (no id) – acknowledge silently
  if (id === undefined || id === null) return null;

  switch (method) {
    // ── Lifecycle ───────────────────────────────────────────
    case "initialize":
      return jsonRpcOk(id, {
        protocolVersion: PROTOCOL_VERSION,
        serverInfo: SERVER_INFO,
        capabilities: { tools: { listChanged: false } },
      });

    case "ping":
      return jsonRpcOk(id, {});

    // ── Tools ──────────────────────────────────────────────
    case "tools/list":
      return jsonRpcOk(id, { tools: ALL_TOOLS });

    case "tools/call": {
      const toolName = params?.name;
      const toolArgs = params?.arguments ?? {};

      if (!toolName) {
        return jsonRpcError(id, -32602, "Missing tool name");
      }

      try {
        let result;
        if (dexNames.has(toolName)) {
          result = await handleDexTool(toolName, toolArgs);
        } else if (itsmNames.has(toolName)) {
          result = await handleItsmTool(toolName, toolArgs);
        } else if (mdmNames.has(toolName)) {
          result = await handleMdmTool(toolName, toolArgs);
        } else {
          return jsonRpcError(id, -32602, `Unknown tool: ${toolName}`);
        }
        return jsonRpcOk(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      } catch (err) {
        return jsonRpcOk(id, {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true,
        });
      }
    }

    // ── Unknown method ─────────────────────────────────────
    default:
      return jsonRpcError(id, -32601, `Method not found: ${method}`);
  }
}

// ── Vercel serverless handler ───────────────────────────────
export default async function handler(req, res) {
  // CORS preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Mcp-Session-Id, " +
    Object.keys(HEADER_ENV_MAP).join(", ")
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // GET returns a simple health check
  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      server: SERVER_INFO,
      protocol: PROTOCOL_VERSION,
      tools: ALL_TOOLS.length,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Apply credential overrides from custom headers
  const restore = applyHeaderOverrides(req.headers);

  try {
    const body = req.body;

    // Support JSON-RPC batch
    if (Array.isArray(body)) {
      const results = await Promise.all(body.map(handleRequest));
      const filtered = results.filter(Boolean);
      return res.status(200).json(filtered);
    }

    const result = await handleRequest(body);
    if (!result) {
      return res.status(204).end();
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json(
      jsonRpcError(null, -32603, "Internal server error", err.message)
    );
  } finally {
    // Always restore original env vars
    restore();
  }
}
