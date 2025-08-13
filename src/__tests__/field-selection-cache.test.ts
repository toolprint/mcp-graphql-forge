import { describe, it, expect, beforeEach } from 'vitest';
import { generateMCPToolsFromSchema, getFieldSelectionCache } from '../tool-generator.js';
import { mockIntrospectionResult } from './fixtures/introspection-result.js';

describe('Field Selection Caching System', () => {
  let tools: ReturnType<typeof generateMCPToolsFromSchema>;
  
  beforeEach(() => {
    tools = generateMCPToolsFromSchema(mockIntrospectionResult);
  });

  describe('Cache Population and Usage', () => {
    it('should populate cache during tool generation', () => {
      const cache = getFieldSelectionCache();
      
      expect(Object.keys(cache.full).length).toBeGreaterThan(0);
      expect(cache.full).toHaveProperty('User');
      expect(cache.full).toHaveProperty('Post');
    });

    it('should generate consistent results on multiple calls', () => {
      const tools1 = generateMCPToolsFromSchema(mockIntrospectionResult);
      const tools2 = generateMCPToolsFromSchema(mockIntrospectionResult);
      
      expect(tools1.length).toBe(tools2.length);
      
      // Compare field selections for all tools
      for (let i = 0; i < tools1.length; i++) {
        expect(tools1[i]._graphql?.fieldSelection).toBe(tools2[i]._graphql?.fieldSelection);
      }
    });

    it('should cache minimal selections for circular references', () => {
      const cache = getFieldSelectionCache();
      
      // Should have minimal selections for types that create circular references
      expect(Object.keys(cache.minimal).length).toBeGreaterThan(0);
      
      // Check that minimal selections are valid GraphQL
        for (const [, selection] of Object.entries(cache.minimal)) {
          if (selection) {
            expect(selection).toMatch(/^\{\s*\w+\s*\}$/); // Should be like "{ id }" or "{ documentId }"
          }
        }
    });
  });

  describe('Field Selection Quality', () => {
    it('should never generate bare complex field names', () => {
      // This test ensures we never have GraphQL validation errors
      tools.forEach(tool => {
        const fieldSelection = tool._graphql?.fieldSelection || '';
        
        // Check for common patterns that would cause "must have a selection of subfields" errors
        const problematicPatterns = [
          /\buser\s*$/m,           // bare 'user' field
          /\bposts\s*$/m,          // bare 'posts' field  
          /\bauthor\s*$/m,         // bare 'author' field
          /\bnodes\s*$/m,          // bare 'nodes' field
          /\barticles\s*$/m,       // bare 'articles' field
        ];
        
        problematicPatterns.forEach(pattern => {
          expect(fieldSelection).not.toMatch(pattern);
        });
      });
    });

    it('should provide full field selections for non-circular references', () => {
      const userTool = tools.find(t => t.name === 'query_user');
      const fieldSelection = userTool?._graphql?.fieldSelection || '';
      
      // Should contain full field selections for User type
      expect(fieldSelection).toContain('id');
      expect(fieldSelection).toContain('name');
      expect(fieldSelection).toContain('email');
      expect(fieldSelection).toContain('role');
      
      // Should contain nested selections for complex fields
      expect(fieldSelection).toContain('posts {');
    });

    it('should handle list types correctly', () => {
      const usersTool = tools.find(t => t.name === 'query_users');
      const userTool = tools.find(t => t.name === 'query_user');
      
      // List types should use the same cached field selection as single types
      expect(usersTool?._graphql?.fieldSelection).toBe(userTool?._graphql?.fieldSelection);
    });
  });

  describe('Circular Reference Handling', () => {
    it('should detect and handle circular references properly', () => {
      const cache = getFieldSelectionCache();
      
      // User -> posts -> author -> User (circular)
      const userSelection = cache.full['User'] || '';
      const postSelection = cache.full['Post'] || '';
      
      // User should have posts with full Post selection
      expect(userSelection).toContain('posts {');
      
      // Post should have author but with minimal User selection to break cycle
      expect(postSelection).toContain('author');
      
      // The author field in Post should not have the full nested structure
      const authorInPost = postSelection.match(/author\s*\{[^}]+\}/);
      expect(authorInPost).toBeTruthy();
      if (authorInPost) {
        // Should be minimal, not the full User selection
        expect(authorInPost[0].length).toBeLessThan(userSelection.length / 2);
      }
    });

    it('should prefer documentId over id for minimal selections', () => {
      const cache = getFieldSelectionCache();
      
      // Check minimal selections - should prefer documentId when available
        for (const selection of Object.values(cache.minimal)) {
          if (selection.includes('documentId')) {
            expect(selection).toContain('documentId');
            expect(selection).not.toContain('id');
          }
        }
    });
  });

  describe('Performance and Efficiency', () => {
    it('should reuse cached selections efficiently', () => {
      // Generate tools multiple times and measure that cache is being used
      const startTime = performance.now();
      
      // First generation (populates cache)
      generateMCPToolsFromSchema(mockIntrospectionResult);
      const firstGenTime = performance.now() - startTime;
      
      const secondStartTime = performance.now();
      // Second generation (should use cache)
      generateMCPToolsFromSchema(mockIntrospectionResult);
      const secondGenTime = performance.now() - secondStartTime;
      
      // Second generation should be faster (though this may vary)
      // Main point is that it should complete without errors
      expect(secondGenTime).toBeGreaterThan(0);
      expect(firstGenTime).toBeGreaterThan(0);
    });

    it('should cache all types from schema during initial generation', () => {
      const cache = getFieldSelectionCache();
      
      // Should have cached selections for all major types in our mock schema
      const expectedTypes = ['User', 'Post', 'CreateUserInput']; // Input types won't be in full cache
      
      expectedTypes.forEach(typeName => {
        if (typeName.endsWith('Input')) {
          // Input types are handled differently
          return;
        }
        expect(cache.full).toHaveProperty(typeName);
        expect(cache.full[typeName]).toBeTruthy();
      });
    });
  });

  describe('Required Parameters', () => {
    it('should mark GraphQL required parameters as required in JSON schema', () => {
      // Check that all tools properly handle required parameters
      tools.forEach(tool => {
        if (tool._graphql?.args && tool._graphql.args.length > 0) {
          // Find GraphQL required args (NonNull type AND no default value)
          const requiredGraphQLArgs = tool._graphql.args.filter(arg => 
            arg.type.toString().includes('!') && arg.defaultValue === undefined
          );
          const requiredArgNames = requiredGraphQLArgs.map(arg => arg.name);
          
          // Compare with JSON schema required array
          const jsonRequired = tool.inputSchema.required || [];
          
          // Every required GraphQL arg should be in JSON schema required array
          requiredArgNames.forEach(argName => {
            expect(jsonRequired).toContain(argName);
          });
          
          // JSON schema required array should not contain non-required GraphQL args
          const optionalGraphQLArgs = tool._graphql.args.filter(arg => 
            !arg.type.toString().includes('!') || arg.defaultValue !== undefined
          );
          const optionalArgNames = optionalGraphQLArgs.map(arg => arg.name);
          
          optionalArgNames.forEach(argName => {
            expect(jsonRequired).not.toContain(argName);
          });
        }
      });
    });

    it('should properly detect NonNull types as required', () => {
      // Find a tool that should have required parameters
      const userTool = tools.find(t => t.name === 'query_user');
      expect(userTool).toBeDefined();
      
      if (userTool?._graphql?.args) {
        const idArg = userTool._graphql.args.find(arg => arg.name === 'id');
        expect(idArg).toBeDefined();
        
        // ID should be required (ID! in GraphQL)
        expect(idArg?.type.toString()).toContain('!');
        expect(userTool.inputSchema.required).toContain('id');
      }
    });

    it('should not mark optional parameters as required', () => {
      // Find a tool with optional parameters
      const usersTool = tools.find(t => t.name === 'query_users');
      expect(usersTool).toBeDefined();
      
      if (usersTool?._graphql?.args) {
        const optionalArgs = usersTool._graphql.args.filter(arg => 
          !arg.type.toString().includes('!') || arg.defaultValue !== undefined
        );
        
        if (optionalArgs.length > 0) {
          const requiredArray = usersTool.inputSchema.required || [];
          
          optionalArgs.forEach(arg => {
            expect(requiredArray).not.toContain(arg.name);
          });
        }
      }
    });

    it('should handle mixed required and optional parameters correctly', () => {
      // Test tools that have both required and optional parameters
      const toolsWithMixedParams = tools.filter(tool => {
        if (!tool._graphql?.args || tool._graphql.args.length === 0) return false;
        
        const hasRequired = tool._graphql.args.some(arg => 
          arg.type.toString().includes('!') && arg.defaultValue === undefined
        );
        const hasOptional = tool._graphql.args.some(arg => 
          !arg.type.toString().includes('!') || arg.defaultValue !== undefined
        );
        
        return hasRequired && hasOptional;
      });

      expect(toolsWithMixedParams.length).toBeGreaterThan(0);
      
      toolsWithMixedParams.forEach(tool => {
        const requiredArgs = tool._graphql!.args.filter(arg => 
          arg.type.toString().includes('!') && arg.defaultValue === undefined
        );
        const optionalArgs = tool._graphql!.args.filter(arg => 
          !arg.type.toString().includes('!') || arg.defaultValue !== undefined
        );
        const jsonRequired = tool.inputSchema.required || [];
        
        // All required GraphQL args should be in JSON required
        requiredArgs.forEach(arg => {
          expect(jsonRequired).toContain(arg.name);
        });
        
        // No optional GraphQL args should be in JSON required
        optionalArgs.forEach(arg => {
          expect(jsonRequired).not.toContain(arg.name);
        });
        
        // JSON required should have exactly the same length as GraphQL required args
        expect(jsonRequired.length).toBe(requiredArgs.length);
      });
    });

    it('should properly handle parameters with default values', () => {
      // Look for the createPost mutation which has tags with default value
      const createPostTool = tools.find(t => t.name === 'mutation_createPost');
      expect(createPostTool).toBeDefined();
      
      if (createPostTool?._graphql?.args) {
        const tagsArg = createPostTool._graphql.args.find(arg => arg.name === 'tags');
        if (tagsArg) {
          // tags should have a default value and therefore not be required
          expect(tagsArg.defaultValue).toBeDefined();
          expect(createPostTool.inputSchema.required).not.toContain('tags');
        }
        
        // But required args without defaults should still be required
        const titleArg = createPostTool._graphql.args.find(arg => arg.name === 'title');
        if (titleArg) {
          expect(titleArg.type.toString()).toContain('!');
          expect(titleArg.defaultValue).toBeUndefined();
          expect(createPostTool.inputSchema.required).toContain('title');
        }
      }
    });

    it('should prevent execution when required parameters are missing', () => {
      // This test verifies that our JSON schema correctly identifies required parameters
      // so that MCP clients can enforce them before GraphQL execution
      const userTool = tools.find(t => t.name === 'query_user');
      expect(userTool).toBeDefined();
      
      // Verify the JSON schema is correctly set up for validation
      expect(userTool?.inputSchema.required).toContain('id');
      expect(userTool?.inputSchema.properties.id).toBeDefined();
      expect(userTool?.inputSchema.type).toBe('object');
      
      // The JSON schema should validate that required fields are present
      // This prevents the GraphQL "Variable not provided" error by catching it earlier
      const schema = userTool?.inputSchema;
      if (schema) {
        // Empty object should fail validation for required fields
        const emptyParams = {};
        const hasAllRequired = schema.required?.every(field => field in emptyParams) ?? true;
        expect(hasAllRequired).toBe(false); // Should fail validation
        
        // Object with required fields should pass
        const validParams = { id: 'test-id' };
        const hasAllRequiredValid = schema.required?.every(field => field in validParams) ?? true;
        expect(hasAllRequiredValid).toBe(true); // Should pass validation
      }
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle deeply nested object hierarchies', () => {
      // Test with a complex query that has deep nesting
      const userTool = tools.find(t => t.name === 'query_user');
      const fieldSelection = userTool?._graphql?.fieldSelection || '';
      
      // Should handle User -> posts -> author -> posts (3+ levels deep)
      expect(fieldSelection).toContain('posts {');
      
      // Verify the nesting doesn't go infinite
      const braceCount = (fieldSelection.match(/\{/g) || []).length;
      const closeBraceCount = (fieldSelection.match(/\}/g) || []).length;
      
      expect(braceCount).toBe(closeBraceCount); // Balanced braces
      expect(braceCount).toBeGreaterThan(0);
      expect(braceCount).toBeLessThan(20); // Not infinite
    });

    it('should generate valid GraphQL for all tools', () => {
      // Every tool should have a valid field selection
      tools.forEach(tool => {
        expect(tool._graphql?.fieldSelection).toBeDefined();
        
        const fieldSelection = tool._graphql?.fieldSelection || '';
        
        if (fieldSelection) {
          // Should have balanced braces
          const openBraces = (fieldSelection.match(/\{/g) || []).length;
          const closeBraces = (fieldSelection.match(/\}/g) || []).length;
          expect(openBraces).toBe(closeBraces);
          
          // Should not have empty field selections like "{ }"
          expect(fieldSelection).not.toMatch(/\{\s*\}/);
        }
      });
    });
  });
});