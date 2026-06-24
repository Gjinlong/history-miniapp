<template>
  <view class="match-page">
    <view class="header">
      <text class="icon">⚔️</text>
      <text class="title">历史对战</text>
    </view>

    <!-- 操作按钮 -->
    <view class="actions" v-if="!matching && !waiting">
      <button class="btn-primary" @click="startRandomMatch">🎲 随机匹配</button>
      <button v-if="creatRoom" class="btn-secondary" @click="createInviteRoom">📨 邀请好友</button>
	  <button v-else class="btn-secondary" open-type="share">📨 转发给好友</button>
    </view>

    <!-- 正在匹配中 -->
    <view v-if="matching" class="matching-area">
      <text class="spinner">⏳</text>
      <text class="tips">正在匹配对手...</text>
      <button class="btn-cancel" @click="cancelMatch">取消匹配</button>
    </view>
	
	<!-- 等待好友 -->
	<view v-if="!creatRoom" class="matching-area">
	  <text class="spinner">⏳</text>
	  <text class="tips">等待好友加入...</text>
	  <button class="btn-cancel" @click="cancelWait">取消等待</button>
	</view>

    <!-- 邀请模式显示房间号 -->
    <view v-if="showRoomCode" class="invite-area">
      <text class="room-label">🏷️ 房间号</text>
      <text class="room-number">{{ roomId }}</text>
      <text class="tips">将房间号分享给好友，进入同一房间即可对战</text>
      <button class="btn-primary" open-type="share" @click="copyRoomId">📋 复制房间号</button>
      <button class="btn-secondary" @click="cancelInvite">取消</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad, onUnload,onShareTimeline,onShareAppMessage } from '@dcloudio/uni-app';

const matching = ref(false);
const creatRoom = ref(true) //创建房间状态
const waiting = ref(false); //等待好友状态
const showRoomCode = ref(false);
const roomId = ref('');
let matchTimer = null;
let checkInterval = null;

// 被邀请者通过带 roomId 参数进入
onLoad((options) => {
  if (options.roomId) {
    joinRoom(options.roomId);
  }
});

// 随机匹配
const startRandomMatch = async () => {
	if(!creatRoom.value){
    // 已经创建房间，提示是否取消等待
    const confirm = await uni.showModal({
      title: '提示',
      content: '您已创建了一个房间，是否取消等待并进行随机匹配？',
      confirmText: '取消等待',
      cancelText: '继续等待'
    });
    if (!confirm.confirm) {
      return; // 用户选择继续等待
    } else {
      cancelWait(); // 取消等待
      await randomMatch();
    }
  } else {
    await randomMatch();
  }
};

// 随机逻辑
const randomMatch = async () => { 
  matching.value = true;
  // 首次调用 random_match
  const res = await uniCloud.callFunction({
    name: 'battle-server',
    data: { action: 'random_match' ,_id:uni.getStorageSync("user_id")}
  });
  if (res.result.code === 0) {
    if (res.result.action === 'match_success') {
      // 立即匹配成功
      matching.value = false;
      goToRoom(res.result.roomId);
    } else {
      // 等待中，开始轮询
      matchTimer = setInterval(async () => {
        const checkRes = await uniCloud.callFunction({
          name: 'battle-server',
          data: { action: 'random_match' ,_id:uni.getStorageSync("user_id")}
        });
        if (checkRes.result.code === 0 && checkRes.result.action === 'match_success') {
          clearInterval(matchTimer);
          matching.value = false;
          goToRoom(checkRes.result.roomId);
        }
      }, 2000);
    }
  } else {
    matching.value = false;
    uni.showToast({ title: res.result.msg || '匹配失败', icon: 'none' });
  }
};

// 创建邀请房间
const createInviteRoom = async () => {
	uni.showLoading({
		title:"正在创建房间"
	})
  const res = await uniCloud.callFunction({
    name: 'battle-server',
    data: { action: 'create_room',_id:uni.getStorageSync("user_id") }
  });
  if (res.result.code === 0) {
    roomId.value = res.result.roomId;
    creatRoom.value = false;
	uni.hideLoading()
	uni.showToast({
		title:"创建成功"
	})
    // 轮询对手加入
    checkInterval = setInterval(async () => {
      const check = await uniCloud.callFunction({
        name: 'battle-server',
        data: { action: 'get_opponent', roomId: roomId.value,_id:uni.getStorageSync("user_id") }
      });
      if (check.result.code === 0 && check.result.status === 'battling') {
        clearInterval(checkInterval);
        goToRoom(roomId.value);
      }
    }, 2000);
  }
};

