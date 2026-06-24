<template>
  <view class="page-answer">
    <!-- 加载状态 -->
    <view v-if="loading" class="loading-wrap">
      <text class="loading-text">加载题目中...</text>
    </view>

    <!-- 题目区域 -->
    <view v-else-if="question" class="question-area">
      <!-- 进度提示 -->
      <view class="progress-bar">
        <text>当前已答：{{ answerCount }} 题</text>
        <text class="accuracy">正确率：{{ currentAccuracy }}%</text>
      </view>

      <!-- 题干卡片 -->
      <view class="question-card card">
        <text class="q-label">📜 历史题目</text>
        <text class="q-title">{{ question.title }}</text>
      </view>

      <!-- 选项列表 -->
      <view class="options-list">
        <view 
          v-for="(opt, index) in question.options" 
          :key="index"
          class="option-item card"
          :class="{
            'option-correct': answered && labels[index] === question.rightAnswer,
            'option-wrong': answered && selectedIndex === index && labels[index] !== question.rightAnswer,
            'option-disabled': answered
          }"
          @click="selectOption(index)"
        >
          <view class="option-label">{{ labels[index] }}</view>
          <text class="option-text">{{ opt }}</text>
          <text v-if="answered && labels[index] === question.rightAnswer" class="icon-correct">✅</text>
          <text v-if="answered && selectedIndex === index && labels[index] !== question.rightAnswer" class="icon-wrong">❌</text>
        </view>
      </view>

      <!-- 结果反馈 -->
      <view v-if="answered" class="feedback-area">
        <view v-if="isCorrect" class="feedback-correct">
          🎉 回答正确！太棒了！
        </view>
        <view v-else class="feedback-wrong">
          😔 回答错误，正确答案是：<text class="right-answer">{{ question.rightAnswer }}</text>
        </view>
      </view>
    </view>

    <!-- 题目加载失败 -->
    <view v-else class="empty-wrap">
      <text>暂无题目数据，请联系管理员添加题库</text>
      <button class="btn-retry" @click="loadQuestion">重新加载</button>
    </view>

    <!-- 底部操作 -->
    <view class="bottom-bar">
      <button class="btn-back" @click="goBack">返回首页</button>
      <button v-if="answered" class="btn-next" @click="nextQuestion">
        下一题 →
      </button>
    </view>
  </view>
</template>

<script setup>
/**
 * 答题页 - 随机出题、判断对错、自动切换
 */
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

const labels = ['A', 'B', 'C', 'D']

const question = ref(null)        // 当前题目
const loading = ref(true)         // 加载状态
const answered = ref(false)       // 是否已作答
const selectedIndex = ref(-1)     // 用户选择的选项索引
const isCorrect = ref(false)      // 是否答对
const answerCount = ref(0)        // 本轮答题数
const correctCount = ref(0)       // 本轮答对数

// 当前正确率
const currentAccuracy = computed(() => {
  if (answerCount.value === 0) return '0.00'
  return ((correctCount.value / answerCount.value) * 100).toFixed(2)
})

onLoad(() => {
  loadQuestion()
})

// 加载随机题目
async function loadQuestion() {
  loading.value = true
  answered.value = false
  selectedIndex.value = -1
  isCorrect.value = false
  
  try {
    uni.showLoading({ title: '加载题目...', mask: true })
    const res = await uniCloud.callFunction({
      name: 'getRandomQuestion',
      data: {
		  _id:uni.getStorageSync("user_id")
	  }
    })
    uni.hideLoading()
    
    if (res.result && res.result.code === 0 && res.result.data) {
      question.value = res.result.data
      loading.value = false
    } else {
      uni.hideLoading()
      loading.value = false
      question.value = null
      uni.showToast({ title: res.result?.msg || '获取题目失败', icon: 'none' })
    }
  } catch (e) {
    uni.hideLoading()
    loading.value = false
    question.value = null
    console.error('[答题页] 加载题目异常:', e)
    uni.showToast({ title: '网络异常，请重试', icon: 'none', duration: 2000 })
  }
}

