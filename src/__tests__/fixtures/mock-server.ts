import { createServer } from 'http';
import logger from '../../logger.js';
import { getIntrospectionQuery } from 'graphql';
import { mockIntrospectionResult } from './introspection-result.js';

export function createMockGraphQLServer(port: number = 4000) {
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

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
        
        if (query.includes('__schema') || query === getIntrospectionQuery()) {
          res.writeHead(200);
          res.end(JSON.stringify({
            data: mockIntrospectionResult
          }));
        } else {
          res.writeHead(200);
          res.end(JSON.stringify({
            data: { 
              message: 'Mock response for testing',
              query,
              variables 
            }
          }));
        }
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ 
          error: 'Invalid JSON',
          details: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    });
  });

  return {
    server,
    start: () => new Promise<void>((resolve) => {
      server.listen(port, () => {
        logger.info(`Mock GraphQL server started on port ${port}`);
        resolve();
      });
    }),
    stop: () => new Promise<void>((resolve) => {
      server.close(() => {
        logger.info('Mock GraphQL server stopped');
        resolve();
      });
    })
  };
}