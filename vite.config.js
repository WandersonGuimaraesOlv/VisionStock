import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_BASE_PATH permite publicar o app num subcaminho do Nginx do servidor (ex.: /visionstock/)
const base = `/${(process.env.VITE_BASE_PATH || '').replace(/^\/+|\/+$/g, '')}/`.replace(/\/+/g, '/')

export default defineConfig({
  base,
  plugins: [
    react()
  ],
})
