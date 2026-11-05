import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
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
