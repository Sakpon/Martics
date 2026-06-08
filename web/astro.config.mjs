import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// Static landing + LIFF pages, deployed to Cloudflare Pages (martics-web).
export default defineConfig({
  integrations: [tailwind()],
  site: 'https://martics-web.pages.dev',
});
