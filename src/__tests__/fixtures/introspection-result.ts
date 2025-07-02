import { introspectionFromSchema } from 'graphql';
import { testSchema } from './schema.js';

export const mockIntrospectionResult = introspectionFromSchema(testSchema);