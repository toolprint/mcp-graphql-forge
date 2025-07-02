#!/usr/bin/env node
import { main } from './cli.js';

main().catch((err: Error) => {
  console.error('Failed to start MCP GraphQL Forge:', err.message);
  process.exit(1);
}); 