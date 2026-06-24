<template>
  <view class="result-page">
	  <view v-if="!getResult" class="result-loading">
	  	正在获取对战结果......
	  </view>
    <view v-if="getResult" class="result-header">
      <text class="icon">{{ resultIcon }}</text>
      <text class="title">{{ resultText }}</text>
    </view>

    <view class="score-card" v-if="getResult">
      <view class="player">
        <!-- <text class="emoji">😎</text> -->
		<view class="avatarBox">
			<image :src="me.avatar || '/static/imgs/avatar.png'" mode=""></image>
		</view>
        <view>
        	<text class="name">{{ me.nickName }}</text>
        </view>
		<view>
			<text class="score">{{ me.score }} 分</text>
		</view>
      </view>
      <text class="vs">⚡ VS ⚡</text>
      <view class="player">
        <!-- <text class="emoji">🤖</text> -->
		<view class="avatarBox">
			<image :src="opponent.avatar || '/static/imgs/avatar.png'" mode=""></image>
		</view>
        <view>
			<text class="name">{{ opponent.nickName }}</text>
		</view>
		<view>
			<text class="score">{{ opponent.score }} 分</text>
		</view>
      </view>
    </view>

    <view class="actions" v-if="getResult">
      <button class="btn-primary" @click="playAgain">🔄 再来一局</button>
      <button class="btn-secondary" @click="goHome">🏠 返回首页</button>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';

const roomId = ref('');
const me = ref({ nickName: '', score: 0 });
const opponent = ref({ nickName: '', score: 0 });
const winner = ref('me'); // 'me', 'opponent', 'draw'
const getResult = ref(false)

onLoad((opts) => {
  roomId.value = opts.roomId;
  fetchResult();
});

const fetchResult = async () => {
  const res = await uniCloud.callFunction({
    name: 'battle-server',
    data: { action: 'get_result', roomId: roomId.value ,_id:uni.getStorageSync("user_id") }
  });
  if (res.result.code === 0) {
    me.value = res.result.me;
    opponent.value = res.result.opponent;
    winner.value = res.result.winner;
	getResult.value = true
  } else {
    // 如果结果尚未生成，轮询等待（对方可能还未完成）
    const poll = setInterval(async () => {
      const retry = await uniCloud.callFunction({
        name: 'battle-server',
        data: { action: 'get_result', roomId: roomId.value ,_id:uni.getStorageSync("user_id") }
      });
      if (retry.result.code === 0) {
        clearInterval(poll);
        me.value = retry.result.me;
        opponent.value = retry.result.opponent;
        winner.value = retry.result.winner;
      }
    }, 2000);
  }
};

const resultIcon = computed(() => {
  if (winner.value === 'me') return '🏆';
  if (winner.value === 'draw') return '🤝';
  return '💪';
});
const resultText = computed(() => {
  if (winner.value === 'me') return '胜利';
  if (winner.value === 'draw') return '平局';
  return '失败';
});

const playAgain = () => {
  uni.navigateBack({ delta: 1 });
};
const goHome = () => {
  uni.switchTab({ url: '/pages/index/index' });
};
</script>

<style lang="scss" scoped>
.result-page {
  min-height: 100vh;
  background: #FAF8F0;
  padding: 80rpx 30rpx;
  box-sizing: border-box;
}
.result-loading{
	text-align: center;
}
.result-header {
  text-align: center;
  margin-bottom: 60rpx;
  .icon { font-size: 120rpx; display: block; }
  .title { font-size: 52rpx; font-weight: bold; margin-top: 20rpx; }
}
.score-card {
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx 20rpx;
  margin-bottom: 80rpx;
  .player {
    text-align: center;
    .emoji { font-size: 60rpx; display: block; }
    .name { font-weight: bold; margin: 10rpx 0; }
    .score { font-size: 40rpx; color: #62B6CB; font-weight: bold; }
	.avatarBox{
		width: 100rpx;
		height: 100rpx;
		border-radius: 50%;
		overflow: hidden;
		margin: auto;
		>image{
			width: 100%;
			height: 100%;
		}
	}
  }
  .vs { font-size: 36rpx; font-weight: bold; color: #999; }
}
.actions {
  display: flex;
  gap: 30rpx;
  button {
    flex: 1;
    border-radius: 60rpx;
    font-size: 32rpx;
    padding: 20rpx 0;
  }
  .btn-primary { background: #62B6CB; color: #fff; }
  .btn-secondary { background: #fff; border: 2rpx solid #62B6CB; color: #62B6CB; }
}
</style>