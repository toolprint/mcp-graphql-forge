# Contributing to MCP GraphQL Forge

Thank you for your interest in contributing to MCP GraphQL Forge! We welcome contributions from the community and appreciate your help in making this project better.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Running Tests](#running-tests)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Issue Guidelines](#issue-guidelines)

## Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for details.

## How to Contribute

### Reporting Bugs

- Use the GitHub issue tracker to report bugs
- Check if the issue has already been reported
- Use the bug report template when creating new issues
- Include steps to reproduce, expected behavior, and actual behavior

### Suggesting Enhancements

- Use the GitHub issue tracker to suggest enhancements
- Use the feature request template when applicable
- Clearly describe the feature and its potential benefits
- Consider if the feature aligns with the project's goals

### Code Contributions

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Ensure all tests pass
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn package manager

### Installation

1. Clone your fork of the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/fast-mcp-graphql.git
   cd fast-mcp-graphql
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

### Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Set up your GraphQL endpoint for testing:
   ```bash
   export GRAPHQL_ENDPOINT="https://your-test-endpoint.com/graphql"
   export GRAPHQL_AUTH_HEADER="Bearer your-token"
   ```

## Running Tests

We have a comprehensive test suite with 40+ test cases:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test files
npm test -- src/__tests__/field-selection-cache.test.ts
```

### Test Types

- **Unit Tests**: Test individual functions and modules
- **Integration Tests**: Test complete workflows with real GraphQL schemas
- **Security Tests**: Test for prototype pollution and input validation
- **Performance Tests**: Test caching efficiency and field selection optimization

## Submitting Changes

### Pull Request Process

1. Ensure your code follows the project's coding standards
2. Update documentation if needed
3. Add or update tests for your changes
4. Ensure all tests pass and linting is clean:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```
5. Update the README.md if you've added new features
6. Submit a pull request with a clear description

### Pull Request Guidelines

- Keep pull requests focused on a single feature or bug fix
- Write clear, concise commit messages
- Reference related issues in your PR description
- Be responsive to feedback and code review comments

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Follow the existing code style and patterns
- Use proper type annotations
- Avoid `any` types when possible

### Code Style

- Use ESLint for code linting
- Follow the configured ESLint rules
- Use meaningful variable and function names
- Add comments for complex logic

### Testing

- Write tests for all new features
- Maintain or improve test coverage
- Use descriptive test names
- Test both success and error cases

## Issue Guidelines

### Before Creating an Issue

1. Check if a similar issue already exists
2. Ensure you're using the latest version
3. Test with a minimal reproduction case

### Issue Templates

We provide templates for:
- Bug reports
- Feature requests
- Documentation improvements
- Performance issues

### Issue Labels

Common labels used in this project:
- `bug` - Something isn't working
- `enhancement` - New feature or improvement
- `documentation` - Documentation improvements
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed

## Getting Help

- Join discussions in GitHub Discussions
- Check the project documentation
- Look at existing issues and pull requests
- Feel free to ask questions in issues

## Recognition

Contributors are recognized in several ways:
- Contributors list in the README
- GitHub contributor statistics
- Acknowledgment in release notes for significant contributions

## License

By contributing to MCP GraphQL Forge, you agree that your contributions will be licensed under the Apache License 2.0.

---

Thank you for contributing to MCP GraphQL Forge! Your efforts help make this project better for everyone.