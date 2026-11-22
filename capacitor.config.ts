import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.denghui.faststudy',
  appName: 'FastStudy',
  webDir: 'dist',
  android: {
    backgroundColor: '#f6f3ec',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
