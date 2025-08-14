import {
  GraphQLSchema, 
  GraphQLObjectType, 
  GraphQLInterfaceType,
  GraphQLField, 
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLType,
  isNonNullType,
  isListType,
  isScalarType,
  isEnumType,
  isInputObjectType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  GraphQLArgument,
  IntrospectionQuery,
  buildClientSchema,
  printType
} from 'graphql';
import logger from './logger.js';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  // Store GraphQL-specific information for query building
  _graphql?: {
    fieldName: string;
    operationType: 'query' | 'mutation';
    args: readonly GraphQLArgument[];
    returnType: GraphQLType;
    fieldSelection: string;
  };
}

// Global cache for type field selections
const typeFieldSelectionCache = new Map<string, string>();

// Cache for minimal field selections used for circular references
const minimalFieldSelectionCache = new Map<string, string>();

function getGraphQLVariableType(graphqlType: GraphQLType): string {
  if (isNonNullType(graphqlType)) {
    return `${getGraphQLVariableType(graphqlType.ofType)}!`;
  }
  
  if (isListType(graphqlType)) {
    return `[${getGraphQLVariableType(graphqlType.ofType)}]`;
  }
  
  // Return the actual GraphQL type name
  return graphqlType.name;
}

// Export this function for use in CLI
export { getGraphQLVariableType };

// Helper function to get minimal field selection for circular references
function getMinimalFieldSelection(actualType: GraphQLObjectType | GraphQLInterfaceType): string {
  const typeName = actualType.name;
  
  // Check cache first
  if (minimalFieldSelectionCache.has(typeName)) {
    return minimalFieldSelectionCache.get(typeName)!;
  }
  
  const fields = actualType.getFields();
  let minimalSelection = '';
  
  if (fields.documentId) {
    minimalSelection = '{ documentId }';
  } else if (fields.id) {
    minimalSelection = '{ id }';
  } else {
    minimalSelection = '';
  }
  
  minimalFieldSelectionCache.set(typeName, minimalSelection);
  return minimalSelection;
}

// Helper function to generate the full field selection for a type (without circular reference handling)
function generateFullFieldSelection(actualType: GraphQLObjectType | GraphQLInterfaceType, depth: number = 0): string {
  const typeName = actualType.name;
  
  // Check cache first
  if (typeFieldSelectionCache.has(typeName)) {
    return typeFieldSelectionCache.get(typeName)!;
  }
  
  // Prevent infinite depth during initial generation
  if (depth > 3) {
    const minimal = getMinimalFieldSelection(actualType);
    typeFieldSelectionCache.set(typeName, minimal);
    return minimal;
  }
  
  const fields = actualType.getFields();
  const fieldSelections: string[] = [];
  
  for (const [fieldName, field] of Object.entries(fields)) {
    const fieldType = (field as GraphQLField<any, any>).type;
    
    // Get the underlying type
    let checkType = fieldType;
    if (isNonNullType(checkType)) checkType = checkType.ofType;
    if (isListType(checkType)) checkType = checkType.ofType;
    if (isNonNullType(checkType)) checkType = checkType.ofType;
    
    // For complex object/interface types
    if (isObjectType(checkType) || isInterfaceType(checkType)) {
      // Check if this would create a circular reference
      if (checkType.name === typeName) {
        // Direct self-reference - use minimal selection
        const minimal = getMinimalFieldSelection(checkType);
        if (minimal) {
          fieldSelections.push(`${fieldName} ${minimal}`);
        }
      } else {
        // Generate or get cached selection for this type
        const nestedSelection = generateFullFieldSelection(checkType, depth + 1);
        if (nestedSelection) {
          fieldSelections.push(`${fieldName} ${nestedSelection}`);
        } else {
          fieldSelections.push(fieldName);
        }
      }
    } else if (isUnionType(checkType)) {
      fieldSelections.push(`${fieldName} { __typename }`);
    } else {
      // Scalar, enum, or other simple types
      fieldSelections.push(fieldName);
    }
  }
  
  let selection = '';
  if (fieldSelections.length > 0) {
    selection = `{\n${'  '.repeat(depth + 1)}${fieldSelections.join(`\n${'  '.repeat(depth + 1)}`)}\n${'  '.repeat(depth)}}`;
  }
  
  // Cache the result
  typeFieldSelectionCache.set(typeName, selection);
  return selection;
}

function generateFieldSelection(type: GraphQLType, visited: Set<string> = new Set(), depth: number = 0): string {
  // Handle NonNull and List wrappers to get to the actual type
  let actualType = type;
  if (isNonNullType(type)) {
    actualType = type.ofType;
  }
  if (isListType(actualType)) {
    actualType = actualType.ofType;
  }
  if (isNonNullType(actualType)) {
    actualType = actualType.ofType;
  }
  
  if (isScalarType(actualType) || isEnumType(actualType)) {
    return '';
  }
  
  if (isObjectType(actualType) || isInterfaceType(actualType)) {
    // Check for circular references in current call stack
    if (visited.has(actualType.name)) {
      return getMinimalFieldSelection(actualType);
    }
    
    // Use cached full field selection if available
    if (typeFieldSelectionCache.has(actualType.name)) {
      return typeFieldSelectionCache.get(actualType.name)!;
    }
    
    // Generate full field selection and cache it
    visited.add(actualType.name);
    const selection = generateFullFieldSelection(actualType, depth);
    visited.delete(actualType.name);
    
    return selection;
  }
  
  if (isUnionType(actualType)) {
    return '{ __typename }';
  }
  
  return '';
}

