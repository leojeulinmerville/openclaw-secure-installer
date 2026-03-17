import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import Database from 'better-sqlite3';
import { resolve } from 'path';

const DATABASE_PATH = process.env.DATABASE_PATH || 'database.sqlite';

class SqliteMcpServer {
  private server: Server;
  private db: Database.Database;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-sql-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    const dbPath = resolve(process.cwd(), DATABASE_PATH);
    console.error(`Connecting to database at: ${dbPath}`);
    
    try {
      this.db = new Database(dbPath);
    } catch (error) {
      console.error('Failed to open database:', error);
      process.exit(1);
    }

    this.setupHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      this.db.close();
      process.exit(0);
    });
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_tables',
          description: 'Returns names of all tables in the database',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'describe_table',
          description: 'Takes a table name and returns its column information',
          inputSchema: {
            type: 'object',
            properties: {
              table: {
                type: 'string',
                description: 'The name of the table to describe',
              },
            },
            required: ['table'],
          },
        },
        {
          name: 'read_query',
          description: 'Takes a SELECT SQL query and returns results',
          inputSchema: {
            type: 'object',
            properties: {
              sql: {
                type: 'string',
                description: 'The SELECT SQL query to execute',
              },
            },
            required: ['sql'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'list_tables':
            return this.handleListTables();
          case 'describe_table':
            return this.handleDescribeTable(request.params.arguments);
          case 'read_query':
            return this.handleReadQuery(request.params.arguments);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private handleListTables() {
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    
    return {
      content: [
        {
          type: 'text',
          text: tables.map(t => t.name).join('\n') || 'No tables found.',
        },
      ],
    };
  }

  private handleDescribeTable(args: any) {
    const { table } = args;
    if (typeof table !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Table name must be a string');
    }

    // Basic protection against SQL injection for table names
    if (!/^[a-zA-Z0-9_]+$/.test(table)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid table name format');
    }

    try {
      const info = this.db.prepare(`PRAGMA table_info(${table})`).all();
      if (info.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Table '${table}' not found.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Failed to describe table: ${error.message}`);
    }
  }

  private handleReadQuery(args: any) {
    const { sql } = args;
    if (typeof sql !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'SQL query must be a string');
    }

    const trimmedSql = sql.trim().toUpperCase();
    if (!trimmedSql.startsWith('SELECT')) {
      throw new McpError(ErrorCode.InvalidParams, 'Only SELECT queries are allowed for read_query');
    }

    try {
      const results = this.db.prepare(sql).all();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(ErrorCode.InternalError, `Query execution failed: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP SQLite server running on stdio');
  }
}

const server = new SqliteMcpServer();
server.run().catch((error) => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});
