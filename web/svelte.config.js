import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// vitePreprocess compiles <style lang="scss"> blocks with Sass.
export default {
  preprocess: vitePreprocess(),
};
