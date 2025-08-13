import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GraphQLClient, gql } from 'graphql-request';
import { createMockGraphQLService } from './fixtures/mock-graphql-service.js';

describe('Mock GraphQL Service', () => {
  const service = createMockGraphQLService(4101);
  let client: GraphQLClient;

  beforeAll(async () => {
    await service.start();
    client = new GraphQLClient(service.url);
  });

  afterAll(async () => {
    await service.stop();
  });

  it('allows querying a user', async () => {
    const query = gql`query($id: ID!) { user(id: $id) { id name email } }`;
    const data = await client.request(query, { id: '1' });
    expect(data.user.name).toBe('Alice');
  });

  it('supports creating and retrieving users', async () => {
    const create = gql`mutation($input: CreateUserInput!) { createUser(input: $input) { id name email } }`;
    const created = await client.request(create, {
      input: { name: 'Bob', email: 'bob@example.com', role: 'USER' }
    });
    expect(created.createUser.name).toBe('Bob');

    const fetch = gql`query($id: ID!) { user(id: $id) { id name email } }`;
    const fetched = await client.request(fetch, { id: created.createUser.id });
    expect(fetched.user.name).toBe('Bob');
  });
});
