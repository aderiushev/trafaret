import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  ...fsd.configs.recommended,
  // One page: every widget is placed once by the editor page, and most features live in a single widget.
  { rules: { 'fsd/insignificant-slice': 'off' } },
]);
