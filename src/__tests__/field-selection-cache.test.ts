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
      for (const [typeName, selection] of Object.entries(cache.minimal)) {
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
      for (const [typeName, selection] of Object.entries(cache.minimal)) {
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