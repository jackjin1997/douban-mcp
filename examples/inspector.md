# Debugging with mcp-inspector

```bash
npx @modelcontextprotocol/inspector npx -y douban-mcp-cli serve
```

Browser opens at the inspector URL. Use the **Tools** tab to invoke any tool with arbitrary args. Use **Logs** tab to see stderr from the server.

For SSE mode:

```bash
npx -y douban-mcp-cli serve --transport sse --port 3000
# in a second terminal:
npx @modelcontextprotocol/inspector --sse http://localhost:3000/sse
```
