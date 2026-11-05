import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages отдаёт приложение из /<repo>/ — base задаётся в CI через VITE_BASE.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Библиотеки отдельно от кода приложения: меньше чанки, лучше кэш между релизами.
        codeSplitting: {
          groups: [
            { name: 'supabase', test: /node_modules[\\/]@supabase/ },
            { name: 'vendor', test: /node_modules/ },
          ],
        },
      },
    },
  },
});
