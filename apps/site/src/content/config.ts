import { defineCollection, z } from 'astro:content';

const docs = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    order: z.number().default(99),
    section: z.string().default('General'),
  }),
});

const examples = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    icon: z.string(),
    category: z.enum([
      'core',
      'globe',
      'tools',
      'widgets-analysis',
      'visualization',
      'data-formats',
      'advanced',
    ]),
    tags: z.array(z.string()),
    demoFile: z.string().optional(),
    sourceTs: z.string().optional(),
    code: z.string().optional(),
    packages: z.array(z.string()).default(['@mapgpu/core', '@mapgpu/layers']),
    featured: z.boolean().default(false),
  }),
});

const benchmarks = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    library: z.string(),
    technology: z.string(),
    htmlFile: z.string(),
    color: z.string(),
    order: z.number().default(0),
  }),
});

export const collections = { docs, examples, benchmarks };
