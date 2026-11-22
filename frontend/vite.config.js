import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND_TARGET = process.env.VITE_BACKEND_TARGET || "http://127.0.0.1:10000";

export default defineConfig({
  define: {
    global: "globalThis",
  },
  css: {
    postcss: {},
  },
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
    proxy: {
      "/auth": {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      "/api": {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      "/ws": {
        target: BACKEND_TARGET,
        changeOrigin: true,
        ws: true,
      },
      "/conversations": {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      "/posts": {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      "/messages": {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      "/translate": {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      "/users": {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      "/media": {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      "/uploads": {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-framework': [
            'react',
            'react-dom',
            'react-router-dom',
            'react-redux',
            '@reduxjs/toolkit',
          ],
          'vendor-firebase': ['firebase/app', 'firebase/auth'],
          'vendor-networking': [
            'axios',
            'sockjs-client',
            '@stomp/stompjs',
            'socket.io-client',
          ],
        },
      },
    },
  },
});

