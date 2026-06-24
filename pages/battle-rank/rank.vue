<template>
  <view class="page-rank">
    <!-- 加载状态 -->
    <view v-if="loading" class="loading-wrap">
      <text>加载排行榜中...</text>
    </view>

    <!-- 排行榜列表 -->
    <view v-else class="rank-list">
      <view 
        v-for="(item, index) in rankList" 
        :key="item._id"
        class="rank-item card"
        :class="{ 'is-me': item._id === myUserId }"
      >
        <view class="rank-num" :class="getRankClass(index)">
          {{ index + 1 }}
        </view>
        <image 
          class="rank-avatar" 
          :src="item.avatar || '/static/imgs/avatar.png'"
          mode="aspectFill"
        />
        <view class="rank-info">
          <text class="rank-name text-ellipsis">
            {{ item.nickName || '匿名用户' }}
            <text v-if="item._id === myUserId" class="me-tag">我</text>
          </text>
          <text class="rank-title">{{ item.title || '历史新手' }}</text>
        </view>
        <view class="rank-stats">
          <text class="stat-acc">获胜{{ item.battlewin || 0 }}场</text>
          <text class="stat-total">对战{{ item.battlecount || 0 }}场</text>
        </view>
      </view>

      <!-- 空数据 -->
      <view v-if="rankList.length === 0" class="empty-wrap">
        <text>暂无排行数据</text>
      </view>
	  
	  <view class="my-rank rank-item card is-me">
	    <view class="rank-num" :class="getRankClass(userRank - 1)">
	      {{ userRank }}
	    </view>
	    <image 
	      class="rank-avatar" 
	      :src="userInfo?.avatar || '/static/imgs/avatar.png'"
	      mode="aspectFill"
	    />
	    <view class="rank-info">
	      <text class="rank-name text-ellipsis">
	        {{ userInfo.nickName || '匿名用户' }}
	      </text>
	      <text class="rank-title">{{ userInfo.title || '历史新手' }}</text>
	    </view>
	    <view class="rank-stats">
	      <text class="stat-acc">获胜{{ userInfo.battlewin || 0 }}场</text>
	      <text class="stat-total">对战{{ userInfo.battlecount || 0 }}场</text>
	    </view>
	  </view>
	  
    </view>
  </view>
</template>

<script setup>
/**
 * 排行榜 - 双维度排序（正确率优先，答题总数次之）
 */
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'

const rankList = ref([])
const myUserId = ref('')
const loading = ref(true)
const userRank = ref("0")
const userInfo = ref(null)

onShow(() => {
  loadRankList()
})

// 加载排行榜数据
async function loadRankList() {
  loading.value = true
  try {
    // 获取当前用户ID
    const cached = uni.getStorageSync('userInfo')
    if (cached && cached._id) {
      myUserId.value = cached._id
    }
    userInfo.value = cached
    uni.showLoading({ title: '加载中...', mask: true })
    const res = await uniCloud.callFunction({
      name: 'getBattleRankList',
      data: {
		  _id:uni.getStorageSync("user_id")
	  }
    })
    uni.hideLoading()
    
    if (res.result && res.result.code === 0) {
      rankList.value = res.result.data || []
	  userRank.value = res.result.userRank || '0'
    } else {
      uni.showToast({ title: res.result?.msg || '加载失败', icon: 'none' })
    }
  } catch (e) {
    uni.hideLoading()
    console.error('[排行榜] 加载异常:', e)
    uni.showToast({ title: '网络异常', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 排名样式（前三名特殊颜色）
function getRankClass(index) {
  if (index === 0) return 'rank-gold'
  if (index === 1) return 'rank-silver'
  if (index === 2) return 'rank-bronze'
  return ''
}

// 格式化正确率
function formatAccuracy(acc) {
  if (acc === undefined || acc === null) return '0.00'
  return (acc * 100).toFixed(2)
}
</script>

<style lang="scss" scoped>
.page-rank {
  box-sizing: border-box;
  height: 100vh;
  background: $bg-color;
  padding: 16rpx 0 180rpx 0;
  position: relative;
}

.my-rank{
  position: absolute;
  left: 16rpx;
  right: 16rpx;
  bottom: 16rpx;
  z-index: 10;
}

.loading-wrap, .empty-wrap {
  display: flex;
  justify-content: center;
  padding-top: 200rpx;
  color: #999;
  font-size: 28rpx;
}

.rank-item {
  display: flex;
  align-items: center;
  padding: 20rpx 20rpx;
  margin: 10rpx 20rpx;
  
  .rank-num {
    width: 56rpx;
    height: 56rpx;
    border-radius: 50%;
    background: #e8e8e8;
    color: #666;
    font-weight: 700;
    font-size: 26rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-right: 16rpx;
  }
  
  .rank-gold { background: #FFD700; color: #fff; }
  .rank-silver { background: #C0C0C0; color: #fff; }
  .rank-bronze { background: #CD853F; color: #fff; }
  
  .rank-avatar {
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
    flex-shrink: 0;
    margin-right: 16rpx;
    background: #f0f0f0;
  }
  
  .rank-info {
    flex: 1;
    overflow: hidden;
    
    .rank-name {
      font-size: 28rpx;
      font-weight: 600;
      color: $text-dark;
      display: block;
    }
    
    .rank-title {
      font-size: 22rpx;
      color: #999;
    }
    
    .me-tag {
      display: inline-block;
      background: $primary-color;
      color: #fff;
      font-size: 20rpx;
      padding: 2rpx 10rpx;
      border-radius: 10rpx;
      margin-left: 8rpx;
    }
  }
  
  .rank-stats {
    text-align: right;
    flex-shrink: 0;
    
    .stat-acc {
      display: block;
      font-size: 30rpx;
      font-weight: 700;
      color: $primary-color;
    }
    
    .stat-total {
      font-size: 22rpx;
      color: #999;
    }
  }
  
  &.is-me {
    background: #E8F6F9;
    border: 2rpx solid $primary-color;
  }
}
</style>