import { z } from 'zod';

/** Exactly the brief's shape. The API serves `references` as asset URLs. */
export const presetSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  mainPrompt: z.string(),
  negativePrompt: z.string(),
  references: z.array(z.string()),
});
export type Preset = z.infer<typeof presetSchema>;
