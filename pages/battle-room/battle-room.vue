<template>
  <view class="battle-room">
    <!-- 顶栏：对手信息 + 进度 -->
    <view class="top-bar">
      <view class="opponent-brief">
        <text class="icon">👤</text>
        <text>{{ opponent.nickName }}</text>
      </view>
      <view class="progress">
        <text>对手得分：{{ opponentScore }} | 进度：{{ opponentProgress }}/10</text>
      </view>
    </view>

    <!-- 倒计时与我的得分 -->
    <view class="status-bar">
      <text class="timer" :class="{ warning: timer <= 5 }">🕒 {{ timer }}s</text>
      <text class="my-score">⭐ {{ myScore }} 分</text>
    </view>

    <!-- 题目 -->
    <view class="question-card" v-if="currentQuestion">
      <text class="q-title">{{ currentQuestion.title }}</text>
      <view class="options">
        <view
          v-for="(opt, idx) in currentQuestion.options"
          :key="idx"
          class="option"
          :class="{ selected: selectedIdx === idx, correct: answerReveal && idx === correctIdx, wrong: answerReveal && idx === selectedIdx && idx !== correctIdx }"
          @click="submitAnswer(idx)"
        >
          <text class="label">{{ labels[idx] }}</text>
          <text>{{ opt }}</text>
        </view>
      </view>
    </view>

    <!-- 结果提示 -->
    <view v-if="answerReveal" class="result-tip">
      {{ isCorrect ? '✅ 正确' : '❌ 错误' }}
    </view>

    <!-- 加载或完成 -->
    <view v-if="allDone" class="finished-hint">
      🎯 答题完成，等待对手...
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted,computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';

const labels = ['A', 'B', 'C', 'D'];
const roomId = ref('');
const opponent = ref({ nickName: '对手', avatar: '' });
const opponentScore = ref(0);
const opponentProgress = ref(0);
const questions = ref([]);
const currentIndex = ref(0);
const currentQuestion = computed(() => questions.value[currentIndex.value]);
const timer = ref(30);
const myScore = ref(0);
const selectedIdx = ref(-1);
const answerReveal = ref(false);
const isCorrect = ref(false);
const correctIdx = ref(-1);
const allDone = ref(false);
let timerInterval = null;
let pollInterval = null;

onLoad((opts) => {
  roomId.value = opts.roomId;
  initBattle();
});

const initBattle = async () => {
  // 获取题目
  const res = await uniCloud.callFunction({
    name: 'battle-server',
    data: { action: 'get_questions', roomId: roomId.value ,_id:uni.getStorageSync("user_id")}
  });
  if (res.result.code === 0) {
    questions.value = res.result.questions;
    startTimer();
    // 开始轮询对手
    pollInterval = setInterval(pollOpponent, 2000);
  } else {
    uni.showToast({ title: '获取题目失败', icon: 'none' });
  }
};

// 轮询对手
const pollOpponent = async () => {
  const res = await uniCloud.callFunction({
    name: 'battle-server',
    data: { action: 'get_opponent', roomId: roomId.value ,_id:uni.getStorageSync("user_id") }
  });
  if (res.result.code === 0) {
    opponentScore.value = res.result.opponentScore;
    opponentProgress.value = res.result.opponentProgress;
    opponent.value.nickName = res.result.opponent.nickName;
    if (res.result.status === 'finished') {
      // 对方已结束？应立即跳转结果页
      clearIntervals();
      goToResult();
    }
  }
};

// 倒计时
const startTimer = () => {
  timer.value = 30;
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timer.value--;
    if (timer.value <= 0) {
      clearInterval(timerInterval);
      if (!answerReveal.value) {
        // 超时未答，自动判错
        submitAnswer(-1);
      }
    }
  }, 1000);
};

// 提交答案
const submitAnswer = async (idx) => {
  if (answerReveal.value || allDone.value) return;
  clearInterval(timerInterval);
  answerReveal.value = true;
  selectedIdx.value = idx;
  
  const correct = idx !== -1 && labels[idx] === currentQuestion.value.rightAnswer;
  isCorrect.value = correct;
  correctIdx.value = labels.indexOf(currentQuestion.value.rightAnswer);
  
  // 更新云函数
  await uniCloud.callFunction({
    name: 'battle-server',
    data: {
      action: 'submit_answer',
      roomId: roomId.value,
      questionIndex: currentIndex.value,
      isCorrect: correct,
	  _id:uni.getStorageSync("user_id")
    }
  });
  
  // 刷新自己的得分（也可以前端计算）
  if (correct) myScore.value += 10;
  
  // 0.5秒后跳转下一题
  setTimeout(() => {
    if (currentIndex.value < 9) {
      currentIndex.value++;
      startTimer();
	  answerReveal.value = false;
	  selectedIdx.value = -1;
    } else {
      // 全部答完
      allDone.value = true;
      finishBattle();
    }
  }, 100);
};

// 通知服务器已完成
const finishBattle = async () => {
  await uniCloud.callFunction({
    name: 'battle-server',
    data: { action: 'finish', roomId: roomId.value ,_id:uni.getStorageSync("user_id") }
  });
  // 继续轮询直到对手结束
};

// 跳转结果页
const goToResult = () => {
  uni.redirectTo({
    url: `/pages/battle-result/battle-result?roomId=${roomId.value}`
  });
};

// 切后台主动退出（判负逻辑可在此加强，但轮询版暂简化为不处理）
const clearIntervals = () => {
  clearInterval(timerInterval);
  clearInterval(pollInterval);
};

onUnmounted(async () => {
  clearIntervals();
  await uniCloud.callFunction({
    name: 'battle-server',
    data: { action: 'exit_room', roomId: roomId.value ,_id:uni.getStorageSync("user_id") }
  });
});
</script>

<style lang="scss" scoped>
.battle-room {
  min-height: 100vh;
  background: #FAF8F0;
  padding: 20rpx;
  box-sizing: border-box;
}
.top-bar {
  background: #fff;
  border-radius: 16rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 20rpx;
  display: flex;
  justify-content: space-between;
}
.status-bar {
  display: flex;
  justify-content: space-between;
  font-size: 28rpx;
  margin-bottom: 30rpx;
  .timer { color: #62B6CB; font-weight: bold; }
  .warning { color: #e74c3c; }
  .my-score { color: #333; font-weight: bold; }
}
.question-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  .q-title { font-size: 32rpx; font-weight: bold; margin-bottom: 40rpx; line-height: 1.6; }
}
.option {
  display: flex;
  align-items: center;
  padding: 20rpx;
  border: 2rpx solid #eee;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  font-size: 28rpx;
  .label { width: 50rpx; height: 50rpx; background: #f0f5f6; border-radius: 50%; text-align: center; line-height: 50rpx; margin-right: 16rpx; color: #62B6CB; font-weight: bold; }
  &.selected { border-color: #62B6CB; background: #e8f6f9; }
  &.correct { border-color: #4CAF50; background: #e8f5e9; }
  &.wrong { border-color: #e74c3c; background: #ffebee; }
}
.result-tip { text-align: center; font-size: 36rpx; margin-top: 30rpx; }
.finished-hint { text-align: center; margin-top: 100rpx; font-size: 32rpx; color: #62B6CB; }
</style>