function getJSONSchemaType(graphqlType: GraphQLType, visited: Set<string> = new Set()): any {
  if (isNonNullType(graphqlType)) {
    return getJSONSchemaType(graphqlType.ofType, visited);
  }
  
  if (isListType(graphqlType)) {
    return {
      type: "array",
      items: getJSONSchemaType(graphqlType.ofType, visited)
    };
  }
  
  if (isScalarType(graphqlType)) {
    switch (graphqlType.name) {
      case 'String':
      case 'ID':
        return { type: "string" };
      case 'Int':
        return { type: "integer" };
      case 'Float':
        return { type: "number" };
      case 'Boolean':
        return { type: "boolean" };
      default:
        return { type: "string" };
    }
  }
  
  if (isEnumType(graphqlType)) {
    return {
      type: "string",
      enum: graphqlType.getValues().map(v => v.value)
    };
  }
  
  if (isInputObjectType(graphqlType)) {
    // Check for circular references
    if (visited.has(graphqlType.name)) {
      return { type: "object", description: `Circular reference to ${graphqlType.name}` };
    }
    
    visited.add(graphqlType.name);
    
    const properties: Record<string, any> = {};
    const required: string[] = [];
    
    const fields = graphqlType.getFields();
    for (const [fieldName, field] of Object.entries(fields)) {
      properties[fieldName] = getJSONSchemaType(field.type, visited);
      if (field.description) {
        properties[fieldName].description = field.description;
      }
      if (isNonNullType(field.type)) {
        required.push(fieldName);
      }
    }
    
    visited.delete(graphqlType.name);
    
    return {
      type: "object",
      properties,
      ...(required.length > 0 && { required })
    };
  }
  
  return { type: "object" };
}

function generateToolForField(
  fieldName: string, 
  field: GraphQLField<any, any>, 
  operationType: 'query' | 'mutation'
): MCPTool {
  const properties: Record<string, any> = {};
  const required: string[] = [];
  
  if (field.args && field.args.length > 0) {
    for (const arg of field.args) {
      properties[arg.name] = getJSONSchemaType(arg.type);
      if (arg.description) {
        properties[arg.name].description = arg.description;
      }
      // Only mark as required if it's NonNull AND doesn't have a default value
      if (isNonNullType(arg.type) && arg.defaultValue === undefined) {
        required.push(arg.name);
      }
    }
  }
  
  // Generate field selection for the return type
  const fieldSelection = generateFieldSelection(field.type);
  
  return {
    name: `${operationType}_${fieldName}`,
    description: field.description || `Execute GraphQL ${operationType}: ${fieldName}`,
    inputSchema: {
      type: "object",
      properties,
      ...(required.length > 0 && { required })
    },
    _graphql: {
      fieldName,
      operationType,
      args: field.args || [],
      returnType: field.type,
      fieldSelection
    }
  };
}

// Function to clear caches when processing a new schema
function clearFieldSelectionCaches() {
  typeFieldSelectionCache.clear();
  minimalFieldSelectionCache.clear();
}

// Function to export cache for debugging
export function getFieldSelectionCache() {
  return {
    full: Object.fromEntries(typeFieldSelectionCache),
    minimal: Object.fromEntries(minimalFieldSelectionCache)
  };
}

export function generateMCPToolsFromSchema(introspectionResult: IntrospectionQuery): MCPTool[] {
  // Clear caches for fresh schema processing
  clearFieldSelectionCaches();
  
  const schema = buildClientSchema(introspectionResult);
  const tools: MCPTool[] = [];
  
  logger.info('🗂️  Building field selection cache for all types...');
  
  // Pre-generate field selections for all object types to populate cache
  const typeMap = schema.getTypeMap();
  let cacheHits = 0;
  let cacheGenerations = 0;
  
  for (const [typeName, type] of Object.entries(typeMap)) {
    if (isObjectType(type) || isInterfaceType(type)) {
      if (!typeName.startsWith('__')) { // Skip introspection types
        generateFullFieldSelection(type);
        cacheGenerations++;
      }
    }
  }
  
  logger.info(`📊 Generated field selections for ${cacheGenerations} types`);
  
  const queryType = schema.getQueryType();
  if (queryType) {
    const fields = queryType.getFields();
    for (const [fieldName, field] of Object.entries(fields)) {
      tools.push(generateToolForField(fieldName, field, 'query'));
    }
  }
  
  const mutationType = schema.getMutationType();
  if (mutationType) {
    const fields = mutationType.getFields();
    for (const [fieldName, field] of Object.entries(fields)) {
      tools.push(generateToolForField(fieldName, field, 'mutation'));
    }
  }
  
  logger.info(`💾 Field selection cache contains ${typeFieldSelectionCache.size} full selections and ${minimalFieldSelectionCache.size} minimal selections`);
  
  return tools;
}