import type { CapacitorConfig } from '@capacitor/cli';

// The Android app carries the whole interface inside it (webDir) instead of opening the website.
const config: CapacitorConfig = {
  appId: 'app.edgeblast.app',
  appName: 'Edge Blast',
  webDir: 'dist',
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 0, backgroundColor: '#0A0A0C', showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: '#0A0A0C', overlaysWebView: false },
  },
};

export default config;
