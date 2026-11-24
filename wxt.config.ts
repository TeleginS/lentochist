import { defineConfig } from 'wxt';

/**
 * Public key that pins the extension ID to nnpgkkggehcakagglofehockjhinfhie
 * for every unpacked install, so the Apple FM helper can allow it by ID.
 */
const KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxJ1BKHL8q7ORkQFRJqo2KEEfCeOa5jxTXtSiWaLarz1kac0er7U3zqXKGm8dSrCuW6X7Nt18QnxyqLfk6tAieFkRRyAtBnc2v2NIW2O5ZHgdRSVresAH7Ujzm6msBtBOD2qzPSaT/5NzR6UyvwOrsZXeR1tTz2ubZiElhSH8WHnOl2CuIxUO8p73Ayd2Bvw/gRRpaVt/4ZYxnGsSazObyxKf2sE+G1pJOG6Cq0QAZvtG+uMrygfDrX3MadBz0x3XLTS+erX7pgcsimAFupmwW+0nJy/p42zPGqL5xNwUw4bnuSeGcbUw9wXfFCCVVvjIbed8S6X9TmjIH/cdjORKBQIDAQAB';

export default defineConfig({
  manifest: {
    name: 'lentochist',
    description: 'Cleans up the X/Twitter feed: hides tweets by language, keyword, topic and media.',
    key: KEY,
    permissions: ['storage', 'nativeMessaging'],
    host_permissions: [
      'https://pbs.twimg.com/*',
      'https://api.cloudflare.com/*',
      'https://api.typesafe.ai/*',
    ],
    action: { default_title: 'lentochist settings' },
  },
});
