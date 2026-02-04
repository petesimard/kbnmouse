import { z } from 'zod';

export function field(zodSchema, meta) {
  return { schema: zodSchema, ...meta };
}

const configSchemas = {};

export function registerConfigSchema(type, schema) {
  configSchemas[type] = schema;
}

export function getConfigFields(type) {
  return configSchemas[type] || {};
}

export function computeDefaults(fields) {
  const defaults = {};
  for (const [key, f] of Object.entries(fields)) {
    const result = f.schema.safeParse(undefined);
    defaults[key] = result.success ? result.data : undefined;
  }
  return defaults;
}

export function getDefaults(type) {
  return computeDefaults(getConfigFields(type));
}

export function buildZodSchema(type) {
  const fields = getConfigFields(type);
  const shape = {};
  for (const [key, f] of Object.entries(fields)) {
    shape[key] = f.schema;
  }
  return z.object(shape);
}
