// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  site: 'https://kaustubhbutte.github.io',
  output: 'static',
  integrations: [react(), mdx()],

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['gsap']
    },
    optimizeDeps: {
      include: ['gsap', 'gsap/ScrollTrigger']
    }
  },

  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true
    }
  }
});