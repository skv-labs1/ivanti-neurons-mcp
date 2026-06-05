// ────────────────────────────────────────────────────────────
// ITSM module – Ivanti Neurons for ITSM (REST/OData)
// Auth: rest_api_key query parameter
// ────────────────────────────────────────────────────────────

function baseUrl() {
  return (process.env.ITSM_BASE_URL || "").replace(/\/+$/, "");
}

function apiKey() {
  return process.env.ITSM_API_KEY || "";
}

function authQs(extra = "") {
  const sep = extra.includes("?") ? "&" : "?";
  return `${extra}${sep}rest_api_key=${encodeURIComponent(apiKey())}`;
}

function jsonHeaders() {
  return { "Content-Type": "application/json", Accept: "application/json" };
}

function odata(params) {
  const qs = [];
  if (params.$filter)  qs.push(`$filter=${encodeURIComponent(params.$filter)}`);
  if (params.$top)     qs.push(`$top=${params.$top}`);
  if (params.$skip)    qs.push(`$skip=${params.$skip}`);
  if (params.$select)  qs.push(`$select=${encodeURIComponent(params.$select)}`);
  if (params.$orderby) qs.push(`$orderby=${encodeURIComponent(params.$orderby)}`);
  return qs.length ? "?" + qs.join("&") : "";
}

