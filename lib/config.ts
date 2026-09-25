// API base URL. Set EXPO_PUBLIC_API_URL before starting Expo.
// Examples:
//   same Wi-Fi:  http://192.168.1.20:4000
//   tunnel:      https://your-backend-tunnel.ngrok-free.app
declare const process: { env: Record<string, string | undefined> };

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

export const REQUIRED_ENV_WARNING =
  'EXPO_PUBLIC_API_URL is not set. The app is using http://localhost:4000, which a physical phone cannot reach. Set it to your computer LAN IP or backend tunnel URL.';