// 加入房间
const joinRoom = async (id) => {
  const res = await uniCloud.callFunction({
    name: 'battle-server',
    data: { action: 'join_room', roomId: id ,_id:uni.getStorageSync("user_id")}
  });
  if (res.result.code === 0) {
    goToRoom(id);
  } else {
    uni.showToast({ title: res.result.msg, icon: 'none' });
  }
};

// 取消匹配
const cancelMatch = async () => {
  if (matchTimer) clearInterval(matchTimer);
  matching.value = false;
  await uniCloud.callFunction({
    name: 'battle-server',
    data: { action: 'cancel_match' ,_id:uni.getStorageSync("user_id")}
  });
};

// 取消等待
const cancelWait = async () => {
  if(checkInterval) clearInterval(checkInterval);
  creatRoom.value = true;
  await uniCloud.callFunction({
    name: 'battle-server',
    data: { action: 'cancel_waitfriend' ,_id:uni.getStorageSync("user_id")}
  });
};

// 取消邀请
const cancelInvite = () => {
  if (checkInterval) clearInterval(checkInterval);
  showRoomCode.value = false;
};

// 跳转答题页
const goToRoom = (id) => {
  uni.navigateTo({
    url: `/pages/battle-room/battle-room?roomId=${id}`,
	success() {
		if (matchTimer) clearInterval(matchTimer);
		if (checkInterval) clearInterval(checkInterval);
		matching.value = false;
		creatRoom.value = true;
		waiting.value = false;
	}
  });
};

// 复制房间号
const copyRoomId = () => {
  uni.setClipboardData({ data: roomId.value, success: () => {
    uni.showToast({ title: '房间号已复制' });
  }});
};

const friendPath = ref("/pages/index/index")
const queryPath = ref("")

onShareAppMessage((res) => {
	if(res.from == 'button') friendPath.value = '/pages/index/index?roomid='+roomId.value
	return {
	  title: "敢来和我单挑一局？速来应战！",
	  path: friendPath.value,
	  imageUrl:"/static/imgs/share.png",
	  success() {
	  	waiting.value = true
	  }
	}
})

onShareTimeline((res) => {
	if(res.from == 'button') queryPath.value = 'roomid='+roomId.value
  return {
    title: "在线求单挑，有没有高手来对战",  // 分享标题（必填）
	query:queryPath.value,
    imageUrl: '/static/imgs/share.png',
	  success() {
	  	waiting.value = true
	  }
  };
});

onUnload(() => {
  if (matchTimer) clearInterval(matchTimer);
  if (checkInterval) clearInterval(checkInterval);
});
</script>

<style lang="scss" scoped>
.match-page {
  min-height: 100vh;
  background: #FAF8F0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 40rpx;
  box-sizing: border-box;
}
.header {
  text-align: center;
  margin-bottom: 80rpx;
  .icon { font-size: 100rpx; display: block; }
  .title { font-size: 48rpx; color: #62B6CB; font-weight: bold; margin-top: 20rpx; }
}
.actions {
  width: 100%;
  button { margin: 20rpx 0; font-size: 32rpx; padding: 24rpx 0; border-radius: 60rpx; }
}
.btn-primary { width:100%;background: #62B6CB; color: #fff; }
.btn-secondary { background: #fff; border: 2rpx solid #62B6CB; color: #62B6CB; }
.matching-area, .invite-area {
  text-align: center;
  margin-top: 50rpx;
  .spinner { font-size: 80rpx; animation: spin 1s linear infinite; }
  .tips { display: block; margin: 20rpx 0; color: #999; }
}
.room-label { font-size: 28rpx; color: #666; }
.room-number { font-size: 80rpx; font-weight: bold; color: #62B6CB; letter-spacing: 10rpx; }
.btn-cancel { background: #eee; color: #666; margin-top: 30rpx; }
@keyframes spin { 100% { transform: rotate(360deg); } }
</style>