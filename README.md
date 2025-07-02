# Fast MCP GraphQL

An MCP (Model Context Protocol) server that proxies to GraphQL services with dynamic tool generation from schema introspection.

## Features

- **Dynamic Tool Generation**: Automatically generates MCP tools from GraphQL schema introspection
- **Dual Transport Support**: Supports both stdio and HTTP/SSE transports
- **Schema Caching**: Can load pre-introspected schemas for faster startup
- **Authentication Support**: Configurable headers for authenticated GraphQL endpoints

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your GraphQL endpoint
   ```

3. **Introspect your GraphQL schema** (optional, for faster startup):
   ```bash
   GRAPHQL_ENDPOINT=http://your-graphql-endpoint.com/graphql npm run introspect
   ```

4. **Start the server**:
   
   **Stdio mode** (for MCP clients):
   ```bash
   npm run dev
   ```
   
   **HTTP mode** (for testing/debugging):
   ```bash
   npm run dev:http
   ```

## Usage

### Two-Step Process

1. **Schema Introspection**: Generate tool definitions from GraphQL schema
2. **MCP Server**: Run server with dynamically generated tools

### Environment Variables

- `GRAPHQL_ENDPOINT`: The GraphQL endpoint to proxy to
- `GRAPHQL_AUTH_HEADER`: Optional authorization header
- `SCHEMA_PATH`: Path to cached schema file (optional)
- `PORT`: Port for HTTP server mode (default: 3000)

### Generated Tools

The server automatically generates MCP tools for each GraphQL query and mutation:

- Queries: `query_<fieldName>`
- Mutations: `mutation_<fieldName>`

Each tool accepts the GraphQL field arguments as input parameters.

## Example

For a GraphQL schema with:

```graphql
type Query {
  user(id: ID!): User
  users(limit: Int): [User]
}

type Mutation {
  createUser(input: CreateUserInput!): User
}
```

The following MCP tools are generated:

- `query_user` - Accepts `id` parameter
- `query_users` - Accepts optional `limit` parameter  
- `mutation_createUser` - Accepts `input` parameter

## Development

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Testing
npm run test
npm run test:watch
npm run test:coverage

# Build
npm run build
```

## Testing

The project includes comprehensive tests for:

- **Schema Introspection**: Validates GraphQL schema introspection functionality
- **Tool Generation**: Tests MCP tool generation from GraphQL schemas  
- **Integration**: End-to-end testing of the complete workflow
- **Server Logic**: Tests server configuration and operation building

Run tests with:
```bash
npm test
```

Test coverage is available with:
```bash
npm run test:coverage
```