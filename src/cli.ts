#!/usr/bin/env node

import { Command } from 'commander';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { GraphQLClient } from 'graphql-request';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { generateMCPToolsFromSchema, MCPTool, getGraphQLVariableType } from './tool-generator.js';
import { introspectGraphQLSchema } from './introspect.js';
import { IntrospectionQuery, GraphQLArgument, GraphQLType, isNonNullType, isListType } from 'graphql';
import logger from './logger.js';

interface ServerConfig {
  graphqlEndpoint: string;
  headers?: Record<string, string>;
  schemaPath?: string;
  port?: number;
  skipIntrospection?: boolean;
  transport: 'stdio' | 'http';
}

class GraphQLMCPServer {
  private server: Server;
  private graphqlClient: GraphQLClient;
  private tools: MCPTool[] = [];
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.server = new Server(
      {
        name: 'fast-mcp-graphql',
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

      if (this.config.skipIntrospection) {
        // Load from cache file only, no network introspection
        if (this.config.schemaPath && existsSync(this.config.schemaPath)) {
          const schemaData = readFileSync(this.config.schemaPath, 'utf-8');
          introspectionResult = JSON.parse(schemaData);
          logger.info('Loaded schema from cache file:', this.config.schemaPath);
        } else {
          logger.error('No cached schema found and introspection disabled.');
          logger.error('To generate a schema cache, run one of the following:');
          logger.error('  1. Run without --no-introspection flag: npx fast-mcp-graphql');
          logger.error('  2. Or run: npm run introspect');
          logger.error(`  3. Or set GRAPHQL_ENDPOINT and run: npx fast-mcp-graphql`);
          throw new Error('No schema available');
        }
      } else {
        // Always introspect from network and update cache
        logger.info('Introspecting GraphQL schema...');
        introspectionResult = await introspectGraphQLSchema({
          endpoint: this.config.graphqlEndpoint,
          headers: this.config.headers
        });

        // Save the introspected schema for future use
        if (this.config.schemaPath) {
          writeFileSync(this.config.schemaPath, JSON.stringify(introspectionResult, null, 2));
          logger.info('Schema saved to:', this.config.schemaPath);
        }
      }

      this.tools = generateMCPToolsFromSchema(introspectionResult);

      // Count queries and mutations
      const queryTools = this.tools.filter(tool => tool.name.startsWith('query_'));
      const mutationTools = this.tools.filter(tool => tool.name.startsWith('mutation_'));

      logger.info(`Generated ${this.tools.length} tools from GraphQL schema:`);
      logger.info(`  - ${queryTools.length} query tools`);
      logger.info(`  - ${mutationTools.length} mutation tools`);
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
        // Find the tool definition to get GraphQL metadata
        const tool = this.tools.find(t => t.name === name);
        if (!tool || !tool._graphql) {
          throw new Error(`Unknown tool: ${name}`);
        }

        // Validate required parameters
        const missingParams = this.validateRequiredParameters(tool, args);
        if (missingParams.length > 0) {
          throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
        }

        const query = this.buildGraphQLOperation(tool._graphql, args);

        // Debug: Print the complete GraphQL request in a readable format
        logger.debug('\n🚀 GraphQL Request:', name);
        logger.debug('\n📝 Query:');
        logger.debug(query);
        if (args && Object.keys(args).length > 0) {
          logger.debug('\n📊 Variables:');
          logger.debug(JSON.stringify(args, null, 2));
        }
        logger.debug('\n⏳ Executing...\n');

        const result = await this.graphqlClient.request(query, args);

        // Debug: Print successful response (summarized)
        logger.debug('✅ Success');
        logger.debug('📦 Response keys:', result && typeof result === 'object' ? Object.keys(result).join(', ') : 'none');
        logger.debug('');

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

        // Debug: Print the error details
        logger.debug('❌ GraphQL Error:', name);
        logger.debug('💥 Error:', errorMessage);
        if (error && typeof error === 'object' && 'response' in error) {
          const response = (error as any).response;
          if (response?.status) {
            logger.debug('📊 Status:', response.status);
          }
          if (response?.errors) {
            logger.debug('🚨 GraphQL Errors:', JSON.stringify(response.errors, null, 2));
          }
        }
        logger.debug('');

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

  private validateRequiredParameters(tool: MCPTool, args: any): string[] {
    const missingParams: string[] = [];
    const requiredParams = tool.inputSchema.required || [];

    for (const param of requiredParams) {
      if (args === undefined || args === null ||
        !Object.prototype.hasOwnProperty.call(args, param) ||
        args[param] === undefined || args[param] === null) {
        missingParams.push(param);
      }
    }

    return missingParams;
  }

  private buildGraphQLOperation(graphqlInfo: NonNullable<MCPTool['_graphql']>, variables: any): string {
    const { fieldName, operationType, args, fieldSelection } = graphqlInfo;

    // Build variable declarations using proper GraphQL types
    const variableDeclarations = args
      .map(arg => `$${arg.name}: ${getGraphQLVariableType(arg.type)}`)
      .join(', ');

    // Build variable usage
    const variableUsage = args
      .map(arg => `${arg.name}: $${arg.name}`)
      .join(', ');

    // Build the complete GraphQL operation
    const operation = `
      ${operationType} ${fieldName}Operation${variableDeclarations ? `(${variableDeclarations})` : ''} {
        ${fieldName}${variableUsage ? `(${variableUsage})` : ''} ${fieldSelection}
      }
    `;

    return operation.trim();
  }

  async start() {
    await this.loadTools();

    if (this.config.transport === 'http') {
      await this.startHttpServer();
    } else {
      await this.startStdioServer();
    }
  }

  private async startStdioServer() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('GraphQL MCP Server started with stdio transport');
  }

  private async startHttpServer() {
    const port = this.config.port || 3000;

    const app = express();
    app.use(express.json());

    // Map to store transports by session ID
    const transports: Record<string, StreamableHTTPServerTransport> = {};

    // MCP POST endpoint
    const mcpPostHandler = async (req: express.Request, res: express.Response) => {
      const sessionId = req.headers['mcp-session-id'] as string;
      logger.info(sessionId ? `Received MCP request for session: ${sessionId}` : 'Received MCP request:', req.body);

      try {
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
          // Reuse existing transport
          transport = transports[sessionId];
        } else if (!sessionId && isInitializeRequest(req.body)) {
          // New initialization request
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId: string) => {
              // Store the transport by session ID when session is initialized
              logger.info(`Session initialized with ID: ${sessionId}`);
              transports[sessionId] = transport;
            }
          });

          // Set up onclose handler to clean up transport when closed
          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && transports[sid]) {
              logger.info(`Transport closed for session ${sid}, removing from transports map`);
              delete transports[sid];
            }
          };

          // Connect the transport to the MCP server BEFORE handling the request
          await this.server.connect(transport);
          await transport.handleRequest(req as any, res as any, req.body);
          return; // Already handled
        } else {
          // Invalid request - no session ID or not initialization request
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided',
            },
            id: null,
          });
          return;
        }

        // Handle the request with existing transport
        await transport.handleRequest(req as any, res as any, req.body);
      } catch (error) {
        logger.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    };

    // MCP GET endpoint for SSE streams
    const mcpGetHandler = async (req: express.Request, res: express.Response) => {
      const sessionId = req.headers['mcp-session-id'] as string;

      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }

      const transport = transports[sessionId];
      await transport.handleRequest(req as any, res as any);
    };

    // MCP DELETE endpoint for session termination
    const mcpDeleteHandler = async (req: express.Request, res: express.Response) => {
      const sessionId = req.headers['mcp-session-id'] as string;

      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }

      try {
        const transport = transports[sessionId];
        await transport.handleRequest(req as any, res as any);
      } catch (error) {
        logger.error('Error handling session termination:', error);
        if (!res.headersSent) {
          res.status(500).send('Error processing session termination');
        }
      }
    };

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        tools: this.tools.length,
        endpoint: this.config.graphqlEndpoint
      });
    });

    // Set up MCP routes
    app.post('/mcp', mcpPostHandler);
    app.get('/mcp', mcpGetHandler);
    app.delete('/mcp', mcpDeleteHandler);

    app.listen(port, () => {
      logger.info(`GraphQL MCP Server started with HTTP transport on port ${port}`);
      logger.info(`MCP endpoint: http://localhost:${port}/mcp`);
      logger.info(`Health check: http://localhost:${port}/health`);
    });
  }
}

