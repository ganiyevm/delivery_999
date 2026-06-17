import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://localhost:3000',
        },
    },
    build: {
        rollupOptions: {
            output: {
                // Vendor kutubxonalarni alohida chunk qilish — brauzer cache dan foydalanadi
                manualChunks: {
                    vendor: ['react', 'react-dom'],
                },
            },
        },
        // Chunk ogohlantirishini 500KB ga ko'tarish (Telegram mini-app uchun)
        chunkSizeWarningLimit: 500,
    },
});
