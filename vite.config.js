import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Configuração do Vite para o Catálogo Mersan Calçados
// Etapa 1: estrutura base + PWA
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'Mersan Calçados - Catálogo Loja 261',
        short_name: 'Mersan Catálogo',
        description: 'Catálogo digital da Mersan Calçados - Loja 261',
