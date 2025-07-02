import { describe, it, expect } from 'vitest';
import { generateMCPToolsFromSchema } from '../tool-generator.js';
import { mockIntrospectionResult } from './fixtures/introspection-result.js';

describe('MCP Tool Generator', () => {
  describe('generateMCPToolsFromSchema', () => {
    it('should generate tools from introspection result', () => {
      const tools = generateMCPToolsFromSchema(mockIntrospectionResult);
      
      expect(tools).toBeInstanceOf(Array);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should generate query tools with correct naming', () => {
      const tools = generateMCPToolsFromSchema(mockIntrospectionResult);
      
      const queryTools = tools.filter(tool => tool.name.startsWith('query_'));
      expect(queryTools.length).toBeGreaterThan(0);
      
      const toolNames = queryTools.map(tool => tool.name);
      expect(toolNames).toContain('query_user');
      expect(toolNames).toContain('query_users');
      expect(toolNames).toContain('query_userCount');
      expect(toolNames).toContain('query_post');
      expect(toolNames).toContain('query_posts');
    });

    it('should generate mutation tools with correct naming', () => {
      const tools = generateMCPToolsFromSchema(mockIntrospectionResult);
      
      const mutationTools = tools.filter(tool => tool.name.startsWith('mutation_'));
      expect(mutationTools.length).toBeGreaterThan(0);
      
      const toolNames = mutationTools.map(tool => tool.name);
      expect(toolNames).toContain('mutation_createUser');
      expect(toolNames).toContain('mutation_updateUser');
      expect(toolNames).toContain('mutation_deleteUser');
      expect(toolNames).toContain('mutation_createPost');
      expect(toolNames).toContain('mutation_publishPost');
      expect(toolNames).toContain('mutation_deletePost');
    });

    it('should include proper descriptions for tools', () => {
      const tools = generateMCPToolsFromSchema(mockIntrospectionResult);
      
      const userTool = tools.find(tool => tool.name === 'query_user');
      expect(userTool).toBeDefined();
      expect(userTool?.description).toMatch(/user/i);
      
      const createUserTool = tools.find(tool => tool.name === 'mutation_createUser');
      expect(createUserTool).toBeDefined();
      expect(createUserTool?.description).toMatch(/create.*user/i);
    });
  });

  describe('Input Schema Generation', () => {
    it('should generate correct input schema for required arguments', () => {
      const tools = generateMCPToolsFromSchema(mockIntrospectionResult);
      
      const userTool = tools.find(tool => tool.name === 'query_user');
      expect(userTool).toBeDefined();
      expect(userTool?.inputSchema.type).toBe('object');
      expect(userTool?.inputSchema.properties.id).toBeDefined();
      expect(userTool?.inputSchema.properties.id.type).toBe('string');
      expect(userTool?.inputSchema.required).toContain('id');
    });

    it('should generate correct input schema for optional arguments', () => {
      const tools = generateMCPToolsFromSchema(mockIntrospectionResult);
      
      const usersTool = tools.find(tool => tool.name === 'query_users');
      expect(usersTool).toBeDefined();
      expect(usersTool?.inputSchema.properties.limit).toBeDefined();
      expect(usersTool?.inputSchema.properties.limit.type).toBe('integer');
      expect(usersTool?.inputSchema.properties.offset).toBeDefined();
      expect(usersTool?.inputSchema.properties.offset.type).toBe('integer');
      
      // These should not be required since they have default values
      expect(usersTool?.inputSchema.required || []).not.toContain('limit');
      expect(usersTool?.inputSchema.required || []).not.toContain('offset');
    });

    it('should handle complex input objects', () => {
      const tools = generateMCPToolsFromSchema(mockIntrospectionResult);
      
      const createUserTool = tools.find(tool => tool.name === 'mutation_createUser');
      expect(createUserTool).toBeDefined();
      expect(createUserTool?.inputSchema.properties.input).toBeDefined();
      expect(createUserTool?.inputSchema.properties.input.type).toBe('object');
      expect(createUserTool?.inputSchema.required).toContain('input');
      
      // Check nested input object properties
      const inputProps = createUserTool?.inputSchema.properties.input.properties;
      expect(inputProps?.name).toBeDefined();
      expect(inputProps?.name.type).toBe('string');
      expect(inputProps?.email).toBeDefined();
      expect(inputProps?.email.type).toBe('string');
      expect(inputProps?.role).toBeDefined();
      expect(inputProps?.role.type).toBe('string');
      expect(inputProps?.role.enum).toContain('ADMIN');
      expect(inputProps?.role.enum).toContain('USER');
      expect(inputProps?.role.enum).toContain('MODERATOR');
    });

    it('should handle array types correctly', () => {
      const tools = generateMCPToolsFromSchema(mockIntrospectionResult);
      
      const createPostTool = tools.find(tool => tool.name === 'mutation_createPost');
      expect(createPostTool).toBeDefined();
      expect(createPostTool?.inputSchema.properties.tags).toBeDefined();
      expect(createPostTool?.inputSchema.properties.tags.type).toBe('array');
      expect(createPostTool?.inputSchema.properties.tags.items).toBeDefined();
      expect(createPostTool?.inputSchema.properties.tags.items.type).toBe('string');
    });

    it('should handle enum types correctly', () => {
      const tools = generateMCPToolsFromSchema(mockIntrospectionResult);
      
      const usersTool = tools.find(tool => tool.name === 'query_users');
      expect(usersTool).toBeDefined();
      
      const filtersInput = usersTool?.inputSchema.properties.filters;
      expect(filtersInput).toBeDefined();
      expect(filtersInput.type).toBe('object');
      
      const roleProperty = filtersInput.properties?.role;
      expect(roleProperty).toBeDefined();
      expect(roleProperty.type).toBe('string');
      expect(roleProperty.enum).toBeInstanceOf(Array);
      expect(roleProperty.enum).toContain('ADMIN');
      expect(roleProperty.enum).toContain('USER');
      expect(roleProperty.enum).toContain('MODERATOR');
    });

    it('should handle scalar types correctly', () => {
      const tools = generateMCPToolsFromSchema(mockIntrospectionResult);
      
      const usersTool = tools.find(tool => tool.name === 'query_users');
      expect(usersTool).toBeDefined();
      
      const filtersInput = usersTool?.inputSchema.properties.filters;
      const filtersProps = filtersInput?.properties;
      
      expect(filtersProps?.minAge?.type).toBe('integer');
      expect(filtersProps?.maxAge?.type).toBe('integer');
      expect(filtersProps?.searchTerm?.type).toBe('string');
    });

    it('should handle tools with no arguments', () => {
      const tools = generateMCPToolsFromSchema(mockIntrospectionResult);
      
      // Find a tool that might have no arguments (if any exist)
      const allTools = tools.filter(tool => 
        Object.keys(tool.inputSchema.properties).length === 0
      );
      
      allTools.forEach(tool => {
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toEqual({});
        expect(tool.inputSchema.required || []).toHaveLength(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle fields with descriptions', () => {
      const tools = generateMCPToolsFromSchema(mockIntrospectionResult);
      
      const userTool = tools.find(tool => tool.name === 'query_user');
      expect(userTool).toBeDefined();
      expect(typeof userTool?.description).toBe('string');
      expect(userTool?.description.length).toBeGreaterThan(0);
    });

    it('should generate unique tool names', () => {
      const tools = generateMCPToolsFromSchema(mockIntrospectionResult);
      
      const toolNames = tools.map(tool => tool.name);
      const uniqueNames = new Set(toolNames);
      
      expect(toolNames.length).toBe(uniqueNames.size);
    });

    it('should handle nested input object requirements correctly', () => {
      const tools = generateMCPToolsFromSchema(mockIntrospectionResult);
      
      const createUserTool = tools.find(tool => tool.name === 'mutation_createUser');
      const inputSchema = createUserTool?.inputSchema.properties.input;
      
      expect(inputSchema?.required).toContain('name');
      expect(inputSchema?.required).toContain('email');
      expect(inputSchema?.required).not.toContain('age'); // optional field
      expect(inputSchema?.required).not.toContain('role'); // has default value
    });
  });
});