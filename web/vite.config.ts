import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 프로젝트 사이트(https://jelitz.github.io/todayfin/)는 서브패스로 서빙되므로
// build/preview(둘 다 실제 배포와 동일한 정적 산출물 기준)에서는 리포지토리 이름을 base로,
// dev 서버(`npm run dev`)만 '/' 그대로 둔다.
// 주의: vite preview도 command는 'serve'로 잡히므로 isPreview로 따로 구분해야 한다.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/todayfin/' : '/',
  plugins: [react()],
}))
