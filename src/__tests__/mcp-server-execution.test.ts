import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { GraphQLClient } from 'graphql-request';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { generateMCPToolsFromSchema, MCPTool } from '../tool-generator.js';
import { introspectGraphQLSchema } from '../introspect.js';
import { mockIntrospectionResult } from './fixtures/introspection-result.js';

// Enhanced mock GraphQL server that handles actual queries
function createEnhancedMockGraphQLServer(port: number = 4003) {
  const mockData = {
    users: [
      { id: '1', name: 'Alice', email: 'alice@example.com', role: 'ADMIN' },
      { id: '2', name: 'Bob', email: 'bob@example.com', role: 'USER' }
    ],
    posts: [
      { id: '1', title: 'Hello World', content: 'First post', authorId: '1' },
      { id: '2', title: 'GraphQL is Great', content: 'Second post', authorId: '2' }
    ]
  };

  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { query, variables } = JSON.parse(body);
        
        // Handle introspection
        if (query.includes('__schema')) {
          res.writeHead(200);
          res.end(JSON.stringify({
            data: mockIntrospectionResult
          }));
          return;
        }

        // Handle actual queries
        let responseData = {};

        // Parse the query to determine what to return
        if (query.includes('query userOperation')) {
          const userId = variables?.id;
          const user = mockData.users.find(u => u.id === userId);
          responseData = { user };
        } else if (query.includes('query usersOperation')) {
          const limit = variables?.limit || mockData.users.length;
          const offset = variables?.offset || 0;
          const users = mockData.users.slice(offset, offset + limit);
          responseData = { users };
        } else if (query.includes('mutation createUserOperation')) {
          const newUser = {
            id: String(mockData.users.length + 1),
            ...variables?.input
          };
          mockData.users.push(newUser);
          responseData = { createUser: newUser };
        }

        res.writeHead(200);
        res.end(JSON.stringify({
          data: responseData
        }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ 
          error: 'Invalid request',
          details: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    });
  });

  return {
    server,
    start: () => new Promise<void>((resolve) => {
      server.listen(port, () => {
        resolve();
      });
    }),
    stop: () => new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    })
  };
}

// Mock MCP Server class for testing
class TestGraphQLMCPServer {
  private server: Server;
  private graphqlClient: GraphQLClient;
  private tools: MCPTool[] = [];

