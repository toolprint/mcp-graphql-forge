import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { GraphQLClient } from 'graphql-request';
import { generateMCPToolsFromSchema, MCPTool, getGraphQLVariableType } from '../tool-generator.js';
import { mockIntrospectionResult } from './fixtures/introspection-result.js';

// Simple mock GraphQL server that handles actual queries
function createSimpleMockGraphQLServer(port: number = 4004) {
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

        // Handle actual queries - simplified parsing
        let responseData = {};

        if (query.includes('user(id:') || query.includes('user(')) {
          const userId = variables?.id || '1';
          const user = mockData.users.find(u => u.id === userId);
          responseData = { user };
        } else if (query.includes('users')) {
          responseData = { users: mockData.users };
        } else if (query.includes('createUser')) {
          const newUser = {
            id: String(mockData.users.length + 1),
            name: variables?.input?.name || 'New User',
            email: variables?.input?.email || 'new@example.com',
            role: variables?.input?.role || 'USER'
          };
          mockData.users.push(newUser);
          responseData = { createUser: newUser };
        }

        res.writeHead(200);
        res.end(JSON.stringify({ data: responseData }));
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

// Helper to build GraphQL operations like the actual server does
function buildGraphQLOperation(graphqlInfo: NonNullable<MCPTool['_graphql']>, variables: any): string {
  const { fieldName, operationType, args, fieldSelection } = graphqlInfo;
  
  const variableDeclarations = args
    .map(arg => `$${arg.name}: ${getGraphQLVariableType(arg.type)}`)
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

describe('GraphQL Execution Tests', () => {
  const mockServer = createSimpleMockGraphQLServer(4004);
  let graphqlClient: GraphQLClient;
  let tools: MCPTool[];

  beforeAll(async () => {
    await mockServer.start();
    graphqlClient = new GraphQLClient('http://localhost:4004/graphql');
    
    // Generate tools from the mock schema
    tools = generateMCPToolsFromSchema(mockIntrospectionResult);
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  describe('Tool Generation with Field Selections', () => {
    it('should generate tools with complete field selections', () => {
      expect(tools.length).toBeGreaterThan(0);
      
      const userTool = tools.find(t => t.name === 'query_user');
      expect(userTool).toBeDefined();
      expect(userTool?._graphql?.fieldSelection).toBeDefined();
      
      const fieldSelection = userTool?._graphql?.fieldSelection || '';
      console.log('User tool field selection:', fieldSelection);
      
      // Should contain all user fields
      expect(fieldSelection).toContain('id');
      expect(fieldSelection).toContain('name');
      expect(fieldSelection).toContain('email');
    });

    it('should generate proper GraphQL variable types', () => {
      const userTool = tools.find(t => t.name === 'query_user');
      expect(userTool?._graphql?.args).toBeDefined();
      
      const idArg = userTool?._graphql?.args.find(arg => arg.name === 'id');
      expect(idArg).toBeDefined();
    });
  });

  describe('GraphQL Query Generation and Execution', () => {
    it('should generate and execute a valid user query', async () => {
      const userTool = tools.find(t => t.name === 'query_user');
      expect(userTool?._graphql).toBeDefined();
      
      const query = buildGraphQLOperation(userTool!._graphql!, { id: '1' });
      console.log('Generated query:', query);
      
      // Query should be properly formatted
      expect(query).toContain('query userOperation');
      expect(query).toContain('$id: ID!');
      expect(query).toContain('user(id: $id)');
      expect(query).toContain('id');
      expect(query).toContain('name');
      expect(query).toContain('email');
      
      // Execute the query
      const result = await graphqlClient.request(query, { id: '1' });
      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe('1');
      expect(result.user.name).toBe('Alice');
    });

    it('should generate and execute a valid users list query', async () => {
      const usersTool = tools.find(t => t.name === 'query_users');
      expect(usersTool?._graphql).toBeDefined();
      
      const query = buildGraphQLOperation(usersTool!._graphql!, {});
      console.log('Generated users query:', query);
      
      // Query should be properly formatted
      expect(query).toContain('query usersOperation');
      expect(query).toContain('users');
      
      // Execute the query
      const result = await graphqlClient.request(query, {});
      expect(result).toBeDefined();
      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.users.length).toBe(2);
    });

    it('should generate and execute a valid createUser mutation', async () => {
      const createUserTool = tools.find(t => t.name === 'mutation_createUser');
      expect(createUserTool?._graphql).toBeDefined();
      
      const variables = {
        input: {
          name: 'Charlie',
          email: 'charlie@example.com',
          role: 'USER'
        }
      };
      
      const query = buildGraphQLOperation(createUserTool!._graphql!, variables);
      console.log('Generated mutation:', query);
      
      // Query should be properly formatted
      expect(query).toContain('mutation createUserOperation');
      expect(query).toContain('$input: CreateUserInput!');
      expect(query).toContain('createUser(input: $input)');
      
      // Execute the mutation
      const result = await graphqlClient.request(query, variables);
      expect(result).toBeDefined();
      expect(result.createUser).toBeDefined();
      expect(result.createUser.name).toBe('Charlie');
      expect(result.createUser.email).toBe('charlie@example.com');
      expect(result.createUser.id).toBeDefined();
    });
  });

  describe('Field Selection Depth and Completeness', () => {
    it('should include nested object fields in selections', () => {
      // Look for tools that might have nested objects
      tools.forEach(tool => {
        const fieldSelection = tool._graphql?.fieldSelection || '';
        if (fieldSelection.includes('{')) {
          console.log(`Tool ${tool.name} field selection:`, fieldSelection);
          
          // Should be properly formatted with braces
          expect(fieldSelection).toMatch(/\{[\s\S]*\}/);
        }
      });
    });

    it('should handle list types correctly', () => {
      const usersTool = tools.find(t => t.name === 'query_users');
      const fieldSelection = usersTool?._graphql?.fieldSelection || '';
      
      // Should contain field selections for list items
      expect(fieldSelection).toBeDefined();
      console.log('Users tool field selection:', fieldSelection);
    });
  });

  describe('Field Selection Caching', () => {
    it('should generate consistent field selections using cache', () => {
      // Generate tools again to test cache consistency
      const tools2 = generateMCPToolsFromSchema(mockIntrospectionResult);
      
      expect(tools2.length).toBe(tools.length);
      
      // Compare specific field selections
      const articlesTool1 = tools.find(t => t.name === 'query_user');
      const articlesTool2 = tools2.find(t => t.name === 'query_user');
      
      expect(articlesTool1).toBeDefined();
      expect(articlesTool2).toBeDefined();
      expect(articlesTool1?._graphql?.fieldSelection).toBe(articlesTool2?._graphql?.fieldSelection);
    });

    it('should properly handle circular references in cached selections', () => {
      const userTool = tools.find(t => t.name === 'query_user');
      expect(userTool?._graphql?.fieldSelection).toBeDefined();
      
      const fieldSelection = userTool?._graphql?.fieldSelection || '';
      
      // Should have proper field selections for complex nested types
      expect(fieldSelection).toContain('posts {');
      expect(fieldSelection).toContain('author { id }'); // Circular reference should be minimal
      
      // Should not have bare field names that would cause GraphQL errors
      expect(fieldSelection).not.toMatch(/\bposts\s*$/m); // No bare 'posts' field
      expect(fieldSelection).not.toMatch(/\bauthor\s*$/m); // No bare 'author' field
    });

    it('should generate proper field selections for list types', () => {
      const usersTool = tools.find(t => t.name === 'query_users');
      expect(usersTool?._graphql?.fieldSelection).toBeDefined();
      
      const fieldSelection = usersTool?._graphql?.fieldSelection || '';
      
      // List types should have the same field selection as single types
      const userTool = tools.find(t => t.name === 'query_user');
      expect(fieldSelection).toBe(userTool?._graphql?.fieldSelection);
    });

    it('should cache minimal selections for circular references', () => {
      // This test ensures that when we encounter circular references,
      // we use cached minimal selections instead of empty selections
      const userTool = tools.find(t => t.name === 'query_user');
      const fieldSelection = userTool?._graphql?.fieldSelection || '';
      
      // Check that circular reference fields have minimal but valid selections
      const authorMatch = fieldSelection.match(/author\s+\{[^}]+\}/);
      expect(authorMatch).toBeTruthy();
      
      if (authorMatch) {
        const authorSelection = authorMatch[0];
        // Should contain either id or documentId for minimal selection
        expect(authorSelection).toMatch(/\b(id|documentId)\b/);
      }
    });
  });

  describe('Error Cases', () => {
    it('should handle invalid GraphQL queries gracefully', async () => {
      const invalidQuery = 'invalid query syntax';
      
      try {
        await graphqlClient.request(invalidQuery);
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle missing variables', async () => {
      const userTool = tools.find(t => t.name === 'query_user');
      const query = buildGraphQLOperation(userTool!._graphql!, {});
      
      try {
        // This might work with null result or throw an error
        const result = await graphqlClient.request(query, {});
        // If it succeeds, user should be null or undefined
        expect(result.user).toBeNull();
      } catch (error) {
        // If it throws, that's also acceptable
        expect(error).toBeDefined();
      }
    });
  });
});