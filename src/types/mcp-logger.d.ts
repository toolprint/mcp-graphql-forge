declare module '@toolprint/mcp-logger' {
  export interface Logger {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    debug: (...args: any[]) => void;
  }
  const logger: Logger;
  export default logger;
}
