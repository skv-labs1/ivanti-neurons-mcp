#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Quick curl tests for the Ivanti Neurons MCP Server
# Usage: bash test.sh [BASE_URL]
# Example: bash test.sh https://ivanti-neurons-mcp.vercel.app
# ─────────────────────────────────────────────────────────────
set -e

BASE="${1:-http://localhost:3000}"
MCP="$BASE/api/mcp"
H="Content-Type: application/json"

echo "═══ Health Check (GET) ═══"
curl -s "$MCP" | jq .

echo ""
echo "═══ Initialize ═══"
curl -s -X POST "$MCP" -H "$H" -d '{
  "jsonrpc":"2.0","id":1,"method":"initialize",
  "params":{"protocolVersion":"2025-03-26","clientInfo":{"name":"test","version":"0.1"}}
}' | jq .

echo ""
echo "═══ Tools List ═══"
curl -s -X POST "$MCP" -H "$H" -d '{
  "jsonrpc":"2.0","id":2,"method":"tools/list"
}' | jq '.result.tools | length'

echo ""
echo "═══ DEX: Environment Summary ═══"
curl -s -X POST "$MCP" -H "$H" -d '{
  "jsonrpc":"2.0","id":3,"method":"tools/call",
  "params":{"name":"dex_get_environment_summary","arguments":{}}
}' | jq .

echo ""
echo "═══ ITSM: Dashboard Stats ═══"
curl -s -X POST "$MCP" -H "$H" -d '{
  "jsonrpc":"2.0","id":4,"method":"tools/call",
  "params":{"name":"itsm_get_dashboard_stats","arguments":{}}
}' | jq .

echo ""
echo "═══ MDM: List Devices (first 5) ═══"
curl -s -X POST "$MCP" -H "$H" -d '{
  "jsonrpc":"2.0","id":5,"method":"tools/call",
  "params":{"name":"mdm_list_devices","arguments":{"rows":5}}
}' | jq .

echo ""
echo "═══ Done ═══"
