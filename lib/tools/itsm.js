// ────────────────────────────────────────────────────────────
// ITSM module – Proxies to Ivanti Neurons native ITSM MCP
// Server: itsm (/mcp/v1/itsm/)
// Auth: rest_api_key + x-ism-tenant-url headers
// ────────────────────────────────────────────────────────────

const DEFAULT_BASE = "https://nvuprd-sfc.ivanticloud.com";

function baseUrl() {
  return (process.env.NEURONS_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
}

function parseSSE(raw) {
  const lines = raw.split("\n");
  let lastValid = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data:")) {
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload);
        if (obj && (obj.jsonrpc || obj.result || obj.id !== undefined)) lastValid = obj;
      } catch (_) {}
    }
  }
  return lastValid;
}

function normalizeResult(payload) {
  if (!payload) return payload;
  const result = payload.result || payload;
  if (result.isError) throw new Error(result.content?.[0]?.text || "ITSM MCP tool error");
  if (result.structuredContent !== undefined) return result.structuredContent;
  if (Array.isArray(result.content) && result.content.length > 0) {
    const text = result.content[0].text || "";
    if (!text) return result;
    try { return JSON.parse(text); } catch (_) {}
    const listMatch = text.match(/Got list: (\[[\s\S]*\])/);
    if (listMatch) return JSON.parse(listMatch[1]);
    const dictMatch = text.match(/Got dict: (\{[\s\S]*\})/);
    if (dictMatch) return JSON.parse(dictMatch[1]);
    if (/^-?\d+(\.\d+)?$/.test(text.trim())) return Number(text.trim());
    return text;
  }
  return result;
}

function findArray(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.value)) return data.value;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.result)) return data.result;
  for (const val of Object.values(data)) {
    if (Array.isArray(val)) return val;
  }
  return [];
}

async function itsmProxy(toolName, args = {}) {
  const url = `${baseUrl()}/mcp/v1/itsm/`;
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: `itsm-${toolName}-${Date.now()}`,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  });

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  const apiKey = process.env.ITSM_API_KEY || "";
  const tenantUrl = process.env.ITSM_BASE_URL || "";
  if (apiKey) headers["Authorization"] = `rest_api_key=${apiKey}`;
  if (tenantUrl) headers["x-ism-tenant-url"] = tenantUrl;

  const res = await fetch(url, { method: "POST", headers, body });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ITSM MCP HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();

  if (
    contentType.includes("text/event-stream") ||
    rawText.trimStart().startsWith("event:") ||
    rawText.trimStart().startsWith("data:")
  ) {
    const parsed = parseSSE(rawText);
    if (parsed) return normalizeResult(parsed);
  }

  try { return normalizeResult(JSON.parse(rawText)); }
  catch (_) { return rawText; }
}

async function loadPages(objectName, pageSize = 100, maxPages = 5) {
  const rows = [];
  for (let page = 0; page < maxPages; page++) {
    const data = await itsmProxy("ism_list_bo", {
      object_name_plural: objectName,
      top: pageSize,
      skip: page * pageSize,
    });
    const pageRows = findArray(data);
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
  }
  return rows;
}

export const itsmTools = [
  {
    name: "itsm_list_incidents",
    description: "List incidents from Ivanti ITSM.",
    inputSchema: {
      type: "object",
      properties: {
        top: { type: "integer", description: "Max rows per page (default 100)", default: 100 },
        pages: { type: "integer", description: "Max pages to fetch (default 3)", default: 3 },
      },
    },
  },
  {
    name: "itsm_list_service_requests",
    description: "List service requests from Ivanti ITSM.",
    inputSchema: {
      type: "object",
      properties: {
        top: { type: "integer", default: 100 },
        pages: { type: "integer", default: 3 },
      },
    },
  },
  {
    name: "itsm_list_changes",
    description: "List change requests from Ivanti ITSM.",
    inputSchema: {
      type: "object",
      properties: {
        top: { type: "integer", default: 100 },
        pages: { type: "integer", default: 3 },
      },
    },
  },
  {
    name: "itsm_list_objects",
    description: "List any ITSM business object type (incidents, servicereqs, changes, problems, etc).",
    inputSchema: {
      type: "object",
      properties: {
        objectType: { type: "string", description: "Plural object name, e.g. 'incidents'" },
        top: { type: "integer", default: 100 },
        skip: { type: "integer", default: 0 },
      },
      required: ["objectType"],
    },
  },
  {
    name: "itsm_get_dashboard_stats",
    description: "Get ITSM dashboard stats: open incidents, open service requests counts.",
    inputSchema: { type: "object", properties: {} },
  },
];

export async function handleItsmTool(name, args = {}) {
  switch (name) {
    case "itsm_list_incidents":
      return loadPages("incidents", args.top || 100, args.pages || 3);
    case "itsm_list_service_requests":
      return loadPages("servicereqs", args.top || 100, args.pages || 3);
    case "itsm_list_changes":
      return loadPages("changes", args.top || 100, args.pages || 3);
    case "itsm_list_objects":
      return itsmProxy("ism_list_bo", {
        object_name_plural: args.objectType,
        top: args.top || 100,
        skip: args.skip || 0,
      });
    case "itsm_get_dashboard_stats": {
      const [incResult, svcResult] = await Promise.allSettled([
        loadPages("incidents", 100, 5),
        loadPages("servicereqs", 100, 5),
      ]);
      const incidents = incResult.status === "fulfilled" ? incResult.value : [];
      const serviceReqs = svcResult.status === "fulfilled" ? svcResult.value : [];
      const isOpen = (r) => !/closed|resolved/i.test(String(r.Status || r.status || ""));
      return {
        totalIncidents: incidents.length,
        openIncidents: incidents.filter(isOpen).length,
        totalServiceRequests: serviceReqs.length,
        openServiceRequests: serviceReqs.filter(isOpen).length,
      };
    }
    default:
      throw new Error(`Unknown ITSM tool: ${name}`);
  }
}
