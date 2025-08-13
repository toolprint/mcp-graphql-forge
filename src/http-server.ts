import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { GraphQLClient } from 'graphql-request';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { generateMCPToolsFromSchema } from './tool-generator.js';
import { introspectGraphQLSchema } from './introspect.js';
import logger from './logger.js';
import { IntrospectionQuery } from 'graphql';

interface ServerConfig {
  graphqlEndpoint: string;
  headers?: Record<string, string>;
  schemaPath?: string;
  port?: number;
}

class GraphQLMCPHTTPServer {
  private server: Server;
  private graphqlClient: GraphQLClient;
  private tools: any[] = [];
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.server = new Server(
      {
        name: 'fast-mcp-graphql-http',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.graphqlClient = new GraphQLClient(config.graphqlEndpoint, {
      headers: config.headers || {}
    });

    this.setupHandlers();
  }

  private async loadTools() {
    try {
      let introspectionResult: IntrospectionQuery;

      if (this.config.schemaPath && existsSync(this.config.schemaPath)) {
        const schemaData = readFileSync(this.config.schemaPath, 'utf-8');
        introspectionResult = JSON.parse(schemaData);
        logger.info('Loaded schema from file:', this.config.schemaPath);
      } else {
        logger.info('Introspecting GraphQL schema...');
        introspectionResult = await introspectGraphQLSchema({
          endpoint: this.config.graphqlEndpoint,
          headers: this.config.headers
        });
      }

      this.tools = generateMCPToolsFromSchema(introspectionResult);
      logger.info(`Generated ${this.tools.length} tools from GraphQL schema`);
    } catch (error) {
      logger.error('Failed to load tools:', error);
      throw error;
    }
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.tools
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        const isQuery = name.startsWith('query_');
        const isMutation = name.startsWith('mutation_');
        
        if (!isQuery && !isMutation) {
          throw new Error(`Unknown tool: ${name}`);
        }

        const operationName = name.replace(/^(query_|mutation_)/, '');
        const operationType = isQuery ? 'query' : 'mutation';
        
        const query = this.buildGraphQLOperation(operationType, operationName, args);
        const result = await this.graphqlClient.request(query, args);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${errorMessage}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private buildGraphQLOperation(type: string, operationName: string, variables: any): string {
    const variableDeclarations = Object.keys(variables || {})
      .map(key => `$${key}: String`)
      .join(', ');
    
    const variableUsage = Object.keys(variables || {})
      .map(key => `${key}: $${key}`)
      .join(', ');

    return `
      ${type} ${operationName}Operation${variableDeclarations ? `(${variableDeclarations})` : ''} {
        ${operationName}${variableUsage ? `(${variableUsage})` : ''}
      }
    `;
  }

  async start() {
    await this.loadTools();
    
    const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', tools: this.tools.length }));
        return;
      }
      
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    });
    
    // For now, use stdio transport until SSE is properly configured
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    const port = this.config.port || 3000;
    httpServer.listen(port, () => {
      logger.info(`GraphQL MCP HTTP Server started on port ${port}`);
      logger.info(`Health check: http://localhost:${port}/health`);
      logger.info(`Note: Server uses stdio transport for MCP communication`);
    });
  }
}

async function main() {
  const config: ServerConfig = {
    graphqlEndpoint: process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
    headers: {},
    schemaPath: process.env.SCHEMA_PATH || join(process.cwd(), 'schema.json'),
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000
  };

  if (process.env.GRAPHQL_AUTH_HEADER) {
    config.headers!.Authorization = process.env.GRAPHQL_AUTH_HEADER;
  }

  const server = new GraphQLMCPHTTPServer(config);
  await server.start();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Server failed to start:', error);
    process.exit(1);
  });
}