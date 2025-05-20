import { defineConfig } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default defineConfig({
  // Update input paths to point to your actual source files
  input: {
    main: 'src/main.js',
    background: 'src/background.js', // Create this file if it doesn't exist
  },
  output: {
    dir: 'dist',
    format: 'es', // Use ES modules format
    entryFileNames: '[name].js',
  },
  plugins: [
    resolve(),
    commonjs(),
  ],
});
