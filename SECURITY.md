# Security Policy

## Reporting Security Vulnerabilities

We take the security of MCP GraphQL Forge seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please email us at: **support@onegrep.dev**

Include the following information:
- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Response Timeline

- We will acknowledge your email within 48 hours
- We will provide a detailed response within 7 days indicating our next steps
- We will keep you informed of progress towards fixing the issue
- We may ask for additional information or guidance

### Security Best Practices

When using MCP GraphQL Forge:

1. **Authentication**: Always use proper authentication headers for GraphQL endpoints
2. **Environment Variables**: Store sensitive tokens and API keys in environment variables, never in code
3. **Network Security**: Use HTTPS endpoints when possible
4. **Principle of Least Privilege**: Only grant necessary permissions to GraphQL endpoints
5. **Regular Updates**: Keep the package updated to the latest version for security patches

### Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | ✅ Yes             |
| < 0.1   | ❌ No              |

### Security Considerations for GraphQL

- **Query Depth Limiting**: Be aware of deep nested queries that could cause performance issues
- **Rate Limiting**: Implement appropriate rate limiting on your GraphQL endpoints
- **Input Validation**: The server validates inputs, but ensure your GraphQL API also validates data
- **Schema Introspection**: Consider disabling schema introspection in production environments

## Acknowledgments

We appreciate the security research community's efforts to improve the security of open source projects. Responsible disclosure helps keep everyone safe.