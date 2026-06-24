<template>
  <view class="feedback-page">
    <view class="page-title">
      <text class="icon">💬</text>
      <text>意见反馈</text>
    </view>

    <!-- 星级评分 -->
    <view class="card star-card">
      <text class="card-label">⭐ 评分</text>
      <view class="star-list">
        <text
          v-for="i in 5"
          :key="i"
          class="star"
          :class="{ active: i <= stars }"
          @click="setStars(i)"
        >
          ★
        </text>
      </view>
    </view>

    <view class="card">
      <text class="card-label">📝 微信号</text>
      <input
        class="input-field"
        v-model="wechatId"
        placeholder="请留下您的微信号（选填）"
        maxlength="50"
      />
    </view>

    <!-- 意见标题 -->
    <view class="card">
      <text class="card-label">📝 意见标题</text>
      <input
        class="input-field"
        v-model="title"
        placeholder="请简要描述您的建议（选填）"
        maxlength="50"
      />
    </view>

    <!-- 详细备注 -->
    <view class="card">
      <text class="card-label">📄 详细说明</text>
      <textarea
        class="textarea-field"
        v-model="content"
        placeholder="在这里写下您的具体意见..."
        maxlength="500"
        :show-confirm-bar="false"
      />
    </view>

    <!-- 提交按钮 -->
    <button
      class="submit-btn"
      :disabled="submitting"
      @click="submitFeedback"
    >
      {{ submitting ? '提交中...' : '提交反馈' }}
    </button>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const stars = ref(0)          // 评分
const wechatId = ref('')     // 微信号
const title = ref('')         // 标题
const content = ref('')       // 详细备注
const submitting = ref(false) // 提交状态

// 设置星级
const setStars = (num) => {
  stars.value = num
}

// 提交反馈
const submitFeedback = async () => {
  if (stars.value === 0) {
    uni.showToast({ title: '请先打分', icon: 'none' })
    return
  }
  if (!content.value.trim()) {
    uni.showToast({ title: '请填写详细说明', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const res = await uniCloud.callFunction({
      name: 'submit-feedback',
      data: {
        stars: stars.value,
        wechatId: wechatId.value.trim(),
        title: title.value.trim(),
          content: content.value.trim(),
        _id: uni.getStorageSync('user_id') || ''
      }
    })

    if (res.result && res.result.code === 0) {
      await uni.showToast({ title: '感谢反馈！', icon: 'success',duration: 2000})
      // 重置表单
      stars.value = 0
      title.value = ''
      content.value = ''
      setTimeout(() => {
        uni.navigateBack()
      }, 1500)
    } else {
      uni.showToast({ title: res.result?.msg || '提交失败', icon: 'none' })
    }
  } catch (e) {
    console.error('反馈提交异常', e)
    uni.showToast({ title: '网络异常，请重试', icon: 'none' })
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.feedback-page {
  height: 100vh;
  background: #FAF8F0;
  padding: 30rpx;
  box-sizing: border-box;
}

.page-title {
  text-align: center;
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
  margin: 40rpx 0 50rpx;
  .icon {
    margin-right: 10rpx;
  }
}

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.04);
}

.card-label {
  display: block;
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
  margin-bottom: 20rpx;
}

.star-list {
  display: flex;
  gap: 20rpx;
}

.star {
  font-size: 56rpx;
  color: #ddd;
  transition: 0.2s;
  &.active {
    color: #FFC107;
    transform: scale(1.1);
  }
}

.input-field {
  width: calc(100% - 40rpx);
  height: 80rpx;
  background: #f8f8f8;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  border: none;
}

.textarea-field {
  width: 100%;
  height: 240rpx;
  background: #f8f8f8;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  border: none;
  box-sizing: border-box;
}

.submit-btn {
  background: #62B6CB;
  color: #fff;
  border-radius: 60rpx;
  font-size: 32rpx;
  padding: 24rpx 0;
  margin-top: 40rpx;
  border: none;
  letter-spacing: 4rpx;
  &[disabled] {
    background: #aaa;
  }
}
</style>