export async function main() {
  const program = new Command();

  program
    .name('toolprint-graphql-mcp-forge')
    .description('MCP server that proxies to GraphQL services with dynamic tool generation')
    .version('1.0.0')
    .option('--no-introspection', 'Skip schema introspection and tool generation on startup')
    .option('--transport <type>', 'Transport type: stdio or http', 'stdio')
    .option('--port <number>', 'Port for HTTP transport', '3000')
    .parse();

  const options = program.opts();

  const config: ServerConfig = {
    graphqlEndpoint: process.env.GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
    headers: {},
    schemaPath: process.env.SCHEMA_PATH || join(process.cwd(), 'schema.json'),
    port: process.env.PORT ? parseInt(process.env.PORT) : parseInt(options.port),
    skipIntrospection: options.noIntrospection,
    transport: options.transport === 'http' ? 'http' : 'stdio'
  };

  // Add auth header if provided
  if (process.env.GRAPHQL_AUTH_HEADER) {
    config.headers!.Authorization = process.env.GRAPHQL_AUTH_HEADER;
  }

  // Add custom headers from environment variables
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('GRAPHQL_HEADER_')) {
      const headerName = key.replace('GRAPHQL_HEADER_', '').replace(/_/g, '-');
      config.headers![headerName] = process.env[key]!;
    }
  });

  logger.info(`Starting fast-mcp-graphql server:`);
  logger.info(`- Endpoint: ${config.graphqlEndpoint}`);
  logger.info(`- Transport: ${config.transport}`);
  logger.info(`- Schema introspection: ${config.skipIntrospection ? 'disabled' : 'enabled'}`);
  if (config.schemaPath) {
    logger.info(`- Schema cache: ${config.schemaPath}`);
  }
  if (config.transport === 'http') {
    logger.info(`- Port: ${config.port}`);
  }

  const server = new GraphQLMCPServer(config);
  await server.start();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Server failed to start:', error);
    process.exit(1);
  });
}