async function apiFetch(path, opts = {}) {
  const url = `${baseUrl()}${authQs(path)}`;
  const res = await fetch(url, { headers: jsonHeaders(), ...opts });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ITSM API ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Tool definitions ────────────────────────────────────────
export const itsmTools = [
  {
    name: "itsm_search_incidents",
    description: "Search incidents in Ivanti ITSM using OData filters.",
    inputSchema: {
      type: "object",
      properties: {
        $filter:  { type: "string", description: "OData $filter, e.g. \"Status eq 'Active'\"" },
        $top:     { type: "integer", description: "Max rows (default 25)", default: 25 },
        $skip:    { type: "integer", description: "Rows to skip" },
        $select:  { type: "string", description: "Comma-separated fields" },
        $orderby: { type: "string", description: "OData $orderby" },
      },
    },
  },
  {
    name: "itsm_get_incident",
    description: "Get a single incident by its RecId.",
    inputSchema: {
      type: "object",
      properties: {
        recId: { type: "string", description: "The RecId of the incident" },
      },
      required: ["recId"],
    },
  },
  {
    name: "itsm_create_incident",
    description: "Create a new incident in Ivanti ITSM.",
    inputSchema: {
      type: "object",
      properties: {
        Subject:    { type: "string", description: "Short summary of the incident" },
        Symptom:    { type: "string", description: "Detailed description / symptom" },
        Category:   { type: "string", description: "Incident category" },
        Priority:   { type: "string", description: "Priority level, e.g. 1, 2, 3, 4, 5" },
        Urgency:    { type: "string", description: "Urgency level" },
        Impact:     { type: "string", description: "Impact level" },
        Owner:      { type: "string", description: "Owner login ID" },
        OwnerTeam:  { type: "string", description: "Owner team name" },
      },
      required: ["Subject", "Symptom"],
    },
  },
  {
    name: "itsm_update_incident",
    description: "Update fields on an existing incident.",
    inputSchema: {
      type: "object",
      properties: {
        recId:  { type: "string", description: "RecId of the incident to update" },
        fields: {
          type: "object",
          description: "Key-value pairs of fields to update, e.g. {\"Status\":\"Resolved\",\"Resolution\":\"Fixed\"}",
          additionalProperties: true,
        },
      },
      required: ["recId", "fields"],
    },
  },
  {
    name: "itsm_search_service_requests",
    description: "Search service requests in Ivanti ITSM.",
    inputSchema: {
      type: "object",
      properties: {
        $filter:  { type: "string" },
        $top:     { type: "integer", default: 25 },
        $skip:    { type: "integer" },
        $select:  { type: "string" },
        $orderby: { type: "string" },
      },
    },
  },
  {
    name: "itsm_create_service_request",
    description: "Create a new service request.",
    inputSchema: {
      type: "object",
      properties: {
        Subject:     { type: "string", description: "Short summary" },
        Description: { type: "string", description: "Full description" },
        Category:    { type: "string", description: "SR category" },
        Priority:    { type: "string", description: "Priority level" },
        Urgency:     { type: "string", description: "Urgency level" },
        Owner:       { type: "string", description: "Owner login ID" },
        OwnerTeam:   { type: "string", description: "Owner team name" },
      },
      required: ["Subject"],
    },
  },
  {
    name: "itsm_search_changes",
    description: "Search change requests in Ivanti ITSM.",
    inputSchema: {
      type: "object",
      properties: {
        $filter:  { type: "string" },
        $top:     { type: "integer", default: 25 },
        $skip:    { type: "integer" },
        $select:  { type: "string" },
        $orderby: { type: "string" },
      },
    },
  },
  {
    name: "itsm_create_change",
    description: "Create a new change request in Ivanti ITSM.",
    inputSchema: {
      type: "object",
      properties: {
        Subject:     { type: "string", description: "Change subject" },
        Description: { type: "string", description: "Change description" },
        Category:    { type: "string", description: "Change category" },
        Priority:    { type: "string", description: "Priority level" },
        ChangeType:  { type: "string", description: "Type: Standard, Normal, Emergency" },
        RiskLevel:   { type: "string", description: "Risk level: Low, Medium, High" },
      },
      required: ["Subject"],
    },
  },
  {
    name: "itsm_search_objects",
    description:
      "Generic search on any ITSM business object type (e.g. Problem, KnowledgeArticle, CI).",
    inputSchema: {
      type: "object",
      properties: {
        objectType: { type: "string", description: "Business object plural name, e.g. 'problems', 'KnowledgeArticles'" },
        $filter:    { type: "string" },
        $top:       { type: "integer", default: 25 },
        $skip:      { type: "integer" },
        $select:    { type: "string" },
        $orderby:   { type: "string" },
      },
      required: ["objectType"],
    },
  },
  {
    name: "itsm_get_dashboard_stats",
    description:
      "Get ITSM dashboard statistics: counts of active incidents, open service requests, and pending changes.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ── Handler ─────────────────────────────────────────────────
export async function handleItsmTool(name, args = {}) {
  const bo = "/api/odata/businessobject";

  switch (name) {
    case "itsm_search_incidents":
      return apiFetch(`${bo}/incidents${odata(args)}`);

    case "itsm_get_incident":
      return apiFetch(`${bo}/incidents('${args.recId}')`);

    case "itsm_create_incident": {
      const { $filter, $top, $skip, $select, $orderby, ...body } = args;
      return apiFetch(`${bo}/incidents`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    }

    case "itsm_update_incident":
      return apiFetch(`${bo}/incidents('${args.recId}')`, {
        method: "PATCH",
        body: JSON.stringify(args.fields),
      });

    case "itsm_search_service_requests":
      return apiFetch(`${bo}/ServiceReqs${odata(args)}`);

    case "itsm_create_service_request": {
      const { $filter, $top, $skip, $select, $orderby, ...body } = args;
      return apiFetch(`${bo}/ServiceReqs`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    }

    case "itsm_search_changes":
      return apiFetch(`${bo}/changes${odata(args)}`);

    case "itsm_create_change": {
      const { $filter, $top, $skip, $select, $orderby, ...body } = args;
      return apiFetch(`${bo}/changes`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    }

    case "itsm_search_objects": {
      const { objectType, ...odataParams } = args;
      return apiFetch(`${bo}/${objectType}${odata(odataParams)}`);
    }

    case "itsm_get_dashboard_stats": {
      const countQs = "?$top=0&$count=true";
      const [inc, sr, chg] = await Promise.all([
        apiFetch(`${bo}/incidents${countQs}&$filter=${encodeURIComponent("Status ne 'Closed'")}`).catch(() => null),
        apiFetch(`${bo}/ServiceReqs${countQs}&$filter=${encodeURIComponent("Status ne 'Closed'")}`).catch(() => null),
        apiFetch(`${bo}/changes${countQs}&$filter=${encodeURIComponent("Status ne 'Closed'")}`).catch(() => null),
      ]);
      return {
        activeIncidents:      inc?.["@odata.count"] ?? "unavailable",
        openServiceRequests:  sr?.["@odata.count"]  ?? "unavailable",
        pendingChanges:       chg?.["@odata.count"]  ?? "unavailable",
      };
    }

    default:
      throw new Error(`Unknown ITSM tool: ${name}`);
  }
}
