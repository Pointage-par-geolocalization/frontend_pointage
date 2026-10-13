import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'mg.fortico.pointage',
  appName: 'Pointage App',
  webDir: 'dist',

  server: {
    url: 'https://suivie-fortico.vercel.app/login',
    cleartext: false
  }
};

export default config;