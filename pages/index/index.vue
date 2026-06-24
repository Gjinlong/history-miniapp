<template>
  <view class="page-index dynamic-bg">
    <!-- 顶部用户信息卡片 -->
    <view class="user-card card" @click="showEditModal = true">
      <image 
        class="avatar" 
        :src="userInfo.avatar || '/static/imgs/avatar.png'" 
        mode="aspectFill"
        @error="onAvatarError"
      />
      <view class="user-info">
        <text class="nickname">{{ userInfo.nickName || '历史探索者' }}</text>
        <view class="title-tag">
          <text>{{ userInfo.title || '历史新手' }}</text>
        </view>
        <text class="stats">
          已答{{ userInfo.totalAnswer || 0 }}题 | 正确率{{ displayAccuracy }}%
        </text>
      </view>
      <text class="edit-hint">✎</text>
    </view>
	
	<view class="img">
		<image src="/static/imgs/bg1.png" alt="xxx" mode="aspectFit"></image>
	</view>

    <!-- 核心答题按钮 -->
    <view class="action-area">
      <view class="btn">
		  <button class="btn-start" @click="goAnswer" hover-class="btn-hover">
		    答题闯关
		  </button>
		  <button class="btn-battle" @click="goBattle" hover-class="btn-hover">
		    好友对战
		  </button>
	  </view>
      <text class="hint-text">随机抽取历史题目，持续闯关挑战！</text>
    </view>

    <!-- 快捷入口 -->
    <view class="quick-links">
      <view class="quick-item card" @click="goRank">
        <text class="icon">🏆</text>
        <text>答题排行榜</text>
      </view>
      <view class="quick-item card" @click="goErrorList">
        <text class="icon">📋</text>
        <text>错题本</text>
      </view>
    </view>

    <!-- 修改用户信息弹窗 -->
    <view v-if="showEditModal" class="modal-mask" @click="showEditModal = false">
      <view class="modal-content card" @click.stop>
        <text class="modal-title">修改个人信息</text>
        <input 
          class="input-field" 
          v-model="editForm.nickName" 
          placeholder="请输入昵称" 
          maxlength="20"
        />
        <!-- <input 
          class="input-field" 
          v-model="editForm.avatar" 
          placeholder="请输入头像URL地址" 
        /> -->
		<view class="chooseAvatarBox" v-if="!avatarUrl">
			<button class="chooseAvatar" open-type="chooseAvatar" @chooseavatar="chooseavatar">点击选择头像</button>
		</view>
		<view class="avatar-box" v-else>
			<image :src="avatarUrl" mode="aspectFill"></image>
		</view>
        <view class="modal-btns">
          <button class="btn-cancel" @click="cancel">取消</button>
          <button class="btn-confirm" @click="doUpdateUserInfo" :disabled="submitting">
            {{ submitting ? '保存中...' : '确认修改' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
/**
 * 首页 - 用户信息展示 + 答题入口
 * 组合式API (script setup)
 */
import { ref, computed } from 'vue'
import { onLoad,onShow,onShareAppMessage,onShareTimeline } from '@dcloudio/uni-app'

// 用户信息响应式数据
const userInfo = ref({
  _id: '',
  openid: '',
  avatar: '',
  nickName: '历史探索者',
  totalAnswer: 0,
  rightCount: 0,
  accuracy: 0,
  title: '历史新手',
  errorList: []
})

// 编辑头像
const avatarUrl = ref("")

// 房间id
const roomId = ref("")

// 弹窗状态
const showEditModal = ref(false)
const submitting = ref(false)
const editForm = ref({ nickName: '', avatar: '' })

// 计算显示正确率
const displayAccuracy = computed(() => {
  const acc = userInfo.value.accuracy
  if (acc === undefined || acc === null || userInfo.value.totalAnswer === 0) return '0.00'
  return (acc * 100).toFixed(2)
})

// 页面加载时读取用户信息
onLoad(({roomid}) => {
  // loadUserInfo()
  // uni.showShareMenu({
	 //  title:getShareTitle(userInfo.value),
	 //  path: '/pages/index/index',
	 //  imageUrl:"/static/imgs/share.png"
  // })
  
  if(roomid) roomId.value = roomid
})

// 每次显示时刷新
onShow(() => {
  loadUserInfo()
})

onShareAppMessage((res) => {
	return {
	  title: getShareTitle(userInfo.value),
	  path: '/pages/index/index',
	  imageUrl:"/static/imgs/share.png"
	}
})

onShareTimeline(() => {
  return {
    title: getShareTitle(userInfo.value),  // 分享标题（必填）
    imageUrl: '/static/imgs/share.png'   // 分享图片（建议 300x300px）
  };
});

const chooseavatar = async (res) => {
	console.log(res.detail.avatarUrl);
	uni.showLoading({ title: '保存中...', mask: true })
	const result = await uniCloud.uploadFile({
		filePath: res.detail.avatarUrl,
		cloudPath:new Date()+'.png'
	});
	if(result){
		uni.hideLoading()
		avatarUrl.value = result.fileID
	}
}

// 加载用户信息（优先从全局/缓存读取）
async function loadUserInfo() {
	// 2. 自动静默登录：检查本地缓存
	const cachedUser = uni.getStorageSync('user_id')
	
	console.log("本地用户信息缓存",cachedUser);
	if (cachedUser) {
	const res = await uniCloud.callFunction({ name: 'getUserInfo', data: {id:cachedUser,type:'id'} })
    userInfo.value = res.result.data
    uni.setStorageSync('userInfo', res.result.data)
	  if(roomId.value != ''){
		  joinRoom(roomId.value)
	  }
	  return
	}
	
	// 3. 无缓存，调用云函数获取/创建用户
	console.log('[App] 无缓存，开始自动登录...')
	await autoLogin()
	// 同时异步刷新云数据库最新数据
	// refreshFromCloud()
}

// 异步从云端刷新用户数据
async function refreshFromCloud() {
  try {
    const res = await uniCloud.callFunction({ name: 'getUserInfo', data: {id:uni.getStorageSync("user_id")} })
    if (res.result && res.result.code === 0) {
      const data = res.result.data
      userInfo.value = { ...userInfo.value, ...data }
      // 更新缓存
      uni.setStorageSync('userInfo', data)
      getApp().globalData.userInfo = data
    }
  } catch (e) {
    console.error('[首页] 刷新用户信息失败:', e)
  }
}

// 自动登录函数
async function autoLogin() {
  try {
    uni.showLoading({ title: '加载中...', mask: true })
    

    wx.login({
      async success (res1) {
        if (res1.code) {
          const res = await uniCloud.callFunction({
            name: 'getUserInfo',
            data: {code:res1.code,type:'code'}
          })
		  
		  uni.hideLoading()
		  console.log('[首页] 获取用户信息成功:', res)
		  if (res.result && res.result.code === 0) {
		    const userInfo1 = res.result.data
		    // 持久化缓存
		    uni.setStorageSync('userInfo', userInfo1)
		    uni.setStorageSync('user_id', userInfo1._id)
			
        userInfo.value = { ...userInfo1}
          // 全局数据
          // getApp().globalData.userInfo = userInfo
          console.log('[App] 自动登录成功:', userInfo1.nickName)
        if(roomId.value != ''){
          joinRoom(roomId.value)
        }
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

// 头像加载失败时使用默认图
function onAvatarError() {
  userInfo.value.avatar = 'https://img.icons8.com/color/96/user-male-circle--v1.png'
}

// 跳转答题页
function goAnswer() {
  uni.navigateTo({ url: '/pages/answer/answer' })
}

// 跳转对战
function goBattle() {
	uni.navigateTo({ url: '/pages/battle-match/battle-match' })
}

// 跳转排行榜
function goRank() {
  uni.navigateTo({ url: '/pages/rank/rank' })
}

// 跳转错题本
function goErrorList() {
  uni.navigateTo({ url: '/pages/error-list/error-list' })
}

// 打开编辑弹窗时预填数据
watch(showEditModal, (val) => {
  if (val) {
    editForm.value.nickName = userInfo.value.nickName || ''
    editForm.value.avatar = userInfo.value.avatar || ''
  }
})

const cancel = () => {
	showEditModal.value = false
	avatarUrl.value = ''
}

// 提交修改用户信息
async function doUpdateUserInfo() {
  if (!editForm.value.nickName.trim()) {
    uni.showToast({ title: '昵称不能为空', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    uni.showLoading({ title: '保存中...', mask: true })
    const res = await uniCloud.callFunction({
      name: 'updateUserInfo',
      data: {
        nickName: editForm.value.nickName.trim(),
        avatar: avatarUrl.value.trim(),
		uid:uni.getStorageSync("user_id")
      }
    })
    uni.hideLoading()
    if (res.result && res.result.code === 0) {
      userInfo.value.nickName = res.result.data.nickName
      userInfo.value.avatar = res.result.data.avatar
      // 更新全局缓存
      const cached = uni.getStorageSync('userInfo') || {}
      cached.nickName = res.result.data.nickName
      cached.avatar = res.result.data.avatar
      uni.setStorageSync('userInfo', cached)
      getApp().globalData.userInfo = cached
      showEditModal.value = false
      uni.showToast({ title: '修改成功', icon: 'success' })
    } else {
      uni.showToast({ title: res.result?.msg || '修改失败', icon: 'none' })
    }
  } catch (e) {
    uni.hideLoading()
    console.error('[首页] 更新用户信息失败:', e)
    uni.showToast({ title: '网络异常', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

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

// 跳转答题页
const goToRoom = (id) => {
  uni.navigateTo({
    url: `/pages/battle-room/battle-room?roomId=${id}`,
	success() {
		roomId.value = ""
	}
  });
};


/**
 * 生成史海识趣分享标题
 * @param {Object} userInfo 响应式用户对象 userInfo.value
 * @returns {String} 适配微信分享的标题（28字内）
 */
function getShareTitle(userInfo) {
  const { nickName, totalAnswer, accuracy } = userInfo
  // 统一格式化正确率，保留整数百分比
  const rateText = `${Math.round(accuracy * 100)}%`
  const name = nickName || "历史爱好者"
  const total = totalAnswer || 0

  // 分段逻辑
  // 低于60分：自嘲搞笑款
  if (accuracy < 0.6) {
    const list = [
      `${name}在史海识趣答完${total}题，正确率仅${rateText}，历史白学了！`,
      `救命！${name}闯史海识趣，${total}道历史题正确率${rateText}`,
      `历史文盲实锤：${name}史海识趣${total}题，正确率${rateText}，求大佬赐教`
    ]
    // 随机返回一条
    return list[Math.floor(Math.random() * list.length)]
  }

  // 80分及以上：凡尔赛学霸款
  if (accuracy >= 0.8) {
    const list = [
      `${name}称霸史海识趣！${total}道历史题正确率${rateText}`,
      `五千年历史了然于心，${name}史海识趣${total}题正确率${rateText}`,
      `历史达人上线！${name}史海识趣${total}题，正确率高达${rateText}`
    ]
    return list[Math.floor(Math.random() * list.length)]
  }

  // 60~79分：PK互动款
  const list = [
    `${name}史海识趣${total}题正确率${rateText}，敢来和我比拼历史吗？`,
    `测测你的历史功底！${name}史海识趣${total}题正确率${rateText}`,
    `谁比我强？${name}史海识趣答${total}题，正确率${rateText}`
  ]
  return list[Math.floor(Math.random() * list.length)]
}


// 引入watch（用于弹窗预填）
import { watch } from 'vue'
</script>

<style lang="scss" scoped>
.page-index {
  height: 100vh;
  background: $bg-color;
  padding: 20rpx 0;
  box-sizing: border-box;
}

.user-card {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  margin: 20rpx 24rpx;
  background: $white;
  border-radius: $card-radius;
  box-shadow: $card-shadow;
  position: relative;
  
  .avatar {
    width: 100rpx;
    height: 100rpx;
    border-radius: 50%;
    border: 3rpx solid $primary-color;
    flex-shrink: 0;
  }
  
  .user-info {
    flex: 1;
    margin-left: 20rpx;
    overflow: hidden;
    
    .nickname {
      font-size: 34rpx;
      font-weight: 600;
      color: $text-dark;
    }
    
    .title-tag {
      display: inline-block;
      background: $primary-color;
      color: $white;
      font-size: 22rpx;
      padding: 4rpx 16rpx;
      border-radius: 20rpx;
      margin: 6rpx 0;
    }
    
    .stats {
      font-size: 24rpx;
      color: $text-light;
      display: block;
    }
  }
  
  .edit-hint {
    font-size: 36rpx;
    color: #bbb;
    padding: 10rpx;
  }
}
.chooseAvatarBox{
	width: 100%;
	height: 100rpx;
}
.chooseAvatar{
	font-size: 28rpx;
	width: 250rpx;
	margin: 0;
}
.avatar-box{
	width: 100%;
	>image{
		width: 100rpx;
		height: 100rpx;
	}
}

.img{
	width: 100%;
	height: calc(100% - 700rpx);
	display: flex;
	justify-content: center;
	>image{
		width: 100%;
		height: 100%;
	}
}



.action-area {
  text-align: center;
  padding: 60rpx 40rpx;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 200rpx;
  .btn{
	  display: flex;
	  justify-content: space-between;
  }
  .btn-battle{
	  display: block;
	  width: 48%;
	  background: linear-gradient(135deg, #aa0000,#62B6CB);
	  color: #fff;
	  font-size: 36rpx;
	  font-weight: 700;
	  border-radius: 60rpx;
	  padding: 28rpx 0;
	  border: none;
	  box-shadow: 0 8rpx 30rpx rgba(98, 182, 203, 0.35);
	  letter-spacing: 2rpx;
	  &::after { border: none; }
  }
  .btn-start {
    display: block;
    width: 48%;
    background: linear-gradient(135deg, #62B6CB, #4DA8B8);
    color: #fff;
    font-size: 36rpx;
    font-weight: 700;
    border-radius: 60rpx;
    padding: 28rpx 0;
    border: none;
    box-shadow: 0 8rpx 30rpx rgba(98, 182, 203, 0.35);
    letter-spacing: 2rpx;
    
    &::after { border: none; }
  }
  
  .btn-hover {
    opacity: 0.85;
    transform: scale(0.97);
  }
  
  .hint-text {
    display: block;
    color: #999;
    font-size: 24rpx;
    margin-top: 20rpx;
  }
}

.quick-links {
  display: flex;
  padding: 0 24rpx;
  gap: 20rpx;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 50rpx;
  .quick-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 30rpx 0;
    font-size: 26rpx;
    color: $text-dark;
    
    .icon {
      font-size: 48rpx;
      margin-bottom: 8rpx;
    }
  }
}

/* 弹窗样式 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.45);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  width: 600rpx;
  background: $white;
  border-radius: 20rpx;
  padding: 40rpx 30rpx;
  
  .modal-title {
    font-size: 32rpx;
    font-weight: 700;
    text-align: center;
    display: block;
    margin-bottom: 30rpx;
  }
  
  .input-field {
    border: 2rpx solid #e8e8e8;
    border-radius: 12rpx;
    padding: 20rpx 16rpx;
    margin-bottom: 20rpx;
    font-size: 28rpx;
    background: #fafafa;
  }
  
  .modal-btns {
    display: flex;
    gap: 20rpx;
    margin-top: 10rpx;
    
    button {
      flex: 1;
      border-radius: 40rpx;
      padding: 18rpx 0;
      font-size: 28rpx;
      border: none;
      
      &::after { border: none; }
    }
    
    .btn-cancel {
      background: #f0f0f0;
      color: #666;
    }
    
    .btn-confirm {
      background: $primary-color;
      color: #fff;
    }
  }
}

</style>