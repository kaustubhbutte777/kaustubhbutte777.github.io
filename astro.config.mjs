// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { adminDevPlugin } from './src/plugins/adminDevPlugin';

// https://astro.build/config
export default defineConfig({
  site: 'https://kaustubhbutte777.github.io',
  output: 'static',
  integrations: [
    react(),
    mdx({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
    sitemap({
      // Control which pages appear in sitemap (and search results)
      filter: (page) => {
        // Exclude specific pages by returning false
        // Example: return !page.includes('/draft/');
        return true; // Include all pages by default
      },
    }),
  ],

  vite: {
    plugins: [tailwindcss(), adminDevPlugin()],
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
    },
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  }
});