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
      'realtime-clustering',
      'advanced',
    ]),
    tags: z.array(z.string()),
    demoFile: z.string(),
    sourceTs: z.string(),
    featured: z.boolean().default(false),
  }),
});

export const collections = { docs, examples };
