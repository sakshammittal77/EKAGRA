import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Forward Firebase's sign-in pages through our own address so the Google
    // pop-up works in browsers that block cross-site storage (Brave, Safari).
    proxy: {
      '/__': {
        target: 'https://ekagra-dfe37.firebaseapp.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
