import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gmajna.rythmify',
  appName: 'Rythmify',
  webDir: 'renderer',
  android: {
    allowMixedContent: true,
    backgroundColor: '#000000'
  },
  plugins: {
    // Routes fetch() through native HTTP so the unofficial YouTube Music, podcast and lyrics endpoints work without CORS limits.
    CapacitorHttp: { enabled: true }
  }
};

export default config;
