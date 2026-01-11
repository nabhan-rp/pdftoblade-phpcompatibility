import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Penting untuk shared hosting agar bisa jalan di sub-folder
  base: './',
})