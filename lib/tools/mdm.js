// ────────────────────────────────────────────────────────────
// MDM module – Ivanti Neurons for MDM (formerly MobileIron Cloud)
// Auth: Basic Auth (username + password)
// ────────────────────────────────────────────────────────────

function baseUrl() {
  return (process.env.MDM_BASE_URL || "").replace(/\/+$/, "");
}

function basicHeaders() {
  const cred = Buffer.from(
    `${process.env.MDM_USERNAME}:${process.env.MDM_PASSWORD}`
  ).toString("base64");
  return {
    Authorization: `Basic ${cred}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function qs(params) {
  const parts = [];
  if (params.query)      parts.push(`query=${encodeURIComponent(params.query)}`);
  if (params.rows)       parts.push(`rows=${params.rows}`);
  if (params.start)      parts.push(`start=${params.start}`);
  if (params.sortFields) parts.push(`sortFields=${encodeURIComponent(params.sortFields)}`);
  if (params.sortOrder)  parts.push(`sortOrder=${params.sortOrder}`);
  return parts.length ? "?" + parts.join("&") : "";
}

async function apiFetch(path, opts = {}) {
  const url = `${baseUrl()}/rest${path}`;
  const res = await fetch(url, { headers: basicHeaders(), ...opts });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`MDM API ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Tool definitions ────────────────────────────────────────
export const mdmTools = [
  {
    name: "mdm_list_devices",
    description: "List managed devices from Ivanti MDM. Supports search queries and pagination.",
    inputSchema: {
      type: "object",
      properties: {
        query:      { type: "string", description: "Search query, e.g. 'common.os = Android'" },
        rows:       { type: "integer", description: "Number of rows (max 500, default 50)", default: 50 },
        start:      { type: "integer", description: "Start index for paging", default: 0 },
        sortFields: { type: "string", description: "Field to sort by" },
        sortOrder:  { type: "string", enum: ["ASC", "DESC"], description: "Sort order" },
      },
    },
  },
  {
    name: "mdm_get_device",
    description: "Get full details for a single MDM-managed device.",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "The device ID (device UUID)" },
      },
      required: ["deviceId"],
    },
  },
  {
    name: "mdm_list_device_groups",
    description: "List all device groups / spaces in Ivanti MDM.",
    inputSchema: {
      type: "object",
      properties: {
        rows:  { type: "integer", default: 50 },
        start: { type: "integer", default: 0 },
      },
    },
  },
  {
    name: "mdm_lock_device",
    description: "Send a LOCK command to a managed device.",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID to lock" },
      },
      required: ["deviceId"],
    },
  },
  {
    name: "mdm_wipe_device",
    description:
      "⚠️ DESTRUCTIVE – Send a RETIRE (wipe) command to a managed device. USE WITH EXTREME CAUTION.",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID to wipe" },
        confirm:  { type: "boolean", description: "Must be true to proceed" },
      },
      required: ["deviceId", "confirm"],
    },
  },
  {
    name: "mdm_restart_device",
    description: "Send a RESTART command to a managed device.",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID to restart" },
      },
      required: ["deviceId"],
    },
  },
  {
    name: "mdm_get_compliance",
    description: "Get compliance status for a specific device or all devices.",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "Device ID (omit for all devices)" },
        rows:     { type: "integer", default: 50 },
        start:    { type: "integer", default: 0 },
      },
    },
  },
  {
    name: "mdm_list_users",
    description: "List users enrolled in Ivanti MDM.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query for users" },
        rows:  { type: "integer", default: 50 },
        start: { type: "integer", default: 0 },
      },
    },
  },
];

// ── Handler ─────────────────────────────────────────────────
export async function handleMdmTool(name, args = {}) {
  switch (name) {
    case "mdm_list_devices":
      return apiFetch(`/api/v2/devices${qs(args)}`);

    case "mdm_get_device":
      return apiFetch(`/api/v2/devices/${encodeURIComponent(args.deviceId)}`);

    case "mdm_list_device_groups":
      return apiFetch(`/api/v2/device_groups${qs(args)}`);

    case "mdm_lock_device":
      return apiFetch(`/api/v2/devices/${encodeURIComponent(args.deviceId)}/action`, {
        method: "POST",
        body: JSON.stringify({ action: "LOCK" }),
      });

    case "mdm_wipe_device":
      if (!args.confirm) throw new Error("You must set confirm=true to wipe a device.");
      return apiFetch(`/api/v2/devices/${encodeURIComponent(args.deviceId)}/action`, {
        method: "POST",
        body: JSON.stringify({ action: "RETIRE" }),
      });

    case "mdm_restart_device":
      return apiFetch(`/api/v2/devices/${encodeURIComponent(args.deviceId)}/action`, {
        method: "POST",
        body: JSON.stringify({ action: "RESTART" }),
      });

    case "mdm_get_compliance": {
      const path = args.deviceId
        ? `/api/v2/devices/${encodeURIComponent(args.deviceId)}/compliance`
        : `/api/v2/devices/compliance${qs(args)}`;
      return apiFetch(path);
    }

    case "mdm_list_users":
      return apiFetch(`/api/v2/users${qs(args)}`);

    default:
      throw new Error(`Unknown MDM tool: ${name}`);
  }
}
