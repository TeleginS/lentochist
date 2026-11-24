import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'lentochist',
    description: 'Cleans up the X/Twitter feed: hides tweets by language and keyword.',
    permissions: ['storage'],
    action: { default_title: 'lentochist settings' },
  },
});
