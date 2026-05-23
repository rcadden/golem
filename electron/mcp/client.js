/**
 * MCPManager — Golem's MCP client layer.
 *
 * Manages stdio-based connections to one or more MCP servers.
 * Tools are discovered at connect time and merged into Golem's
 * tool registry via the `mcpTools` / `mcpManager` ctx fields.
 */

const { Client }             = require('@modelcontextprotocol/sdk/client/index.js')
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js')

class MCPManager {
  constructor() {
    // serverId (int) → { client, transport, tools: [], serverName }
    this._connections = new Map()
    // serverId → last error string (for status reporting)
    this._errors = new Map()
    // serverId → server config (needed for reconnect)
    this._serverConfigs = new Map()
  }

  // ── Connect ──────────────────────────────────────────────────────────────────

  async connect(server) {
    // Tear down any existing connection first
    await this.disconnect(server.id)
    this._errors.delete(server.id)
    this._serverConfigs.set(server.id, server)

    let args = []
    let env  = {}
    try { args = JSON.parse(server.args_json || '[]') }  catch {}
    try { env  = JSON.parse(server.env_json  || '{}') }  catch {}

    const transport = new StdioClientTransport({
      command: server.command,
      args,
      env: { ...process.env, ...env },
    })

    const client = new Client(
      { name: 'golem', version: '1.0.0' },
      { capabilities: {} }
    )

    await client.connect(transport)
    const { tools = [] } = await client.listTools()

    this._connections.set(server.id, {
      client,
      transport,
      tools,
      serverName: server.name,
      serverId: server.id,
    })

    transport.onerror = (err) => {
      if (!this._connections.has(server.id)) return
      this._connections.delete(server.id)
      this._errors.set(server.id, `Crashed: ${err?.message || String(err)}`)
      this._scheduleReconnect(server.id, 0)
    }

    transport.onclose = () => {
      if (!this._connections.has(server.id)) return
      this._connections.delete(server.id)
      this._errors.set(server.id, 'Server disconnected unexpectedly')
      this._scheduleReconnect(server.id, 0)
    }

    return tools
  }

  // ── Disconnect ───────────────────────────────────────────────────────────────

  async disconnect(serverId) {
    const conn = this._connections.get(serverId)
    if (!conn) return
    try { await conn.client.close() } catch {}
    this._connections.delete(serverId)
  }

  // ── Reconnect ─────────────────────────────────────────────────────────────────

  _scheduleReconnect(serverId, attempt) {
    const MAX_ATTEMPTS = 3
    if (attempt >= MAX_ATTEMPTS) return

    const delay = Math.pow(2, attempt) * 1000  // 1000ms, 2000ms, 4000ms
    setTimeout(async () => {
      const server = this._serverConfigs.get(serverId)
      if (!server || !server.enabled) return
      try {
        await this.connect(server)
        this._errors.delete(serverId)
      } catch (err) {
        this._errors.set(serverId, err.message || String(err))
        this._scheduleReconnect(serverId, attempt + 1)
      }
    }, delay)
  }

  // ── Connect all enabled servers ───────────────────────────────────────────────

  async connectAll(servers) {
    const results = []
    for (const server of servers) {
      if (!server.enabled) continue
      try {
        const tools = await this.connect(server)
        results.push({ serverId: server.id, ok: true, toolCount: tools.length })
      } catch (err) {
        this._errors.set(server.id, err.message)
        results.push({ serverId: server.id, ok: false, error: err.message })
      }
    }
    return results
  }

  // ── Tool listing ──────────────────────────────────────────────────────────────

  /**
   * Returns all tools across all connected servers.
   * Each entry: { serverId, serverName, tool }
   * where `tool` is the raw MCP Tool object { name, description, inputSchema }.
   */
  getTools(projectAssociations = null) {
    const out = []
    for (const [serverId, conn] of this._connections) {
      // Phase 3: if the caller passes a set of allowed serverIds, filter
      if (projectAssociations !== null && !projectAssociations.has(serverId)) continue
      for (const tool of conn.tools) {
        out.push({ serverId, serverName: conn.serverName, tool })
      }
    }
    return out
  }

  // ── Tool execution ────────────────────────────────────────────────────────────

  async callTool(serverId, name, args) {
    const conn = this._connections.get(serverId)
    if (!conn) throw new Error(`MCP server ${serverId} is not connected`)
    const result = await conn.client.callTool({ name, arguments: args ?? {} })
    // MCP returns { content: [{ type, text }] } — flatten to a single string
    // or return the array if there are multiple parts.
    const parts = result?.content ?? []
    if (parts.length === 0) return null
    if (parts.length === 1 && parts[0].type === 'text') return parts[0].text
    return parts
  }

  // ── Status ────────────────────────────────────────────────────────────────────

  getStatus() {
    const status = {}
    for (const [serverId, conn] of this._connections) {
      status[serverId] = { connected: true, toolCount: conn.tools.length, tools: conn.tools.map(t => t.name) }
    }
    return status
  }

  getErrors() {
    return Object.fromEntries(this._errors)
  }

  isConnected(serverId) {
    return this._connections.has(serverId)
  }
}

module.exports = new MCPManager()
