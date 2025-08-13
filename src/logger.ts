import { createRequire } from 'module';

export type Logger = {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug: (...args: any[]) => void;
};

const require = createRequire(import.meta.url);

let logger: Logger;

try {
  const pkg = require('@toolprint/mcp-logger');
  logger = (pkg.logger ?? pkg.default ?? pkg) as Logger;
} catch {
  logger = {
    info: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };
}

export default logger;
