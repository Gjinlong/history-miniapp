import { createSSRApp } from 'vue'
import App from './App.vue'

export function createApp() {
  const app = createSSRApp(App)
  // 全局错误捕获
  app.config.errorHandler = (err, vm, info) => {
    console.error('[全局错误]', err, info)
    uni.showToast({ title: '出错了，请重试', icon: 'none', duration: 2000 })
  }
  return { app }
}