import { base, typescript, svelte, node } from '@ytpm/eslint-config';
import svelteConfig from './svelte.config.js';

export default [...base, ...typescript, ...svelte(svelteConfig), ...node];
