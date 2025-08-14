import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GraphQLClient } from 'graphql-request';
import { generateMCPToolsFromSchema, MCPTool } from '../tool-generator.js';
import { introspectGraphQLSchema } from '../introspect.js';
import { createMockGraphQLService } from './fixtures/mock-graphql-service.js';

// Mock MCP Server class for testing
class TestGraphQLMCPServer {
  private graphqlClient: GraphQLClient;
  private tools: MCPTool[] = [];

  constructor(graphqlEndpoint: string) {
    this.graphqlClient = new GraphQLClient(graphqlEndpoint);
  }

  async loadTools() {
    const introspectionResult = await introspectGraphQLSchema({
      endpoint: this.graphqlClient.url
    });

    this.tools = generateMCPToolsFromSchema(introspectionResult);
  }

  private executeCall(tool: MCPTool, args: any) {
    const query = this.buildGraphQLOperation(tool._graphql!, args);
    return this.graphqlClient.request(query, args);
  }

  private buildGraphQLOperation(graphqlInfo: NonNullable<MCPTool['_graphql']>): string {
    const { fieldName, operationType, args, fieldSelection } = graphqlInfo;
    const variableDeclarations = args
      .map(arg => `$${arg.name}: ${arg.type}`)
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
    const tool = this.tools.find(t => t.name === toolName);
    if (!tool || !tool._graphql) {
      return {
        content: [
          { type: 'text', text: `Unknown tool: ${toolName}` }
        ],
        isError: true
      };
    }
    try {
      const result = await this.executeCall(tool, args);
      return {
        content: [
          { type: 'text', text: JSON.stringify(result, null, 2) }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          { type: 'text', text: `Error executing ${toolName}: ${errorMessage}` }
        ],
        isError: true
      };
    }
  }

  async listTools() {
    return { tools: this.tools };
  }

  getTools() {
    return this.tools;
  }
}


describe('MCP Server Execution Tests', () => {
  const mockServer = createMockGraphQLService(4003);
  let mcpServer: TestGraphQLMCPServer;

  beforeAll(async () => {
    await mockServer.start();
    mcpServer = new TestGraphQLMCPServer(mockServer.url);
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
      if (result.isError) {
        expect(result.content[0].text).toContain('Error executing query_user');
      } else {
        const data = JSON.parse(result.content[0].text);
        expect(data.user).toBeNull();
      }
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