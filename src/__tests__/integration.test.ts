import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { introspectGraphQLSchema } from '../introspect.js';
import { generateMCPToolsFromSchema } from '../tool-generator.js';
import { createMockGraphQLServer } from './fixtures/mock-server.js';

describe('Integration Tests', () => {
  const mockServer = createMockGraphQLServer(4002);

  beforeAll(async () => {
    await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  describe('End-to-End Schema Processing', () => {
    it('should complete full workflow: introspect -> generate tools', async () => {
      // Step 1: Introspect the schema
      const introspectionResult = await introspectGraphQLSchema({
        endpoint: 'http://localhost:4002/graphql'
      });

      expect(introspectionResult).toBeDefined();
      expect(introspectionResult.__schema).toBeDefined();

      // Step 2: Generate MCP tools from the introspection result
      const tools = generateMCPToolsFromSchema(introspectionResult);

      expect(tools).toBeInstanceOf(Array);
      expect(tools.length).toBeGreaterThan(0);

      // Verify we have both query and mutation tools
      const queryTools = tools.filter(tool => tool.name.startsWith('query_'));
      const mutationTools = tools.filter(tool => tool.name.startsWith('mutation_'));

      expect(queryTools.length).toBeGreaterThan(0);
      expect(mutationTools.length).toBeGreaterThan(0);

      // Verify tools have correct structure
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type');
        expect(tool.inputSchema).toHaveProperty('properties');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(tool.inputSchema.type).toBe('object');
      });
    });

    it('should generate tools that match GraphQL schema structure', async () => {
      const introspectionResult = await introspectGraphQLSchema({
        endpoint: 'http://localhost:4002/graphql'
      });

      const tools = generateMCPToolsFromSchema(introspectionResult);

      // Find specific tools and verify their properties
      const userTool = tools.find(tool => tool.name === 'query_user');
      expect(userTool).toBeDefined();
      expect(userTool?.inputSchema.properties.id).toBeDefined();
      expect(userTool?.inputSchema.required).toContain('id');

      const createUserTool = tools.find(tool => tool.name === 'mutation_createUser');
      expect(createUserTool).toBeDefined();
      expect(createUserTool?.inputSchema.properties.input).toBeDefined();
      expect(createUserTool?.inputSchema.required).toContain('input');

      const usersTool = tools.find(tool => tool.name === 'query_users');
      expect(usersTool).toBeDefined();
      expect(usersTool?.inputSchema.properties.filters).toBeDefined();
      expect(usersTool?.inputSchema.properties.limit).toBeDefined();
      expect(usersTool?.inputSchema.properties.offset).toBeDefined();
    });

    it('should handle authentication headers in introspection', async () => {
      const headers = {
        'Authorization': 'Bearer test-token',
        'X-API-Key': 'test-api-key'
      };

      const introspectionResult = await introspectGraphQLSchema({
        endpoint: 'http://localhost:4002/graphql',
        headers
      });

      expect(introspectionResult).toBeDefined();
      expect(introspectionResult.__schema).toBeDefined();

      const tools = generateMCPToolsFromSchema(introspectionResult);
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe('Tool Schema Validation', () => {
    it('should generate valid JSON schemas for all tools', async () => {
      const introspectionResult = await introspectGraphQLSchema({
        endpoint: 'http://localhost:4002/graphql'
      });

      const tools = generateMCPToolsFromSchema(introspectionResult);

      tools.forEach(tool => {
        const schema = tool.inputSchema;
        
        // Validate basic JSON schema structure
        expect(schema.type).toBe('object');
        expect(typeof schema.properties).toBe('object');
        
        // Validate property types
        Object.values(schema.properties).forEach((property: Record<string, unknown>) => {
          expect(property).toHaveProperty('type');
          expect(typeof property.type).toBe('string');
          
          if (property.type === 'array') {
            expect(property).toHaveProperty('items');
            expect(property.items).toHaveProperty('type');
          }
          
          if (property.type === 'object') {
            expect(property).toHaveProperty('properties');
          }
          
          if (property.enum) {
            expect(property.enum).toBeInstanceOf(Array);
            expect(property.enum.length).toBeGreaterThan(0);
          }
        });
        
        // Validate required fields exist in properties
        if (schema.required) {
          schema.required.forEach((requiredField: string) => {
            expect(schema.properties).toHaveProperty(requiredField);
          });
        }
      });
    });

    it('should correctly map GraphQL types to JSON schema types', async () => {
      const introspectionResult = await introspectGraphQLSchema({
        endpoint: 'http://localhost:4002/graphql'
      });

      const tools = generateMCPToolsFromSchema(introspectionResult);

      // Test String -> string
      const userTool = tools.find(tool => tool.name === 'query_user');
      expect(userTool?.inputSchema.properties.id.type).toBe('string');

      // Test Int -> integer  
      const usersTool = tools.find(tool => tool.name === 'query_users');
      expect(usersTool?.inputSchema.properties.limit?.type).toBe('integer');
      expect(usersTool?.inputSchema.properties.offset?.type).toBe('integer');

      // Test Enum -> string with enum values
      const filtersProperty = usersTool?.inputSchema.properties.filters;
      if (filtersProperty?.properties?.role) {
        expect(filtersProperty.properties.role.type).toBe('string');
        expect(filtersProperty.properties.role.enum).toBeInstanceOf(Array);
        expect(filtersProperty.properties.role.enum).toContain('ADMIN');
      }

      // Test Array -> array with items
      const createPostTool = tools.find(tool => tool.name === 'mutation_createPost');
      expect(createPostTool?.inputSchema.properties.tags?.type).toBe('array');
      expect(createPostTool?.inputSchema.properties.tags?.items?.type).toBe('string');
    });
  });

  describe('Performance and Efficiency', () => {
    it('should complete introspection and tool generation within reasonable time', async () => {
      const startTime = Date.now();

      const introspectionResult = await introspectGraphQLSchema({
        endpoint: 'http://localhost:4002/graphql'
      });

      const introspectionTime = Date.now();

      const tools = generateMCPToolsFromSchema(introspectionResult);

      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const introspectionDuration = introspectionTime - startTime;
      const generationDuration = endTime - introspectionTime;

      // These are reasonable performance expectations
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds total
      expect(introspectionDuration).toBeLessThan(3000); // Less than 3 seconds for introspection
      expect(generationDuration).toBeLessThan(1000); // Less than 1 second for generation

      expect(tools.length).toBeGreaterThan(0);
    });

    it('should handle large schemas efficiently', async () => {
      // This test uses our mock schema which is reasonably complex
      const introspectionResult = await introspectGraphQLSchema({
        endpoint: 'http://localhost:4002/graphql'
      });

      const tools = generateMCPToolsFromSchema(introspectionResult);

      // Verify all expected tools are generated
      expect(tools.length).toBeGreaterThanOrEqual(11); // 5 queries + 6 mutations from our schema

      // Verify performance: should generate tools quickly even for complex schemas
      const startTime = Date.now();
      const toolsAgain = generateMCPToolsFromSchema(introspectionResult);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be very fast on second run
      expect(toolsAgain.length).toBe(tools.length);
    });
  });
});