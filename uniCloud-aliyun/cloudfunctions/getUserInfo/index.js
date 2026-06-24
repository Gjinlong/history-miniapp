'use strict';
/**
 * 云函数：getUserInfo
 * 功能：根据微信openid查询用户，不存在则自动创建
 * 返回：{ code: 0, data: 用户对象 } 或 { code: -1, msg: 错误信息 }
 */
const db = uniCloud.database()
const usersCollection = db.collection('users')

const APPID = "wx6c4806f018ac582c"
const APPSECRET = "c3c491ce029cbf5edb8702a4b77b52a5"

exports.main = async (event, context) => {
  try {
    // 1. 获取微信上下文中的openid
    const { type } = event
	if(type === 'id'){
		return getuserInfoById(event.id);
	}else{
		return getuserInfoByCode(event.code);
	}
    
  } catch (e) {
    console.error('[getUserInfo] 异常:', e)
    return { code: -1, msg: '服务异常：' + e.message }
  }
}

async function getuserInfoById(id){
	// 2. 查询用户是否存在
	const res = await usersCollection.where({ _id:id }).get()
	
	if (res.data && res.data.length > 0) {
	  // 用户已存在，直接返回
	  console.log('[getUserInfo] 用户已存在:', res.data[0].nickName)
	  return { code: 0, data: res.data[0] }
	}
}

async function getuserInfoByCode(code){
	// 1、用code换取openid
	const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${APPSECRET}&js_code=${code}&grant_type=authorization_code`
	const sessionRes = await uniCloud.httpclient.request(url, {
	  dataType: "json"
	})
	const { openid } = sessionRes.data
	if (!openid) {
	  return { code: -1, msg: '未能获取微信openid，请在微信小程序中运行' }
	}
	
	console.log('[getUserInfo] openid:', openid)
	
	// 2. 查询用户是否存在
	const res = await usersCollection.where({ openid }).get()
	
	if (res.data && res.data.length > 0) {
	  // 用户已存在，直接返回
	  console.log('[getUserInfo] 用户已存在:', res.data[0].nickName)
	  return { code: 0, data: res.data[0] }
	}
	
	// 3. 用户不存在，创建新用户
	const newUser = {
	  openid: openid,
	  avatar: '',                                    // 默认空头像
	  nickName: '历史探索者',                          // 默认昵称
	  totalAnswer: 0,                                // 总答题数
	  rightCount: 0,                                 // 答对数
	  accuracy: 0,                                   // 正确率（初始0）
	  title: '历史新手',                               // 初始称号
	  errorList: [],                                 // 错题数组
	    battlewin:0,
	  battlelose: 0,
	  draw:0,
	  battlecount:0,
	  createdAt: Date.now(),
	  updatedAt: Date.now()
	}
	
	const addRes = await usersCollection.add(newUser)
	newUser._id = addRes.id
	
	console.log('[getUserInfo] 新用户创建成功:', newUser._id)
	return { code: 0, data: newUser }
}