// 用户选择选项
async function selectOption(index) {
  if (answered.value || !question.value) return
  
  answered.value = true
  selectedIndex.value = index
  const userAnswer = labels[index]
  const correctAnswer = question.value.rightAnswer
  isCorrect.value = (userAnswer === correctAnswer)
  
  answerCount.value++
  if (isCorrect.value) correctCount.value++
  
  // 调用云函数提交答案
  try {
    const res = await uniCloud.callFunction({
      name: 'addRecord',
      data: {
        questionId: question.value._id,
        userAnswer: userAnswer,
        isCorrect: isCorrect.value,
		uid:uni.getStorageSync("user_id")
      }
    })
    
    if (res.result && res.result.code === 0) {
      // 更新本地用户缓存
      if (res.result.data) {
        uni.setStorageSync('userInfo', res.result.data)
        getApp().globalData.userInfo = res.result.data
      }
    } else {
      console.warn('[答题页] 提交答案返回异常:', res.result)
    }
  } catch (e) {
    console.error('[答题页] 提交答案失败:', e)
    // 即使提交失败也不阻断答题流程
  }
}

// 加载下一题
function nextQuestion() {
  loadQuestion()
}

// 返回首页
function goBack() {
  uni.navigateBack({
    delta: 1,
    fail: () => {
      uni.switchTab({ url: '/pages/index/index' })
    }
  })
}
</script>

<style lang="scss" scoped>
.page-answer {
  min-height: 100vh;
  background: $bg-color;
  padding-bottom: 120rpx;
  box-sizing: border-box;
}

.loading-wrap, .empty-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
  color: #999;
  font-size: 28rpx;
  
  .btn-retry {
    margin-top: 30rpx;
    background: $primary-color;
    color: #fff;
    border-radius: 40rpx;
    padding: 16rpx 40rpx;
    font-size: 26rpx;
    border: none;
    &::after { border: none; }
  }
}

.progress-bar {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 30rpx;
  font-size: 24rpx;
  color: $text-light;
  
  .accuracy {
    color: $primary-color;
    font-weight: 600;
  }
}

.question-card {
  margin: 16rpx 24rpx;
  padding: 28rpx;
  
  .q-label {
    font-size: 22rpx;
    color: $primary-color;
    display: block;
    margin-bottom: 10rpx;
  }
  
  .q-title {
    font-size: 32rpx;
    font-weight: 600;
    color: $text-dark;
    line-height: 1.7;
  }
}

.options-list {
  padding: 0 24rpx;
  
  .option-item {
    display: flex;
    align-items: center;
    padding: 22rpx 20rpx;
    margin-bottom: 16rpx;
    border: 2rpx solid transparent;
    transition: all 0.2s;
    
    .option-label {
      width: 50rpx;
      height: 50rpx;
      border-radius: 50%;
      background: #f0f5f6;
      color: $primary-color;
      font-weight: 700;
      font-size: 26rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-right: 16rpx;
    }
    
    .option-text {
      flex: 1;
      font-size: 28rpx;
      color: $text-dark;
    }
    
    .icon-correct, .icon-wrong {
      font-size: 32rpx;
      margin-left: 10rpx;
    }
  }
  
  .option-correct {
    border-color: #4CAF50;
    background: #E8F5E9;
    .option-label { background: #4CAF50; color: #fff; }
  }
  
  .option-wrong {
    border-color: #F44336;
    background: #FFEBEE;
    .option-label { background: #F44336; color: #fff; }
  }
  
  .option-disabled {
    pointer-events: none;
    opacity: 0.9;
  }
}

.feedback-area {
  margin: 20rpx 24rpx;
  padding: 20rpx 24rpx;
  border-radius: $card-radius;
  text-align: center;
  font-size: 28rpx;
  
  .feedback-correct {
    background: #E8F5E9;
    color: #2E7D32;
    padding: 20rpx;
    border-radius: $card-radius;
  }
  
  .feedback-wrong {
    background: #FFF3E0;
    color: #E65100;
    padding: 20rpx;
    border-radius: $card-radius;
    
    .right-answer {
      font-weight: 700;
      color: #D32F2F;
    }
  }
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background: $white;
  box-shadow: 0 -2rpx 16rpx rgba(0,0,0,0.05);
  gap: 20rpx;
  
  button {
    flex: 1;
    border-radius: 40rpx;
    padding: 20rpx 0;
    font-size: 28rpx;
    border: none;
    &::after { border: none; }
  }
  
  .btn-back {
    background: #f0f0f0;
    color: #666;
  }
  
  .btn-next {
    background: $primary-color;
    color: #fff;
  }
}
</style>