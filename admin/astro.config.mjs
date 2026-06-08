import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';

// SSR admin on Cloudflare Pages, gated by Cloudflare Access (carest pattern).
// The D1 binding is available via Astro.locals.runtime.env.DB.
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [tailwind()],
});
