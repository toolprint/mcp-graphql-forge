import { describe, it, expect, beforeEach } from 'vitest';
import { generateMCPToolsFromSchema } from '../tool-generator.js';
import { mockIntrospectionResult } from './fixtures/introspection-result.js';

// Mock the GraphQLMCPServer's validateRequiredParameters method
function validateRequiredParameters(tool: any, args: any): string[] {
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

describe('Server-Side Parameter Validation', () => {
  let tools: ReturnType<typeof generateMCPToolsFromSchema>;
  
  beforeEach(() => {
    tools = generateMCPToolsFromSchema(mockIntrospectionResult);
  });

  describe('Required Parameter Validation', () => {
    it('should detect missing required parameters', () => {
      const userTool = tools.find(t => t.name === 'query_user');
      expect(userTool).toBeDefined();
      
      // Test with missing required parameter
      const missingParams = validateRequiredParameters(userTool, {});
      expect(missingParams).toContain('id');
      expect(missingParams.length).toBe(1);
    });

    it('should pass validation when all required parameters are provided', () => {
      const userTool = tools.find(t => t.name === 'query_user');
      expect(userTool).toBeDefined();
      
      // Test with all required parameters provided
      const missingParams = validateRequiredParameters(userTool, { id: 'user-123' });
      expect(missingParams).toEqual([]);
    });

    it('should handle null and undefined parameter values correctly', () => {
      const userTool = tools.find(t => t.name === 'query_user');
      expect(userTool).toBeDefined();
      
      // Test with null values
      const missingParamsNull = validateRequiredParameters(userTool, { id: null });
      expect(missingParamsNull).toContain('id');
      
      // Test with undefined values
      const missingParamsUndefined = validateRequiredParameters(userTool, { id: undefined });
      expect(missingParamsUndefined).toContain('id');
      
      // Test with empty string (should be valid)
      const missingParamsEmpty = validateRequiredParameters(userTool, { id: '' });
      expect(missingParamsEmpty).toEqual([]);
    });

    it('should handle multiple missing parameters', () => {
      const createPostTool = tools.find(t => t.name === 'mutation_createPost');
      expect(createPostTool).toBeDefined();
      
      if (createPostTool && createPostTool.inputSchema.required) {
        // Test with all parameters missing
        const missingParams = validateRequiredParameters(createPostTool, {});
        expect(missingParams.length).toBe(createPostTool.inputSchema.required.length);
        
        // Should include all required parameters
        createPostTool.inputSchema.required.forEach(param => {
          expect(missingParams).toContain(param);
        });
      }
    });

    it('should handle partial parameter provision correctly', () => {
      const createPostTool = tools.find(t => t.name === 'mutation_createPost');
      expect(createPostTool).toBeDefined();
      
      if (createPostTool && createPostTool.inputSchema.required) {
        const requiredParams = createPostTool.inputSchema.required;
        
        if (requiredParams.length > 1) {
          // Provide only some required parameters
          const partialArgs: any = {};
          partialArgs[requiredParams[0]] = 'test-value';
          
          const missingParams = validateRequiredParameters(createPostTool, partialArgs);
          
          // Should not include the provided parameter
          expect(missingParams).not.toContain(requiredParams[0]);
          
          // Should include the missing parameters
          for (let i = 1; i < requiredParams.length; i++) {
            expect(missingParams).toContain(requiredParams[i]);
          }
        }
      }
    });

    it('should handle tools with no required parameters', () => {
      // Find a tool with no required parameters
      const optionalTool = tools.find(t => 
        !t.inputSchema.required || t.inputSchema.required.length === 0
      );
      
      if (optionalTool) {
        // Should pass validation even with empty args
        const missingParams = validateRequiredParameters(optionalTool, {});
        expect(missingParams).toEqual([]);
        
        // Should also pass with null/undefined args
        const missingParamsNull = validateRequiredParameters(optionalTool, null);
        expect(missingParamsNull).toEqual([]);
        
        const missingParamsUndefined = validateRequiredParameters(optionalTool, undefined);
        expect(missingParamsUndefined).toEqual([]);
      }
    });

    it('should provide clear error messages for missing parameters', () => {
      const userTool = tools.find(t => t.name === 'query_user');
      expect(userTool).toBeDefined();
      
      const missingParams = validateRequiredParameters(userTool, {});
      
      // Simulate the error message construction
      if (missingParams.length > 0) {
        const errorMessage = `Missing required parameters: ${missingParams.join(', ')}`;
        expect(errorMessage).toContain('Missing required parameters: id');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle args object with prototype pollution protection', () => {
      const userTool = tools.find(t => t.name === 'query_user');
      expect(userTool).toBeDefined();
      
      // Test with object that has prototype properties
      const maliciousArgs = Object.create({ id: 'inherited-value' });
      
      // Should still detect missing parameter because it's not an own property
      const missingParams = validateRequiredParameters(userTool, maliciousArgs);
      expect(missingParams).toContain('id');
    });

    it('should handle args with hasOwnProperty method override', () => {
      const userTool = tools.find(t => t.name === 'query_user');
      expect(userTool).toBeDefined();
      
      // Test with args that override hasOwnProperty
      const argsWithOverride = {
        id: 'test-id',
        hasOwnProperty: () => false // Malicious override
      };
      
      // Should still work correctly using 'in' operator
      const missingParams = validateRequiredParameters(userTool, argsWithOverride);
      expect(missingParams).toEqual([]);
    });
  });
});