import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { introspectGraphQLSchema } from '../introspect.js';
import { createMockGraphQLServer } from './fixtures/mock-server.js';
import { unlinkSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { IntrospectionObjectType, IntrospectionField } from 'graphql';

describe('GraphQL Schema Introspection', () => {
  const mockServer = createMockGraphQLServer(4001);
  const testOutputPath = join(process.cwd(), 'test-schema.json');

  beforeAll(async () => {
    await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
    if (existsSync(testOutputPath)) {
      unlinkSync(testOutputPath);
    }
  });

  describe('introspectGraphQLSchema', () => {
    it('should successfully introspect a GraphQL schema', async () => {
      const result = await introspectGraphQLSchema({
        endpoint: 'http://localhost:4001/graphql'
      });

      expect(result).toBeDefined();
      expect(result.__schema).toBeDefined();
      expect(result.__schema.types).toBeInstanceOf(Array);
      expect(result.__schema.queryType).toBeDefined();
      expect(result.__schema.mutationType).toBeDefined();
    });

    it('should save introspection result to file when outputPath is provided', async () => {
      await introspectGraphQLSchema({
        endpoint: 'http://localhost:4001/graphql',
        outputPath: testOutputPath
      });

      expect(existsSync(testOutputPath)).toBe(true);
      
      const savedData = JSON.parse(readFileSync(testOutputPath, 'utf-8'));
      expect(savedData.__schema).toBeDefined();
    });

    it('should include custom headers in the request', async () => {
      const customHeaders = {
        'Authorization': 'Bearer test-token',
        'X-Custom-Header': 'test-value'
      };

      const result = await introspectGraphQLSchema({
        endpoint: 'http://localhost:4001/graphql',
        headers: customHeaders
      });

      expect(result).toBeDefined();
      expect(result.__schema).toBeDefined();
    });

    it('should throw error for invalid endpoint', async () => {
      await expect(
        introspectGraphQLSchema({
          endpoint: 'http://localhost:9999/invalid'
        })
      ).rejects.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      await expect(
        introspectGraphQLSchema({
          endpoint: 'http://non-existent-server.local/graphql'
        })
      ).rejects.toThrow();
    }, 10000);
  });

  describe('Schema Structure Validation', () => {
    it('should return introspection with expected query type fields', async () => {
      const result = await introspectGraphQLSchema({
        endpoint: 'http://localhost:4001/graphql'
      });

      const queryType = result.__schema.types.find(
        type => type.name === result.__schema.queryType?.name
      ) as IntrospectionObjectType;

      expect(queryType).toBeDefined();
      expect(queryType?.fields).toBeInstanceOf(Array);
      
      const fieldNames = queryType?.fields?.map((field: IntrospectionField) => field.name) || [];
      expect(fieldNames).toContain('user');
      expect(fieldNames).toContain('users');
      expect(fieldNames).toContain('userCount');
      expect(fieldNames).toContain('post');
      expect(fieldNames).toContain('posts');
    });

    it('should return introspection with expected mutation type fields', async () => {
      const result = await introspectGraphQLSchema({
        endpoint: 'http://localhost:4001/graphql'
      });

      const mutationType = result.__schema.types.find(
        type => type.name === result.__schema.mutationType?.name
      ) as IntrospectionObjectType;

      expect(mutationType).toBeDefined();
      expect(mutationType?.fields).toBeInstanceOf(Array);
      
      const fieldNames = mutationType?.fields?.map((field: IntrospectionField) => field.name) || [];
      expect(fieldNames).toContain('createUser');
      expect(fieldNames).toContain('updateUser');
      expect(fieldNames).toContain('deleteUser');
      expect(fieldNames).toContain('createPost');
      expect(fieldNames).toContain('publishPost');
      expect(fieldNames).toContain('deletePost');
    });

    it('should include custom scalar types', async () => {
      const result = await introspectGraphQLSchema({
        endpoint: 'http://localhost:4001/graphql'
      });

      const scalarTypes = result.__schema.types.filter(type => type.kind === 'SCALAR');
      const scalarNames = scalarTypes.map(type => type.name);
      
      expect(scalarNames).toContain('Date');
    });

    it('should include enum types', async () => {
      const result = await introspectGraphQLSchema({
        endpoint: 'http://localhost:4001/graphql'
      });

      const enumTypes = result.__schema.types.filter(type => type.kind === 'ENUM');
      const enumNames = enumTypes.map(type => type.name);
      
      expect(enumNames).toContain('UserRole');
      
      const userRoleEnum = enumTypes.find(type => type.name === 'UserRole');
      expect(userRoleEnum?.enumValues).toBeInstanceOf(Array);
      
      const enumValues = userRoleEnum?.enumValues?.map(val => val.name) || [];
      expect(enumValues).toContain('ADMIN');
      expect(enumValues).toContain('USER');
      expect(enumValues).toContain('MODERATOR');
    });

    it('should include input types', async () => {
      const result = await introspectGraphQLSchema({
        endpoint: 'http://localhost:4001/graphql'
      });

      const inputTypes = result.__schema.types.filter(type => type.kind === 'INPUT_OBJECT');
      const inputNames = inputTypes.map(type => type.name);
      
      expect(inputNames).toContain('CreateUserInput');
      expect(inputNames).toContain('UpdateUserInput');
      expect(inputNames).toContain('UserFilters');
    });
  });
});