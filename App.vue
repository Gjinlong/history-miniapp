<script setup>
/**
 * App.vue - 历史答题闯关小程序入口
 * 功能：初始化uniCloud云开发、自动静默登录、全局用户信息管理
 */
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'

// 应用启动时执行
onLaunch(async () => {
  // console.log('[App] 应用启动，开始初始化...')
  
  // // 1. 初始化uniCloud云开发（环境ID固定）
  // try {
  //   // uniCloud.init({
  //   //   env: 'history-ui-miniapp',
  //   //   traceUser: true
  //   // })
  //   console.log('[App] uniCloud初始化成功，环境：history-ui-miniapp')
  // } catch (e) {
  //   console.error('[App] uniCloud初始化失败', e)
  //   uni.showToast({ title: '云服务初始化失败', icon: 'none' })
  //   return
  // }

  // // 2. 自动静默登录：检查本地缓存
  // const cachedUser = uni.getStorageSync('userInfo')
  // if (cachedUser && cachedUser._id) {
  //   console.log('[App] 缓存命中，用户已登录:', cachedUser.nickName)
  //   // getApp().globalData.userInfo = cachedUser
  //   return
  // }

  // // 3. 无缓存，调用云函数获取/创建用户
  // console.log('[App] 无缓存，开始自动登录...')
  // await autoLogin()
})

// 自动登录函数
async function autoLogin() {
  try {
    uni.showLoading({ title: '加载中...', mask: true })
    

    wx.login({
      async success (res1) {
        if (res1.code) {
          const res = await uniCloud.callFunction({
			name: 'getUserInfo',
			data: {code:res1.code}
		  })
		  
		  uni.hideLoading()
		  
		  if (res.result && res.result.code === 0) {
		    const userInfo = res.result.data
		    // 持久化缓存
		    uni.setStorageSync('userInfo', userInfo)
		    uni.setStorageSync('user_id', userInfo._id)
		    // 全局数据
		    // getApp().globalData.userInfo = userInfo
		    console.log('[App] 自动登录成功:', userInfo.nickName)
		  } else {
		    console.error('[App] 登录失败:', res.result)
		    uni.showToast({ title: '登录失败，请重试', icon: 'none' })
		  }
        } else {
          //console.log(res.errMsg)
        }
      }
    })
    
    
  } catch (e) {
    uni.hideLoading()
    console.error('[App] 自动登录异常:', e)
    uni.showToast({ title: '网络异常，请检查网络', icon: 'none', duration: 2500 })
  }
}

onShow(() => {
  console.log('[App] 应用显示')
})

onHide(() => {
  console.log('[App] 应用隐藏')
})
</script>

<style lang="scss">
/* 全局样式 */
@import '@/uni.scss';

page {
  background-color: $bg-color;
  color: $text-dark;
}

/* 通用卡片样式 */
.card {
  background: $white;
  border-radius: $card-radius;
  box-shadow: $card-shadow;
  padding: $spacing-md;
  margin: $spacing-sm $spacing-md;
}

/* 通用按钮主色 */
.btn-primary {
  background: $primary-color;
  color: $white;
  border-radius: $btn-radius;
  padding: 20rpx 48rpx;
  font-size: 32rpx;
  font-weight: 600;
  border: none;
  text-align: center;
  display: inline-block;
}

/* 文字省略 */
.text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>