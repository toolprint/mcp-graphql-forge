#!/usr/bin/env node
import { main } from './cli.js';
import logger from './logger.js';

main().catch((err: Error) => {
  logger.error('Failed to start MCP GraphQL Forge:', err.message);
  process.exit(1);
});