// ────────────────────────────────────────────────────────────
// DEX module – Ivanti Neurons Platform (Device, Patch, Vuln, Software)
// Auth: Bearer token
// ────────────────────────────────────────────────────────────

function baseUrl() {
  return (process.env.NEURONS_BASE_URL || "").replace(/\/+$/, "");
}

function bearerHeaders() {
  return {
    Authorization: `Bearer ${process.env.NEURONS_BEARER_TOKEN}`,
    Accept: "application/json",
  };
}

/** Build OData query string from optional params */
function odata(params) {
  const qs = [];
  if (params.$filter)  qs.push(`$filter=${encodeURIComponent(params.$filter)}`);
  if (params.$top)     qs.push(`$top=${params.$top}`);
  if (params.$skip)    qs.push(`$skip=${params.$skip}`);
  if (params.$select)  qs.push(`$select=${encodeURIComponent(params.$select)}`);
  if (params.$orderby) qs.push(`$orderby=${encodeURIComponent(params.$orderby)}`);
  if (params.$count)   qs.push(`$count=true`);
  return qs.length ? "?" + qs.join("&") : "";
}

async function apiFetch(path, opts = {}) {
  const url = `${baseUrl()}${path}`;
  const res = await fetch(url, { headers: bearerHeaders(), ...opts });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DEX API ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Tool definitions ────────────────────────────────────────
export const dexTools = [
  {
    name: "dex_list_devices",
    description:
      "List devices from Ivanti Neurons. Supports OData filtering, paging and field selection.",
    inputSchema: {
      type: "object",
      properties: {
        $filter:  { type: "string", description: "OData $filter expression, e.g. \"Manufacturer eq 'Dell'\"" },
        $top:     { type: "integer", description: "Maximum rows to return (default 25)", default: 25 },
        $skip:    { type: "integer", description: "Number of rows to skip for paging" },
        $select:  { type: "string", description: "Comma-separated field names to return" },
        $orderby: { type: "string", description: "OData $orderby expression" },
      },
    },
  },
  {
    name: "dex_get_device",
    description: "Get full details for a single device by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "The unique device identifier" },
      },
      required: ["deviceId"],
    },
  },
  {
    name: "dex_list_patches",
    description:
      "List patches from Ivanti Neurons Patch Management. Supports OData filtering.",
    inputSchema: {
      type: "object",
      properties: {
        $filter:  { type: "string", description: "OData $filter expression" },
        $top:     { type: "integer", description: "Maximum rows (default 25)", default: 25 },
        $skip:    { type: "integer", description: "Rows to skip" },
        $select:  { type: "string", description: "Comma-separated fields" },
        $orderby: { type: "string", description: "OData $orderby expression" },
      },
    },
  },
  {
    name: "dex_list_vulnerabilities",
    description:
      "List known vulnerabilities / exposures from Ivanti Neurons. Supports OData filtering.",
    inputSchema: {
      type: "object",
      properties: {
        $filter:  { type: "string", description: "OData $filter expression" },
        $top:     { type: "integer", description: "Maximum rows (default 25)", default: 25 },
        $skip:    { type: "integer", description: "Rows to skip" },
        $select:  { type: "string", description: "Comma-separated fields" },
        $orderby: { type: "string", description: "OData $orderby expression" },
      },
    },
  },
  {
    name: "dex_list_software",
    description:
      "List discovered software inventory from Ivanti Neurons (v2 API). Supports OData filtering.",
    inputSchema: {
      type: "object",
      properties: {
        $filter:  { type: "string", description: "OData $filter expression" },
        $top:     { type: "integer", description: "Maximum rows (default 25)", default: 25 },
        $skip:    { type: "integer", description: "Rows to skip" },
        $select:  { type: "string", description: "Comma-separated fields" },
        $orderby: { type: "string", description: "OData $orderby expression" },
      },
    },
  },
  {
    name: "dex_get_environment_summary",
    description:
      "Get a high-level summary of the Neurons environment: total device, patch, vulnerability and software counts.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ── Handler ─────────────────────────────────────────────────
export async function handleDexTool(name, args = {}) {
  switch (name) {
    case "dex_list_devices":
      return apiFetch(`/api/discovery/v1/device${odata({ $count: true, ...args })}`);

    case "dex_get_device":
      return apiFetch(`/api/discovery/v1/device/${encodeURIComponent(args.deviceId)}`);

    case "dex_list_patches":
      return apiFetch(`/api/patch/v1/patches${odata({ $count: true, ...args })}`);

    case "dex_list_vulnerabilities":
      return apiFetch(`/api/exposure/v1/vulnerabilities${odata({ $count: true, ...args })}`);

    case "dex_list_software":
      return apiFetch(`/api/discovery/v2/software${odata({ $count: true, ...args })}`);

    case "dex_get_environment_summary": {
      const [devices, patches, vulns, software] = await Promise.all([
        apiFetch("/api/discovery/v1/device?$top=1&$count=true").catch(() => null),
        apiFetch("/api/patch/v1/patches?$top=1&$count=true").catch(() => null),
        apiFetch("/api/exposure/v1/vulnerabilities?$top=1&$count=true").catch(() => null),
        apiFetch("/api/discovery/v2/software?$top=1&$count=true").catch(() => null),
      ]);
      return {
        devices:          devices?.["@odata.count"] ?? "unavailable",
        patches:          patches?.["@odata.count"] ?? "unavailable",
        vulnerabilities:  vulns?.["@odata.count"]   ?? "unavailable",
        software:         software?.["@odata.count"] ?? "unavailable",
      };
    }

    default:
      throw new Error(`Unknown DEX tool: ${name}`);
  }
}
