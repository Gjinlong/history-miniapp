<template>
  <view class="page-mine">
    <!-- 用户信息头部 -->
    <view class="mine-header">
      <image 
        class="mine-avatar" 
        :src="userInfo.avatar || '/static/imgs/avatar.png'"
        mode="aspectFill"
      />
      <text class="mine-name">{{ userInfo.nickName || '历史探索者' }}</text>
      <view class="mine-title-badge">
        {{ userInfo.title || '历史新手' }}
      </view>
    </view>

    <!-- 数据统计卡片 -->
    <view class="stats-grid">
      <view class="stat-card card">
        <text class="stat-value">{{ userInfo.totalAnswer || 0 }}</text>
        <text class="stat-label">累计答题</text>
      </view>
      <view class="stat-card card">
        <text class="stat-value">{{ userInfo.battlecount || 0 }}</text>
        <text class="stat-label">累计对战</text>
      </view>
      <view class="stat-card card">
        <text class="stat-value blue">{{ displayAccuracy }}%</text>
        <text class="stat-label">正确率</text>
      </view>
      <view class="stat-card card">
        <text class="stat-value orange">{{ userInfo.battlewin || 0 }}</text>
        <text class="stat-label">胜场数</text>
      </view>
    </view>

    <!-- 功能入口 -->
    <view class="menu-list">
      <view class="menu-item card" @click="goErrorList">
        <text class="menu-icon">📋</text>
        <text class="menu-text">我的错题本</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item card" @click="refreshData">
        <text class="menu-icon">🔄</text>
        <text class="menu-text">刷新数据</text>
        <text class="menu-arrow">›</text>
      </view>
	  <view class="menu-item card">
	    <view class="menu-icon">
			<image src="/static/imgs/remark.png" mode=""></image>
		</view>
	    <text class="menu-text">意见反馈</text>
	    <text class="menu-arrow">›</text>
		<button class="con-btn" open-type="contact"></button>
	  </view>
    </view>
  </view>
</template>

<script setup>
/**
 * 我的页面 - 完整个人信息 + 错题本入口
 */
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'

const userInfo = ref({
  _id: '',
  avatar: '',
  nickName: '历史探索者',
  totalAnswer: 0,
  rightCount: 0,
  accuracy: 0,
  title: '历史新手',
  errorList: []
})

const displayAccuracy = computed(() => {
  const acc = userInfo.value.accuracy
  if (acc === undefined || acc === null || userInfo.value.totalAnswer === 0) return '0.00'
  return (acc * 100).toFixed(2)
})

const errorCount = computed(() => {
  return userInfo.value.errorList ? userInfo.value.errorList.length : 0
})

onShow(() => {
  loadUserInfo()
})

function loadUserInfo() {
  const cached = getApp().globalData.userInfo || uni.getStorageSync('userInfo')
  if (cached && cached._id) {
    userInfo.value = { ...userInfo.value, ...cached }
  }
  // 异步刷新
  refreshData()
}

const remark = () => {
	uni.navigateTo({ url: '/pages/feedback/feedback' })
}

async function refreshData() {
  try {
    uni.showLoading({ title: '刷新中...', mask: true })
    const res = await uniCloud.callFunction({ name: 'getUserInfo', data: {} })
    uni.hideLoading()
    if (res.result && res.result.code === 0) {
      userInfo.value = { ...userInfo.value, ...res.result.data }
      uni.setStorageSync('userInfo', res.result.data)
      getApp().globalData.userInfo = res.result.data
    }
  } catch (e) {
    uni.hideLoading()
    console.error('[我的] 刷新失败:', e)
  }
}

function goErrorList() {
  uni.navigateTo({ url: '/pages/error-list/error-list' })
}
</script>

<style lang="scss" scoped>
.page-mine {
  min-height: 100vh;
  background: $bg-color;
}

.mine-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 50rpx 0 30rpx;
  background: linear-gradient(180deg, #62B6CB 0%, #FAF8F0 100%);
  
  .mine-avatar {
    width: 140rpx;
    height: 140rpx;
    border-radius: 50%;
    border: 4rpx solid #fff;
    box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.12);
  }
  
  .mine-name {
    font-size: 36rpx;
    font-weight: 700;
    color: #fff;
    margin-top: 16rpx;
  }
  
  .mine-title-badge {
    background: rgba(255,255,255,0.9);
    color: $primary-color;
    font-size: 24rpx;
    padding: 6rpx 24rpx;
    border-radius: 24rpx;
    margin-top: 8rpx;
    font-weight: 600;
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  
  .stat-card {
    text-align: center;
    padding: 24rpx 10rpx;
    
    .stat-value {
      display: block;
      font-size: 44rpx;
      font-weight: 700;
      color: $text-dark;
      
      &.green { color: #4CAF50; }
      &.blue { color: $primary-color; }
      &.orange { color: #FF9800; }
    }
    
    .stat-label {
      font-size: 24rpx;
      color: #999;
      margin-top: 6rpx;
    }
  }
}

.menu-list {
  padding: 0 24rpx;
  
  .menu-item {
    display: flex;
    align-items: center;
    padding: 24rpx 20rpx;
    margin-bottom: 12rpx;
    position: relative;
    .menu-icon {
      font-size: 36rpx;
      margin-right: 16rpx;
	  height: 50rpx;
	  >image{
		  width: 50rpx;
		  height: 50rpx;
	  }
    }
    .con-btn{
		width: 100%;
		height: 100%;
		position: absolute;
		top: 0;
		left: 0;
		opacity: 0;
	}
    .menu-text {
      flex: 1;
      font-size: 28rpx;
      color: $text-dark;
    }
    
    .menu-arrow {
      font-size: 36rpx;
      color: #ccc;
    }
  }
}
</style>