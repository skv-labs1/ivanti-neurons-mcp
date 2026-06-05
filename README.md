# Ivanti Neurons MCP Server

A zero-dependency MCP (Model Context Protocol) server that connects AI assistants to **Ivanti Neurons** — DEX, ITSM & MDM — via 24 tools over a stateless Streamable HTTP transport.

Built for **presales demos**. Deploy to Vercel in under 5 minutes.

## Architecture

```
┌────────────────────┐    JSON-RPC    ┌─────────────────────────┐
│  Claude Desktop /  │ ──────────────▶│  Vercel Serverless Fn   │
│  VS Code / Any     │    POST        │  /api/mcp               │
│  MCP Client        │ ◀──────────────│                         │
└────────────────────┘                │  ┌──── lib/tools/ ────┐ │
                                      │  │ dex.js   (6 tools) │ │
                                      │  │ itsm.js  (10 tools)│ │
                                      │  │ mdm.js   (8 tools) │ │
                                      │  └────────────────────┘ │
                                      └───────┬──────┬──────┬───┘
                                              │      │      │
                                   Bearer Token │  API Key │  Basic Auth
                                              ▼      ▼      ▼
                                      ┌──────┐ ┌────┐ ┌─────┐
                                      │ Neurons│ │ITSM│ │ MDM │
                                      │Platform│ │    │ │     │
                                      └──────┘ └────┘ └─────┘
```

## Tools Overview

| Module | Tools | Auth | Description |
|--------|-------|------|-------------|
| **DEX** | 6 | Bearer Token | Devices, Patches, Vulnerabilities, Software, Environment Summary |
| **ITSM** | 10 | REST API Key | Incidents, Service Requests, Changes — Search, Get, Create, Update, Dashboard |
| **MDM** | 8 | Basic Auth | Devices, Device Groups, Users, Lock, Wipe, Restart, Compliance |

## Quick Start

### 1. Clone & Deploy

```bash
git clone https://github.com/YOUR-USER/ivanti-neurons-mcp.git
cd ivanti-neurons-mcp
```

### 2. Set Credentials

**Option A — Browser UI (for demos):**
Visit `https://YOUR-DEPLOY.vercel.app/admin.html` and enter your credentials. They are stored in your browser's `sessionStorage` and sent as custom HTTP headers with each request. Nothing persists after you close the tab.

**Option B — Vercel Environment Variables (for Claude Desktop / VS Code):**
Copy `.env.example` to `.env` and fill in your values, or set them in the Vercel dashboard (Settings → Environment Variables).

| Variable | Module | Description |
|----------|--------|-------------|
| `NEURONS_BASE_URL` | DEX | Neurons tenant URL |
| `NEURONS_BEARER_TOKEN` | DEX | Bearer token (from bookmarklet or OAuth) |
| `ITSM_BASE_URL` | ITSM | ITSM instance URL |
| `ITSM_API_KEY` | ITSM | REST API key |
| `MDM_BASE_URL` | MDM | MDM instance URL |
| `MDM_USERNAME` | MDM | Admin username |
| `MDM_PASSWORD` | MDM | Admin password |

> **Credential priority:** Custom HTTP headers (browser UI) override Vercel env vars. This lets you demo with different tenants without redeploying.

> **Tip:** You only need to configure the modules you want to demo. Unconfigured modules will return API errors gracefully.

### 3. Deploy to Vercel

```bash
npx vercel --prod
```

### 4. Configure Your MCP Client

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "ivanti-neurons": {
      "transport": "http",
      "url": "https://YOUR-DEPLOY.vercel.app/api/mcp"
    }
  }
}
```

**VS Code** (`.vscode/settings.json`):
```json
{
  "mcp.servers": {
    "ivanti-neurons": {
      "transport": "http",
      "url": "https://YOUR-DEPLOY.vercel.app/api/mcp"
    }
  }
}
```

### 5. Test

```bash
# Health check
curl https://YOUR-DEPLOY.vercel.app/api/mcp

# Full test suite
bash test.sh https://YOUR-DEPLOY.vercel.app
```

## Pages

| URL | Description |
|-----|-------------|
| `/` | Dashboard — tool list, status badges, config snippets, test panel |
| `/admin.html` | Credentials manager — enter/test/save credentials per module |
| `/api/mcp` | MCP endpoint (POST for JSON-RPC, GET for health check) |

## DEX Bearer Token

The Neurons Platform APIs require a Bearer token. Options:

1. **Bookmarklet** — Use the existing bookmarklet from your AEM dashboard to capture a token from an active Neurons session.
2. **OAuth2** — Use App Registration client_credentials flow (note: only Device, Patch, Vuln, and Software public endpoints are accessible via OAuth).

The token expires — you'll need to refresh periodically. The admin page makes this easy: just paste a new token and click Test.

## License

MIT
