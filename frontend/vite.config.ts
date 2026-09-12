import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const page = (name: string) => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: page('./index.html'),
        ariel: page('./ariel.html'),
        olivia: page('./olivia.html'),
        bottega: page('./bottega.html'),
        tana: page('./tana.html'),
        chiSiamo: page('./chi-siamo.html'),
      },
    },
  },
});
