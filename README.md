# MCP GraphQL Forge

[![NPM Version](https://img.shields.io/npm/v/@toolprint/mcp-graphql-forge)](https://www.npmjs.com/package/@toolprint/mcp-graphql-forge)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-2024--11--05-green)](https://modelcontextprotocol.io/)

## Quick Install

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/install-mcp?name=toolprint-mcp-graphql&config=JTdCJTIyY29tbWFuZCUyMiUzQSUyMm5weCUyMC15JTIwJTQwdG9vbHByaW50JTJGbWNwLWdyYXBocWwtZm9yZ2UlMjIlMkMlMjJlbnYlMjIlM0ElN0IlMjJHUkFQSFFMX0VORFBPSU5UJTIyJTNBJTIyaHR0cHMlM0ElMkYlMkZ5b3VyLWFwaS5jb20lMkZncmFwaHFsJTIyJTJDJTIyR1JBUEhRTF9BVVRIX0hFQURFUiUyMiUzQSUyMkJlYXJlciUyMFlPVVJfVE9LRU4lMjIlN0QlN0Q%3D)

### Alternative Installation Methods

```bash
# Via Smithery (recommended)
npx @smithery/cli install @toolprint/mcp-graphql-forge --client claude

# Via npm
npm install -g @toolprint/mcp-graphql-forge
```

An MCP server that makes GraphQL APIs accessible to AI tools by:
- Automatically generating MCP tools from GraphQL schema introspection
- Validating parameters and handling errors for reliable AI interactions
- Supporting both stdio and HTTP transports for development and production
- Caching schema and field selections for consistent performance

## ✨ Features

- **Tool Generation**: Creates MCP tools from GraphQL schema introspection
- **Parameter Validation**: Multi-layer validation prevents GraphQL errors
- **Dual Transport**: Supports stdio (AI tools) and HTTP (development/testing)
- **Schema Management**: Optional pre-introspection and caching
- **Authentication**: Flexible header configuration for authenticated endpoints _[Experimental]_

## 🚀 Getting Started

> **Note**: Docker runtime support is currently a work in progress. For production deployments, we recommend using the TypeScript runtime on platforms like Smithery.

### Quick Start with HTTP Mode (Recommended for Development)

1. **Start the server**:
   ```bash
   # Start serving it with the Streamable HTTP transport
   GRAPHQL_ENDPOINT="https://your-api.com/graphql" npx -y @toolprint/mcp-graphql-forge --transport http --port 3001
   ```

2. **Connect with MCP Inspector**:
   ```bash
   # In another terminal, launch the inspector
   npx @modelcontextprotocol/inspector
   ```

3. **With authentication**:
   ```bash
   # Using environment variables for configuration
   export GRAPHQL_ENDPOINT="https://api.github.com/graphql"
   export GRAPHQL_AUTH_HEADER="Bearer YOUR_TOKEN"
   npx @toolprint/mcp-graphql-forge --transport http --port 3001

   # Or all in one line
   GRAPHQL_ENDPOINT="https://api.github.com/graphql" GRAPHQL_AUTH_HEADER="Bearer YOUR_TOKEN" npx @toolprint/mcp-graphql-forge --transport http --port 3001
   ```

### Direct AI Integration (Claude/Cursor)

Create an `mcp.json` in your project root. This will run it in **stdio** mode.

```json
{
    "mcpServers": {
        "mcp-graphql-forge": {
            "command": "npx",
            "args": [
              "-y",
              "@toolprint/mcp-graphql-forge"
            ],
            "env": {
                "GRAPHQL_ENDPOINT": "https://your-api.com/graphql",
                "GRAPHQL_AUTH_HEADER": "Bearer YOUR_TOKEN"
            }
        }
    }
}
```

### Schema Management

1. **Pre-generate schema**:
   ```bash
   # Generate schema without starting server
   GRAPHQL_ENDPOINT="https://your-api.com/graphql" mcp-graphql-forge introspect

   # Start server using pre-generated schema
   mcp-graphql-forge --no-introspection --transport http --port 3001
   ```

2. **Custom schema location**:
   ```bash
   # Generate schema in custom location
   SCHEMA_PATH="./schemas/my-api.json" mcp-graphql-forge introspect

   # Use custom schema location
   SCHEMA_PATH="./schemas/my-api.json" mcp-graphql-forge --no-introspection --transport http --port 3001
   ```

3. **Force schema regeneration**:
   ```bash
   # Force regenerate schema even if it exists
   mcp-graphql-forge introspect --force

   # Regenerate and start server
   mcp-graphql-forge --force-introspection --transport http --port 3001
   ```

### Advanced Configuration

```bash
# Multiple custom headers
export GRAPHQL_HEADER_X_API_KEY="your-api-key"
export GRAPHQL_HEADER_X_CLIENT_ID="your-client-id"
mcp-graphql-forge --transport http --port 3001

# Development mode with auto-reload on schema changes
mcp-graphql-forge --transport http --port 3001 --watch
```

## 🛠️ How It Works

### 1. **Schema Introspection**
```bash
🗂️  Building field selection cache for all types...
📊 Generated field selections for 44 types  
💾 Field selection cache contains 44 full selections and 5 minimal selections
Generated 63 tools from GraphQL schema:
  - 30 query tools
  - 33 mutation tools
```

### 2. **Intelligent Tool Generation**

For a GraphQL schema like:
```graphql
type Query {
  user(id: ID!): User
  articles(filters: ArticleFiltersInput, pagination: PaginationArg): [Article]
}

type Mutation {
  createUser(input: CreateUserInput!): User
}
```

Fast MCP GraphQL automatically generates:
- ✅ `query_user` - with required `id` parameter validation
- ✅ `query_articles` - with optional filtering and pagination
- ✅ `mutation_createUser` - with input validation and complete field selections

### 3. **Smart Field Selection**

Instead of manual GraphQL query construction:
```graphql
# ❌ Error-prone manual approach
query {
  articles {
    # Missing required field selections!
    author {
      # Circular reference issues!
    }
  }
}
```

Fast MCP GraphQL generates optimal queries automatically:
```graphql
# ✅ Auto-generated with full field selections
query articlesOperation($filters: ArticleFiltersInput, $pagination: PaginationArg) {
  articles(filters: $filters, pagination: $pagination) {
    documentId
    title
    description
    author {
      documentId
      name
      email
      articles_connection {
        nodes { documentId }  # Circular reference handled!
      }
    }
    category {
      documentId
      name
      articles { documentId }  # Cached selection reused!
    }
  }
}
```

## 🏗️ Architecture

### Caching System
- **Type-Level Caching**: Each GraphQL type's field selection is computed once and reused
- **Circular Reference Resolution**: Intelligent detection with minimal field fallbacks
- **Consistent Output**: Same type always generates identical field selections

### Validation Pipeline
1. **JSON Schema Validation**: MCP clients validate parameters before execution
2. **Server-Side Validation**: Prevents execution with missing required parameters
3. **GraphQL Validation**: Final validation at the GraphQL layer

### Transport Support
- **Stdio Transport**: For MCP client integration (default)
- **HTTP Transport**: RESTful interface with MCP 2025 Streamable HTTP specification
- **Session Management**: Automatic session handling for HTTP transport

## 📚 API Reference

### CLI Options

```bash
mcp-graphql-forge [options]

Options:
  --transport <type>     Transport type: stdio or http (default: stdio)
  --port <number>        Port for HTTP transport (default: 3000)
  --no-introspection     Skip schema introspection (use cached schema)
  --version              Show version number
  --help                 Show help
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GRAPHQL_ENDPOINT` | GraphQL API endpoint | `https://api.example.com/graphql` |
| `GRAPHQL_AUTH_HEADER` | Authorization header | `Bearer token123` |
| `GRAPHQL_HEADER_*` | Custom headers | `GRAPHQL_HEADER_X_API_KEY=key123` |
| `SCHEMA_PATH` | Schema cache file path | `./schema.json` |
| `PORT` | HTTP server port | `3001` |

### Generated Tool Schema

Each generated tool follows this pattern:

```typescript
{
  name: "query_user",
  description: "Execute GraphQL query: user",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string" }
    },
    required: ["id"]  // Only truly required parameters
  }
}
```

## 🧪 Testing

### Comprehensive Test Suite

- **40+ Test Cases**: Covering all functionality and edge cases
- **Real-World Scenarios**: Tests against actual GraphQL schemas (Strapi, GitHub, etc.)
- **Security Testing**: Prototype pollution protection and input validation
- **Performance Testing**: Cache efficiency and field selection optimization

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- src/__tests__/field-selection-cache.test.ts
npm test -- src/__tests__/server-validation.test.ts
npm test -- src/__tests__/graphql-execution.test.ts

# Coverage report
npm run test:coverage
```

### Integration Testing

```bash
# Test with real GraphQL endpoints
GRAPHQL_ENDPOINT="https://countries.trevorblades.com/" npm test

# Test caching performance
npm run test:performance
```

## 🛡️ Security

### Parameter Validation
- **Required Parameter Enforcement**: Prevents GraphQL variable errors
- **Null/Undefined Checking**: Validates parameter presence and values
- **Prototype Pollution Protection**: Uses secure property checking methods

### Schema Security
- **Input Sanitization**: All GraphQL inputs are properly typed and validated
- **Circular Reference Protection**: Prevents infinite recursion in field selections
- **Header Validation**: Secure header handling for authentication

## 🚀 Performance

### Benchmarks
- **Schema Introspection**: ~10ms for typical schemas
- **Tool Generation**: ~5ms with caching enabled
- **Field Selection**: Pre-computed and cached for instant access
- **Memory Usage**: Efficient caching with minimal memory footprint

### Optimization Features
- **Field Selection Caching**: Eliminates redundant field selection computation
- **Schema Caching**: Optional schema persistence for faster restarts
- **Minimal GraphQL Queries**: Only requests necessary fields
- **Connection Pooling**: Efficient HTTP client management

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/toolprint/mcp-graphql-forge.git
cd mcp-graphql-forge

# Install dependencies
npm install

# Run tests
npm test

# Start development
npm run dev
```

### Code Quality

- **TypeScript**: Fully typed codebase
- **ESLint**: Consistent code formatting
- **Vitest**: Modern testing framework
- **100% Test Coverage**: Comprehensive test suite

## 📖 Examples

### Real-World Usage

<details>
<summary>🔸 <strong>Strapi CMS Integration</strong></summary>

```bash
# Connect to Strapi GraphQL API
export GRAPHQL_ENDPOINT="https://your-strapi.com/graphql"
export GRAPHQL_AUTH_HEADER="Bearer YOUR_STRAPI_TOKEN"
mcp-graphql-forge

# Generates tools like:
# - query_articles, query_users, query_categories
# - mutation_createArticle, mutation_updateUser
# - Full field selections with media, relations, and metadata
```
</details>

<details>
<summary>🔸 <strong>GitHub API Integration</strong></summary>

```bash
# Connect to GitHub GraphQL API
export GRAPHQL_ENDPOINT="https://api.github.com/graphql"
export GRAPHQL_AUTH_HEADER="Bearer YOUR_GITHUB_TOKEN"
mcp-graphql-forge

# Generates tools like:
# - query_repository, query_user, query_organization
# - query_search (with intelligent result type handling)
# - mutation_createIssue, mutation_addComment
```
</details>

<details>
<summary>🔸 <strong>E-commerce Platform</strong></summary>

```bash
# Connect to Shopify/WooCommerce GraphQL
export GRAPHQL_ENDPOINT="https://your-shop.myshopify.com/api/graphql"
export GRAPHQL_HEADER_X_SHOPIFY_ACCESS_TOKEN="YOUR_TOKEN"
mcp-graphql-forge

# Generates tools for:
# - Product management (query_products, mutation_productCreate)
# - Order processing (query_orders, mutation_orderUpdate)
# - Customer management with full relationship mapping
```
</details>

### Custom Schema Example

```typescript
// Example: Blog Platform Schema
type Query {
  posts(published: Boolean, authorId: ID): [Post]
  post(slug: String!): Post
  authors: [Author]
}

type Mutation {
  createPost(input: CreatePostInput!): Post
  publishPost(id: ID!): Post
}

// Generated Tools:
// ✅ query_posts (published?: boolean, authorId?: string)
// ✅ query_post (slug: string) ← Required parameter enforced
// ✅ query_authors () ← No parameters
// ✅ mutation_createPost (input: CreatePostInput) ← Validated input
// ✅ mutation_publishPost (id: string) ← Required parameter enforced
```

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🏢 About OneGrep, Inc.

MCP GraphQL Forge is developed and maintained by [OneGrep, Inc.](https://onegrep.dev), a company focused on building developer tools and AI infrastructure.

---

**[Issues](https://github.com/toolprint/mcp-graphql-forge/issues)** • 
**[Discussions](https://github.com/toolprint/mcp-graphql-forge/discussions)**

Made with ❤️ by the OneGrep team
