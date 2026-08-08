import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 커스텀 도메인(todayfin.jelitz.com, web/public/CNAME)이 루트에서 서빙되므로 base는 항상 '/'.
export default defineConfig(() => ({
  base: '/',
  plugins: [react()],
}))
