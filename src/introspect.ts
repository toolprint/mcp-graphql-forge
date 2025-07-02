import { GraphQLClient, gql } from 'graphql-request';
import { getIntrospectionQuery, buildClientSchema, introspectionFromSchema, IntrospectionQuery } from 'graphql';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface IntrospectionConfig {
  endpoint: string;
  headers?: Record<string, string>;
  outputPath?: string;
}

export async function introspectGraphQLSchema(config: IntrospectionConfig): Promise<IntrospectionQuery> {
  const client = new GraphQLClient(config.endpoint, {
    headers: config.headers || {}
  });

  try {
    const introspectionQuery = getIntrospectionQuery();
    const result = await client.request<IntrospectionQuery>(introspectionQuery);
    
    if (config.outputPath) {
      writeFileSync(config.outputPath, JSON.stringify(result, null, 2));
      console.log(`Schema introspection saved to: ${config.outputPath}`);
    }
    
    return result;
  } catch (error) {
    console.error('Failed to introspect GraphQL schema:', error);
    throw error;
  }
}

export function generateToolsFromSchema(introspectionResult: IntrospectionQuery): any[] {
  const schema = buildClientSchema(introspectionResult);
  const tools: any[] = [];

  const queryType = schema.getQueryType();
  const mutationType = schema.getMutationType();

  if (queryType) {
    const fields = queryType.getFields();
    for (const [fieldName, field] of Object.entries(fields)) {
      tools.push({
        name: `query_${fieldName}`,
        description: field.description || `Execute GraphQL query: ${fieldName}`,
        inputSchema: {
          type: "object",
          properties: {
            variables: {
              type: "object",
              description: "Variables for the GraphQL query"
            }
          }
        }
      });
    }
  }

  if (mutationType) {
    const fields = mutationType.getFields();
    for (const [fieldName, field] of Object.entries(fields)) {
      tools.push({
        name: `mutation_${fieldName}`,
        description: field.description || `Execute GraphQL mutation: ${fieldName}`,
        inputSchema: {
          type: "object",
          properties: {
            variables: {
              type: "object",
              description: "Variables for the GraphQL mutation"
            }
          }
        }
      });
    }
  }

  return tools;
}

async function main() {
  const endpoint = process.env.GRAPHQL_ENDPOINT;
  if (!endpoint) {
    console.error('Please set GRAPHQL_ENDPOINT environment variable');
    process.exit(1);
  }

  const headers: Record<string, string> = {};
  if (process.env.GRAPHQL_AUTH_HEADER) {
    headers.Authorization = process.env.GRAPHQL_AUTH_HEADER;
  }

  const outputPath = join(process.cwd(), 'schema.json');
  const toolsPath = join(process.cwd(), 'tools.json');

  try {
    const introspectionResult = await introspectGraphQLSchema({
      endpoint,
      headers,
      outputPath
    });

    const tools = generateToolsFromSchema(introspectionResult);
    writeFileSync(toolsPath, JSON.stringify(tools, null, 2));
    console.log(`Generated ${tools.length} tools and saved to: ${toolsPath}`);
  } catch (error) {
    console.error('Introspection failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}