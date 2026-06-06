// ────────────────────────────────────────────────────────────
// DEX module – Proxies to Ivanti Neurons native MCP servers
// Servers: device, patch, exposures, software-inventory
// Auth: Bearer token
// ────────────────────────────────────────────────────────────

const DEFAULT_BASE = "https://nvuprd-sfc.ivanticloud.com";

function baseUrl() {
  return (process.env.NEURONS_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
}

function bearerToken() {
  return process.env.NEURONS_BEARER_TOKEN || "";
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
  if (result.isError) throw new Error(result.content?.[0]?.text || "MCP tool error");
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

async function mcpProxy(serverKey, toolName, args = {}) {
  const url = `${baseUrl()}/mcp/v1/${serverKey}/`;
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: `${serverKey}-${toolName}-${Date.now()}`,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${bearerToken()}`,
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`MCP ${serverKey}/${toolName} HTTP ${res.status}: ${errText.slice(0, 300)}`);
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

  try {
    return normalizeResult(JSON.parse(rawText));
  } catch (_) {
    return rawText;
  }
}

const SERVER_MAP = {
  device_count: "device",
  device_managed_count: "device",
  device_neurons_manageable_count: "device",
  device_stale_devices_count: "device",
  device_antivirus_disabled_count: "device",
  device_warranty_expired_count: "device",
  device_old_startup_count: "device",
  organization_score: "device",
  device_os_count: "device",
  get_exploit_severity_summary: "patch",
  patch_estate: "patch",
  list_exposure_summaries: "exposures",
  tile_software_inventory_and_upcoming_eol: "software-inventory",
  top_titles_by_installs: "software-inventory",
  top_manufacturers_by_installs: "software-inventory",
  software_inventory_by_install: "software-inventory",
  software_inventory_by_title: "software-inventory",
  software_inventory_by_manufacturer: "software-inventory",
};

export const dexTools = [
  { name: "device_count", description: "Get total endpoint count from Ivanti Neurons.", inputSchema: { type: "object", properties: {} } },
  { name: "device_managed_count", description: "Get count of managed endpoints.", inputSchema: { type: "object", properties: {} } },
  { name: "device_neurons_manageable_count", description: "Get count of Neurons-manageable endpoints.", inputSchema: { type: "object", properties: {} } },
  { name: "device_stale_devices_count", description: "Get count of stale (inactive) devices.", inputSchema: { type: "object", properties: {} } },
  { name: "device_antivirus_disabled_count", description: "Get count of devices with antivirus disabled.", inputSchema: { type: "object", properties: {} } },
  { name: "device_warranty_expired_count", description: "Get count of devices with expired warranty.", inputSchema: { type: "object", properties: {} } },
  { name: "device_old_startup_count", description: "Get count of devices with old startup times.", inputSchema: { type: "object", properties: {} } },
  { name: "organization_score", description: "Get organization DEX scores (Overall, Security, Hardware domains).", inputSchema: { type: "object", properties: {} } },
  {
    name: "device_os_count",
    description: "Get device count by OS name (e.g. Windows, macOS, Linux, Android, iOS).",
    inputSchema: {
      type: "object",
      properties: { os_names: { type: "string", description: "OS name to count, e.g. 'Windows'" } },
      required: ["os_names"],
    },
  },
  { name: "get_exploit_severity_summary", description: "Get vulnerability severity summary — critical, high, medium, low counts plus exploit data.", inputSchema: { type: "object", properties: {} } },
  {
    name: "patch_estate",
    description: "Get patch estate device list with missing patches, risk scores, and scan dates.",
    inputSchema: { type: "object", properties: { top: { type: "integer", description: "Max rows (default 100)", default: 100 } } },
  },
  { name: "list_exposure_summaries", description: "List CVE exposure summaries with severity, affected device counts, and exploit status.", inputSchema: { type: "object", properties: {} } },
  { name: "tile_software_inventory_and_upcoming_eol", description: "Get software inventory tile with total count and upcoming EOL count.", inputSchema: { type: "object", properties: {} } },
  { name: "top_titles_by_installs", description: "Get top software titles ranked by install count.", inputSchema: { type: "object", properties: { top: { type: "integer", default: 15 } } } },
  { name: "top_manufacturers_by_installs", description: "Get top software manufacturers by total installs.", inputSchema: { type: "object", properties: { top: { type: "integer", default: 10 } } } },
  { name: "dex_environment_summary", description: "Get a high-level summary: device count, vulnerability severity, exposure count, and software inventory.", inputSchema: { type: "object", properties: {} } },
];

export async function handleDexTool(name, args = {}) {
  if (name === "dex_environment_summary") {
    const [devices, vulns, exposures, software] = await Promise.allSettled([
      mcpProxy("device", "device_count"),
      mcpProxy("patch", "get_exploit_severity_summary"),
      mcpProxy("exposures", "list_exposure_summaries"),
      mcpProxy("software-inventory", "tile_software_inventory_and_upcoming_eol"),
    ]);
    return {
      devices: devices.status === "fulfilled" ? devices.value : "unavailable",
      vulnerabilities: vulns.status === "fulfilled" ? vulns.value : "unavailable",
      exposures: exposures.status === "fulfilled" ? exposures.value : "unavailable",
      software: software.status === "fulfilled" ? software.value : "unavailable",
    };
  }

  const serverKey = SERVER_MAP[name];
  if (!serverKey) throw new Error(`Unknown DEX tool: ${name}`);
  return mcpProxy(serverKey, name, args);
}
