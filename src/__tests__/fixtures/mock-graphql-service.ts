import express from 'express';
import { Server as HTTPServer } from 'http';
import { graphql } from 'graphql';
import { testSchema } from './schema.js';

export function createMockGraphQLService(port: number = 4100) {
  const users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    age?: number;
    createdAt: string;
    posts: any[];
  }> = [
    {
      id: '1',
      name: 'Alice',
      email: 'alice@example.com',
      role: 'ADMIN',
      age: 30,
      createdAt: new Date().toISOString(),
      posts: []
    },
    {
      id: '2',
      name: 'Bob',
      email: 'bob@example.com',
      role: 'USER',
      age: 25,
      createdAt: new Date().toISOString(),
      posts: []
    }
  ];

  const rootValue = {
    hello: () => 'Hello world!',
    user: ({ id }: { id: string }) => users.find(u => u.id === id) || null,
    users: ({ limit = users.length, offset = 0 }: { limit?: number; offset?: number }) =>
      users.slice(offset, offset + limit),
    createUser: ({ input }: { input: any }) => {
      const user = {
        id: String(users.length + 1),
        ...input,
        createdAt: new Date().toISOString(),
        posts: []
      };
      users.push(user);
      return user;
    }
  };

  const app = express();
  app.use(express.json());
  app.post('/graphql', async (req, res) => {
    const { query, variables } = req.body;
    const result = await graphql({
      schema: testSchema,
      source: query,
      variableValues: variables,
      rootValue
    });
    res.json(result);
  });

  let server: HTTPServer;

  return {
    url: `http://localhost:${port}/graphql`,
    start: () => new Promise<void>(resolve => {
      server = app.listen(port, () => resolve());
    }),
    stop: () => new Promise<void>(resolve => {
      server.close(() => resolve());
    })
  };
}
