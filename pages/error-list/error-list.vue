<template>
  <view class="page-error-list">
    <!-- 加载状态 -->
    <view v-if="loading" class="loading-wrap">
      <text>加载错题中...</text>
    </view>

    <!-- 错题列表 -->
    <view v-else-if="errorList.length > 0" class="error-list">
      <view v-for="(item, index) in errorList" :key="index" class="error-card card">
        <view class="error-header">
          <text class="error-num">错题 {{ index + 1 }}</text>
        </view>
        <text class="error-title">{{ item.title }}</text>
		<text class="error-title">{{ "A."+item.options[0]+"\nB."+item.options[1]+"\nC."+item.options[2]+"\nD."+item.options[3] }}</text>
        <view class="error-detail">
          <view class="detail-row wrong">
            <text class="detail-label">❌ 你的答案：</text>
            <text class="detail-value">{{ item.userAnswer }}</text>
          </view>
          <view class="detail-row correct">
            <text class="detail-label">✅ 正确答案：</text>
            <text class="detail-value">{{ item.rightAnswer }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空数据 -->
    <view v-else class="empty-wrap">
      <text class="empty-icon">🎉</text>
      <text>暂无错题，继续保持！</text>
    </view>
  </view>
</template>

<script setup>
/**
 * 错题列表页 - 展示用户错题详情（仅查看，不支持重答）
 */
import { ref } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'

const errorList = ref([])
const loading = ref(true)

// 增加分页
const page = ref(1)
const pageSize = ref(10)
const totalPages = ref(1)

onLoad(() => {
  loadErrorList()
})

onReachBottom(() => {
	console.log("触发");
  if (page.value < totalPages.value) {
    page.value++
    loadErrorList()
  }
})

async function loadErrorList() {
  // loading.value = true
  try {
    uni.showLoading({ title: '加载中...', mask: true })
    const res = await uniCloud.callFunction({
      name: 'getUserErrorList',
      data: {
        page: page.value,
        pageSize: pageSize.value,
		    uid:uni.getStorageSync("user_id")
	    }
    })
    uni.hideLoading()
    
    if (res.result && res.result.code === 0) {
      errorList.value = [...errorList.value, ...res.result.data] // 追加新数据
      totalPages.value = res.result.totalPages || 1
    } else {
      uni.showToast({ title: res.result?.msg || '加载失败', icon: 'none' })
    }
  } catch (e) {
    uni.hideLoading()
    console.error('[错题列表] 加载异常:', e)
    uni.showToast({ title: '网络异常', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.page-error-list {
  min-height: 100vh;
  background: $bg-color;
  padding: 16rpx 0;
}

.loading-wrap, .empty-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
  color: #999;
  font-size: 28rpx;
  
  .empty-icon {
    font-size: 64rpx;
    margin-bottom: 16rpx;
  }
}

.error-card {
  margin: 12rpx 20rpx;
  padding: 24rpx;
  
  .error-header {
    margin-bottom: 12rpx;
    
    .error-num {
      font-size: 22rpx;
      color: $primary-color;
      font-weight: 600;
      background: #E8F6F9;
      padding: 4rpx 14rpx;
      border-radius: 12rpx;
    }
  }
  
  .error-title {
    font-size: 30rpx;
    font-weight: 600;
    color: $text-dark;
    line-height: 1.6;
    display: block;
    margin-bottom: 16rpx;
  }
  
  .error-detail {
    .detail-row {
      display: flex;
      align-items: center;
      padding: 12rpx 0;
      font-size: 26rpx;
      
      .detail-label {
        flex-shrink: 0;
        margin-right: 8rpx;
      }
      
      .detail-value {
        font-weight: 600;
      }
      
      &.wrong .detail-value {
        color: #F44336;
      }
      
      &.correct .detail-value {
        color: #4CAF50;
      }
    }
  }
}
</style>