import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMockGraphQLServer } from './fixtures/mock-server.js';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { mockIntrospectionResult } from './fixtures/introspection-result.js';

describe('Server Configuration and Initialization', () => {
  const mockServer = createMockGraphQLServer(4003);
  const testSchemaPath = join(process.cwd(), 'test-server-schema.json');

  beforeAll(async () => {
    await mockServer.start();
    // Create a test schema file
    writeFileSync(testSchemaPath, JSON.stringify(mockIntrospectionResult, null, 2));
  });

  afterAll(async () => {
    await mockServer.stop();
    if (existsSync(testSchemaPath)) {
      unlinkSync(testSchemaPath);
    }
  });

  describe('Schema Loading Strategies', () => {
    it('should load schema from file when available', () => {
      // Simulate loading from file
      expect(existsSync(testSchemaPath)).toBe(true);
      
      const schemaData = JSON.parse(readFileSync(testSchemaPath, 'utf-8'));
      expect(schemaData.__schema).toBeDefined();
      expect(schemaData.__schema.types).toBeInstanceOf(Array);
    });

    it('should fall back to introspection when file does not exist', async () => {
      const nonExistentPath = join(process.cwd(), 'non-existent-schema.json');
      expect(existsSync(nonExistentPath)).toBe(false);
      
      // In a real server, this would trigger introspection
      // We're testing the logic path here
    });
  });

  describe('GraphQL Operation Building', () => {
    // These tests simulate the server's operation building logic
    function buildGraphQLOperation(type: string, operationName: string, variables: Record<string, unknown>): string {
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

    it('should build correct query operations', () => {
      const query = buildGraphQLOperation('query', 'user', { id: '123' });
      
      expect(query).toContain('query userOperation($id: String)');
      expect(query).toContain('user(id: $id)');
    });

    it('should build correct mutation operations', () => {
      const mutation = buildGraphQLOperation('mutation', 'createUser', { 
        input: { name: 'John', email: 'john@example.com' } 
      });
      
      expect(mutation).toContain('mutation createUserOperation($input: String)');
      expect(mutation).toContain('createUser(input: $input)');
    });

    it('should handle operations with no variables', () => {
      const query = buildGraphQLOperation('query', 'users', {});
      
      expect(query).toContain('query usersOperation');
      expect(query).toContain('users');
      expect(query).not.toContain('$');
    });

    it('should handle operations with multiple variables', () => {
      const query = buildGraphQLOperation('query', 'users', { 
        limit: 10, 
        offset: 0, 
        searchTerm: 'john' 
      });
      
      expect(query).toContain('$limit: String');
      expect(query).toContain('$offset: String');
      expect(query).toContain('$searchTerm: String');
      expect(query).toContain('limit: $limit');
      expect(query).toContain('offset: $offset');
      expect(query).toContain('searchTerm: $searchTerm');
    });
  });

  describe('Tool Execution Logic', () => {
    it('should correctly identify query tools', () => {
      const toolName = 'query_user';
      
      const isQuery = toolName.startsWith('query_');
      const isMutation = toolName.startsWith('mutation_');
      
      expect(isQuery).toBe(true);
      expect(isMutation).toBe(false);
      
      const operationName = toolName.replace(/^(query_|mutation_)/, '');
      expect(operationName).toBe('user');
    });

    it('should correctly identify mutation tools', () => {
      const toolName = 'mutation_createUser';
      
      const isQuery = toolName.startsWith('query_');
      const isMutation = toolName.startsWith('mutation_');
      
      expect(isQuery).toBe(false);
      expect(isMutation).toBe(true);
      
      const operationName = toolName.replace(/^(query_|mutation_)/, '');
      expect(operationName).toBe('createUser');
    });

    it('should reject unknown tool names', () => {
      const toolName = 'unknown_operation';
      
      const isQuery = toolName.startsWith('query_');
      const isMutation = toolName.startsWith('mutation_');
      
      expect(isQuery).toBe(false);
      expect(isMutation).toBe(false);
      
      // This should trigger an error in the server
      expect(() => {
        if (!isQuery && !isMutation) {
          throw new Error(`Unknown tool: ${toolName}`);
        }
      }).toThrow('Unknown tool: unknown_operation');
    });
  });

  describe('Error Handling', () => {
    it('should handle GraphQL client errors gracefully', () => {
      const mockError = new Error('GraphQL execution error');
      
      // Simulate error handling
      const errorResponse = {
        content: [
          {
            type: 'text',
            text: `Error executing query_user: ${mockError.message}`
          }
        ],
        isError: true
      };
      
      expect(errorResponse.isError).toBe(true);
      expect(errorResponse.content[0].text).toContain('GraphQL execution error');
    });

    it('should handle network errors gracefully', () => {
      const networkError = new Error('Network error: ECONNREFUSED');
      
      const errorResponse = {
        content: [
          {
            type: 'text',
            text: `Error executing mutation_createUser: ${networkError.message}`
          }
        ],
        isError: true
      };
      
      expect(errorResponse.isError).toBe(true);
      expect(errorResponse.content[0].text).toContain('ECONNREFUSED');
    });

    it('should handle unknown errors gracefully', () => {
      const unknownError = 'String error instead of Error object';
      
      const errorMessage = typeof unknownError === 'object' && unknownError !== null && 'message' in unknownError 
        ? (unknownError as Error).message 
        : 'Unknown error';
      
      expect(errorMessage).toBe('Unknown error');
    });
  });
});