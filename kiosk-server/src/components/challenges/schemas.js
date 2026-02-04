import { z } from 'zod';

function field(zodSchema, meta) {
  return { schema: zodSchema, ...meta };
}

const mathConfigSchema = {
  total_problems: field(z.number().int().min(1).max(100).default(10), {
    label: 'Number of Problems',
    description: 'How many addition problems to solve',
    type: 'number',
    min: 1,
    max: 100,
  }),
  min_number: field(z.number().int().min(1).max(999).default(10), {
    label: 'Minimum Number',
    description: 'Smallest number in problems',
    type: 'number',
    min: 1,
    max: 999,
  }),
  max_number: field(z.number().int().min(1).max(999).default(99), {
    label: 'Maximum Number',
    description: 'Largest number in problems',
    type: 'number',
    min: 1,
    max: 999,
  }),
};

const typingConfigSchema = {
  difficulty: field(z.enum(['easy', 'medium', 'hard']).default('medium'), {
    label: 'Difficulty',
    description: 'Easy = short words, Medium = common words, Hard = longer words',
    type: 'select',
    options: [
      { value: 'easy', label: 'Easy' },
      { value: 'medium', label: 'Medium' },
      { value: 'hard', label: 'Hard' },
    ],
  }),
  total_words: field(z.number().int().min(1).max(50).default(10), {
    label: 'Number of Words',
    description: 'How many words to type correctly',
    type: 'number',
    min: 1,
    max: 50,
  }),
};

const configSchemas = {
  math: mathConfigSchema,
  typing: typingConfigSchema,
};

export function getConfigFields(type) {
  return configSchemas[type] || {};
}

export function getDefaults(type) {
  const fields = getConfigFields(type);
  const defaults = {};
  for (const [key, field] of Object.entries(fields)) {
    const result = field.schema.safeParse(undefined);
    defaults[key] = result.success ? result.data : undefined;
  }
  return defaults;
}

export function buildZodSchema(type) {
  const fields = getConfigFields(type);
  const shape = {};
  for (const [key, field] of Object.entries(fields)) {
    shape[key] = field.schema;
  }
  return z.object(shape);
}