  constructor(graphqlEndpoint: string) {
    this.server = new Server(
      {
        name: 'test-fast-mcp-graphql',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.graphqlClient = new GraphQLClient(graphqlEndpoint);
    this.setupHandlers();
  }

  async loadTools() {
    const introspectionResult = await introspectGraphQLSchema({
      endpoint: this.graphqlClient.url
    });

    this.tools = generateMCPToolsFromSchema(introspectionResult);
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
        const tool = this.tools.find(t => t.name === name);
        if (!tool || !tool._graphql) {
          throw new Error(`Unknown tool: ${name}`);
        }

        const query = this.buildGraphQLOperation(tool._graphql, args);
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

  private getGraphQLVariableType(graphqlType: any): string {
    if (graphqlType.kind === 'NON_NULL') {
      return `${this.getGraphQLVariableType(graphqlType.ofType)}!`;
    }
    
    if (graphqlType.kind === 'LIST') {
      return `[${this.getGraphQLVariableType(graphqlType.ofType)}]`;
    }
    
    return graphqlType.name;
  }

  private buildGraphQLOperation(graphqlInfo: NonNullable<MCPTool['_graphql']>, variables: any): string {
    const { fieldName, operationType, args, fieldSelection } = graphqlInfo;
    
    const variableDeclarations = args
      .map(arg => `$${arg.name}: ${this.getGraphQLVariableType(arg.type)}`)
      .join(', ');
    
    const variableUsage = args
      .map(arg => `${arg.name}: $${arg.name}`)
      .join(', ');

    const operation = `
      ${operationType} ${fieldName}Operation${variableDeclarations ? `(${variableDeclarations})` : ''} {
        ${fieldName}${variableUsage ? `(${variableUsage})` : ''} ${fieldSelection}
      }
    `;

    return operation.trim();
  }

  // Test helper methods
  async callTool(toolName: string, args: any = {}) {
    const request = {
      method: 'tools/call' as const,
      params: {
        name: toolName,
        arguments: args
      }
    };

    return await this.server.request(request);
  }

  async listTools() {
    const request = {
      method: 'tools/list' as const,
      params: {}
    };

    return await this.server.request(request);
  }

  getTools() {
    return this.tools;
  }
}

describe('MCP Server Execution Tests', () => {
  const mockServer = createEnhancedMockGraphQLServer(4003);
  let mcpServer: TestGraphQLMCPServer;

  beforeAll(async () => {
    await mockServer.start();
    mcpServer = new TestGraphQLMCPServer('http://localhost:4003/graphql');
    await mcpServer.loadTools();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  describe('Tool Generation and Structure', () => {
    it('should generate tools with proper GraphQL metadata', async () => {
      const tools = mcpServer.getTools();
      
      expect(tools.length).toBeGreaterThan(0);
      
      // Check that tools have _graphql metadata
      tools.forEach(tool => {
        expect(tool._graphql).toBeDefined();
        expect(tool._graphql?.fieldName).toBeDefined();
        expect(tool._graphql?.operationType).toMatch(/^(query|mutation)$/);
        expect(tool._graphql?.args).toBeDefined();
        expect(tool._graphql?.fieldSelection).toBeDefined();
      });
    });

    it('should generate proper field selections for complex types', async () => {
      const tools = mcpServer.getTools();
      
      const userTool = tools.find(t => t.name === 'query_user');
      expect(userTool?._graphql?.fieldSelection).toContain('id');
      expect(userTool?._graphql?.fieldSelection).toContain('name');
      expect(userTool?._graphql?.fieldSelection).toContain('email');
      expect(userTool?._graphql?.fieldSelection).toContain('role');
    });
  });

  describe('Query Tool Execution', () => {
    it('should execute query_user tool successfully', async () => {
      const result = await mcpServer.callTool('query_user', { id: '1' });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const data = JSON.parse(result.content[0].text);
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe('1');
      expect(data.user.name).toBe('Alice');
      expect(data.user.email).toBe('alice@example.com');
    });

    it('should execute query_users tool successfully', async () => {
      const result = await mcpServer.callTool('query_users', { limit: 2, offset: 0 });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const data = JSON.parse(result.content[0].text);
      expect(data.users).toBeDefined();
      expect(Array.isArray(data.users)).toBe(true);
      expect(data.users.length).toBe(2);
      expect(data.users[0].name).toBe('Alice');
      expect(data.users[1].name).toBe('Bob');
    });

    it('should handle query_users with no parameters', async () => {
      const result = await mcpServer.callTool('query_users', {});
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      
      const data = JSON.parse(result.content[0].text);
      expect(data.users).toBeDefined();
      expect(Array.isArray(data.users)).toBe(true);
    });
  });

  describe('Mutation Tool Execution', () => {
    it('should execute mutation_createUser tool successfully', async () => {
      const newUserInput = {
        name: 'Charlie',
        email: 'charlie@example.com',
        role: 'USER'
      };

      const result = await mcpServer.callTool('mutation_createUser', {
        input: newUserInput
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const data = JSON.parse(result.content[0].text);
      expect(data.createUser).toBeDefined();
      expect(data.createUser.name).toBe('Charlie');
      expect(data.createUser.email).toBe('charlie@example.com');
      expect(data.createUser.role).toBe('USER');
      expect(data.createUser.id).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool names gracefully', async () => {
      const result = await mcpServer.callTool('unknown_tool', {});
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Unknown tool: unknown_tool');
      expect(result.isError).toBe(true);
    });

    it('should handle missing required parameters', async () => {
      // Try to call query_user without required id parameter
      const result = await mcpServer.callTool('query_user', {});
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      // Should either error or return null user
      const data = JSON.parse(result.content[0].text);
      expect(data.user).toBeNull();
    });
  });

  describe('GraphQL Query Generation', () => {
    it('should generate valid GraphQL queries with proper types', async () => {
      const tools = mcpServer.getTools();
      
      // Check user query tool
      const userTool = tools.find(t => t.name === 'query_user');
      expect(userTool?._graphql?.args[0].name).toBe('id');
      
      // Check users query tool  
      const usersTool = tools.find(t => t.name === 'query_users');
      expect(usersTool?._graphql?.args.some(arg => arg.name === 'limit')).toBe(true);
      expect(usersTool?._graphql?.args.some(arg => arg.name === 'offset')).toBe(true);
      
      // Check createUser mutation tool
      const createUserTool = tools.find(t => t.name === 'mutation_createUser');
      expect(createUserTool?._graphql?.args[0].name).toBe('input');
    });

    it('should include all available fields in field selections', async () => {
      const tools = mcpServer.getTools();
      
      const userTool = tools.find(t => t.name === 'query_user');
      const fieldSelection = userTool?._graphql?.fieldSelection || '';
      
      // Should include all User fields
      expect(fieldSelection).toContain('id');
      expect(fieldSelection).toContain('name'); 
      expect(fieldSelection).toContain('email');
      expect(fieldSelection).toContain('role');
      
      // Should be properly formatted
      expect(fieldSelection).toMatch(/\{[\s\S]*\}/); // Contains braces
    });
  });

  describe('Tool List Functionality', () => {
    it('should list all available tools', async () => {
      const result = await mcpServer.listTools();
      
      expect(result).toBeDefined();
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);
      
      // Should have both query and mutation tools
      const queryTools = result.tools.filter((t: any) => t.name.startsWith('query_'));
      const mutationTools = result.tools.filter((t: any) => t.name.startsWith('mutation_'));
      
      expect(queryTools.length).toBeGreaterThan(0);
      expect(mutationTools.length).toBeGreaterThan(0);
    });

    it('should provide proper tool schemas', async () => {
      const result = await mcpServer.listTools();
      
      result.tools.forEach((tool: any) => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      });
    });
  });
});