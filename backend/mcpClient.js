import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

class MCPManager {
    constructor() {
        this.clients = new Map();
        this.tools = [];
    }

    async registerServer(name, command, args = [], env = {}) {
        try {
            console.log(`Connecting to MCP server [${name}] via command: ${command} ${args.join(' ')}`);
            const transport = new StdioClientTransport({
                command,
                args,
                env: { ...process.env, ...env }
            });

            const client = new Client({
                name: `system-dashboard-mcp-client-${name}`,
                version: '1.0.0'
            }, {
                capabilities: {}
            });

            await client.connect(transport);
            this.clients.set(name, client);

            // Fetch available tools from the server
            const serverTools = await client.listTools();
            if (serverTools && serverTools.tools) {
                for (const tool of serverTools.tools) {
                    this.tools.push({
                        serverName: name,
                        ...tool
                    });
                }
                console.log(`Successfully registered ${serverTools.tools.length} tools from MCP server [${name}]`);
            }
        } catch (err) {
            console.error(`Failed to register MCP server [${name}]:`, err.message);
        }
    }

    getAllTools() {
        // Map MCP tools to Ollama tools schema format
        return this.tools.map(tool => ({
            type: 'function',
            function: {
                name: `${tool.serverName}__${tool.name}`,
                description: tool.description,
                parameters: tool.inputSchema
            }
        }));
    }

    async executeTool(nameWithPrefix, args) {
        const parts = nameWithPrefix.split('__');
        if (parts.length < 2) throw new Error(`Invalid tool name format: ${nameWithPrefix}`);
        
        const serverName = parts[0];
        const toolName = parts.slice(1).join('__');

        const client = this.clients.get(serverName);
        if (!client) throw new Error(`MCP server [${serverName}] is not registered`);

        // Sanitize arguments: remove null or "null" values
        if (args && typeof args === 'object') {
            for (const key of Object.keys(args)) {
                if (args[key] === null || args[key] === 'null' || args[key] === undefined) {
                    delete args[key];
                }
            }
        }

        console.log(`Executing MCP tool [${toolName}] on server [${serverName}] with args:`, args);
        const result = await client.callTool({
            name: toolName,
            arguments: args
        });
        return result;
    }
}

export const mcpManager = new MCPManager();
