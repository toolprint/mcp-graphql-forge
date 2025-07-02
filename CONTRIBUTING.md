# Contributing to Fast MCP GraphQL

Thank you for your interest in contributing to Fast MCP GraphQL! We welcome contributions from the community and are pleased to have you join us.

## 🚀 Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/fast-mcp-graphql.git
   cd fast-mcp-graphql
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Make your changes** and ensure tests pass:
   ```bash
   npm test
   ```
6. **Submit a pull request**

## 📋 Development Setup

### Prerequisites

- Node.js 18+ 
- npm 8+
- TypeScript 5.0+

### Local Development

```bash
# Install dependencies
npm install

# Run tests in watch mode
npm run test:watch

# Type checking
npm run typecheck

# Linting
npm run lint

# Build the project
npm run build

# Test with a real GraphQL endpoint
GRAPHQL_ENDPOINT="https://countries.trevorblades.com/" npm run dev
```

### Testing

We maintain comprehensive test coverage. All contributions should include tests:

```bash
# Run all tests
npm test

# Run specific test files
npm test -- src/__tests__/field-selection-cache.test.ts

# Run tests with coverage
npm run test:coverage

# Integration testing with real endpoints
GRAPHQL_ENDPOINT="https://your-test-endpoint.com/graphql" npm test
```

## 🎯 How to Contribute

### Types of Contributions

1. **🐛 Bug Fixes**
   - Fix issues with field selection generation
   - Resolve circular reference handling problems
   - Fix parameter validation edge cases

2. **✨ New Features**
   - Support for new GraphQL features (subscriptions, directives)
   - Additional transport protocols
   - Performance optimizations
   - Enhanced caching strategies

3. **📚 Documentation**
   - API documentation improvements
   - Usage examples
   - Integration guides
   - Performance benchmarks

4. **🧪 Tests**
   - Additional test cases for edge scenarios
   - Integration tests with real GraphQL services
   - Performance benchmarks

### Contribution Guidelines

#### Code Style

- Use TypeScript for all new code
- Follow existing code formatting (we use ESLint)
- Write clear, descriptive variable and function names
- Add JSDoc comments for public APIs

#### Commit Messages

Use conventional commit format:

```
type(scope): description

Examples:
feat(cache): add field selection caching system
fix(validation): handle null parameters correctly
docs(readme): update installation instructions
test(integration): add Strapi GraphQL endpoint tests
```

#### Pull Request Process

1. **Ensure tests pass**: All existing tests must pass
2. **Add tests**: New features require test coverage
3. **Update documentation**: Update README if adding features
4. **Small, focused PRs**: Keep changes focused and reviewable
5. **Describe changes**: Provide clear PR description with examples

### Code Architecture

#### Key Components

1. **`src/tool-generator.ts`**: Core tool generation and field selection logic
2. **`src/cli.ts`**: CLI interface and server implementation  
3. **`src/introspect.ts`**: GraphQL schema introspection
4. **`src/__tests__/`**: Comprehensive test suite

#### Adding New Features

When adding new features:

1. **Start with tests**: Write failing tests first (TDD approach)
2. **Consider caching**: How does your feature interact with the caching system?
3. **Handle edge cases**: GraphQL schemas can be complex
4. **Update types**: Ensure TypeScript types are updated
5. **Document behavior**: Add examples and documentation

### Testing Guidelines

#### Test Categories

1. **Unit Tests**: Test individual functions and components
2. **Integration Tests**: Test end-to-end functionality
3. **Cache Tests**: Verify caching behavior and performance
4. **Validation Tests**: Test parameter validation edge cases
5. **Real-World Tests**: Test against actual GraphQL endpoints

#### Writing Good Tests

```typescript
// ✅ Good: Descriptive test names and clear assertions
describe('Field Selection Caching', () => {
  it('should generate consistent field selections for repeated types', () => {
    const tools1 = generateMCPToolsFromSchema(schema);
    const tools2 = generateMCPToolsFromSchema(schema);
    
    expect(tools1[0]._graphql?.fieldSelection)
      .toBe(tools2[0]._graphql?.fieldSelection);
  });
});

// ❌ Avoid: Vague test names and unclear expectations
describe('Cache', () => {
  it('should work', () => {
    // unclear what "work" means
  });
});
```

## 🐛 Reporting Issues

### Bug Reports

When reporting bugs, please include:

1. **Clear description** of the issue
2. **Steps to reproduce** the problem
3. **Expected vs actual behavior**
4. **GraphQL schema** (if relevant)
5. **Environment details** (Node.js version, OS, etc.)
6. **Error messages** and stack traces

### Feature Requests

For feature requests:

1. **Describe the use case** - why is this needed?
2. **Proposed solution** - how should it work?
3. **Alternative approaches** - other ways to solve the problem
4. **Examples** - show how it would be used

## 🔧 Advanced Topics

### Performance Considerations

- Field selection caching is critical for performance
- Consider memory usage when adding new caching features
- Profile changes with large GraphQL schemas
- Test with real-world GraphQL endpoints

### GraphQL Schema Complexity

Fast MCP GraphQL handles complex schemas with:
- Circular references (User -> Posts -> User)
- Union types and interfaces
- Large schemas (100+ types)
- Deeply nested relationships

When contributing, consider these scenarios.

### Security Considerations

- Validate all user inputs
- Prevent prototype pollution
- Secure header handling
- Safe GraphQL query generation

## 📚 Resources

### Learning Resources

- [GraphQL Specification](https://spec.graphql.org/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Project Resources

- [GitHub Issues](https://github.com/onegrep/fast-mcp-graphql/issues)
- [Discussions](https://github.com/onegrep/fast-mcp-graphql/discussions)
- [Documentation](https://onegrep.github.io/fast-mcp-graphql)

## 🏆 Recognition

Contributors will be:
- Listed in our CONTRIBUTORS.md file
- Mentioned in release notes for significant contributions
- Invited to join our Discord community

## 📞 Getting Help

- **GitHub Discussions**: For questions and community support
- **GitHub Issues**: For bugs and feature requests
- **Email**: hello@onegrep.com for private inquiries

## 📝 License

By contributing to Fast MCP GraphQL, you agree that your contributions will be licensed under the Apache License 2.0.

---

Thank you for contributing to Fast MCP GraphQL! 🚀