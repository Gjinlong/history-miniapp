'use strict';
const db = uniCloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action,_id } = event;
  const user = await getUserByOpenid(_id);
  if (!user) return { code: -1, msg: '用户不存在' };

  switch (action) {
    case 'random_match':     return handleRandomMatch(user);
    case 'create_room':      return handleCreateRoom(user);
    case 'join_room':        return handleJoinRoom(user, event.roomId);
    case 'get_questions':    return handleGetQuestions(user, event.roomId);
    case 'submit_answer':    return handleSubmitAnswer(user, event.roomId, event.questionIndex, event.isCorrect);
    case 'get_opponent':     return handleGetOpponent(user, event.roomId);
    case 'finish':           return handleFinish(user, event.roomId);
    case 'get_result':       return handleGetResult(user, event.roomId);
    case 'cancel_match':     return handleCancelMatch(user);
    case 'cancel_waitfriend': return handleCancelWaitFriend(user);
    case 'exit_room':       return handleExitRoom(user, event.roomId);
	case 'get_battle_count': return handleGetBattleCount(user);
    default: return { code: -1, msg: '未知操作' };
  }
};

// 获取用户
async function getUserByOpenid(_id) {
  const res = await db.collection('users').where({ _id }).get();
  return res.data[0] || null;
}

// 随机匹配
async function handleRandomMatch(user) {
  // 检查是否已在匹配池中
  let pool = await db.collection('match_pool').where({ userId: user._id }).get();
  if (pool.data.length > 0) {
    // 已在池中，返回房间ID（可能已配对）
    const roomId = pool.data[0].roomId;
    if (roomId) {
      const room = await db.collection('rooms').where({ roomId }).get();
      if (room.data.length && room.data[0].status === 'battling') {
        return { code: 0, action: 'match_success', roomId };
      }
    }
    return { code: 0, action: 'waiting' };
  }
  
  // 查找等待中的其他人
  const waiting = await db.collection('match_pool').where({ roomId: null }).limit(1).get();
  if (waiting.data.length > 0) {
    const opponentUser = await db.collection('users').doc(waiting.data[0].userId).get();
    const opponent = opponentUser.data[0];
    // 创建房间
    const roomId = Date.now().toString();
    await db.collection('rooms').add({
      roomId,
      users: [user._id, opponent._id],
      status: 'battling',
      questions: null,
      answers: {},
      startTime: Date.now(),
    });
    // 更新匹配池：双方都标记已配对
    await db.collection('match_pool').where({ userId: user._id }).update({ roomId });
    await db.collection('match_pool').where({ userId: opponent._id }).update({ roomId });
    return { code: 0, action: 'match_success', roomId };
  } else {
    // 加入等待池
    await db.collection('match_pool').add({ userId: user._id, roomId: null, createdAt: Date.now() });
    return { code: 0, action: 'waiting' };
  }
}

// 取消匹配
async function handleCancelMatch(user) {
  await db.collection('match_pool').where({ userId: user._id }).remove();
  return { code: 0 };
}

// 取消等待好友
async function handleCancelWaitFriend(user) {
  await db.collection('rooms').where({ 
	  creator: user._id,
	  status:'waiting'
  }).remove();
  return { code: 0 };
}

// 创建邀请房间
async function handleCreateRoom(user) {
  const roomId = Date.now().toString();
  await db.collection('rooms').add({
    roomId,
    creator: user._id,
    users: [user._id],
    status: 'waiting',
    questions: null,
    answers: {},
  });
  return { code: 0, action: 'room_created', roomId };
}

// 加入邀请房间
async function handleJoinRoom(user, roomId) {
  const room = await db.collection('rooms').where({ roomId, status: 'waiting' }).get();
  if (!room.data.length) return { code: -1, msg: '房间不存在或已开始' };
  const roomData = room.data[0];
  if (roomData.users.length >= 2) return { code: -1, msg: '房间已满' };
  // 加入并开始
  await db.collection('rooms').doc(roomData._id).update({
    users: _.push(user._id),
    status: 'battling',
    startTime: Date.now(),
  });
  return { code: 0, action: 'match_success', roomId };
}

// 获取题目（首次进入答题页调用）
async function handleGetQuestions(user, roomId) {
  const room = await db.collection('rooms').where({ roomId }).get();
  if (!room.data.length) return { code: -1, msg: '房间不存在' };
  const roomData = room.data[0];
  // 如果已有题目，直接返回
  if (roomData.questions) {
    const questions = await db.collection('question').where({ _id: _.in(roomData.questions) }).get();
    return { code: 0, questions: questions.data };
  }
  // 没有则随机抽取10题
  const qs = await db.collection('question').aggregate().sample({ size: 10 }).end();
  const questionIds = qs.data.map(q => q._id);
  await db.collection('rooms').doc(roomData._id).update({ questions: questionIds });
  return { code: 0, questions: qs.data };
}

// 提交答案
async function handleSubmitAnswer(user, roomId, questionIndex, isCorrect) {
  const room = await db.collection('rooms').where({ roomId }).get();
  if (!room.data.length) return { code: -1, msg: '房间不存在' };
  const roomData = room.data[0];
  const answers = roomData.answers || {};
  if (!answers[user._id]) answers[user._id] = [];
  answers[user._id][questionIndex] = { isCorrect, time: Date.now() };
  // 计算得分
  let score = 0;
  const myAnswers = answers[user._id];
  myAnswers.forEach((item, idx) => {
    if (item && item.isCorrect) score += 10;
  });
  await db.collection('rooms').doc(roomData._id).update({ answers });
  // 检查是否双方都完成10题
  const opponentId = roomData.users.find(id => id !== user._id);
  const opponentAnswers = answers[opponentId];
  if (opponentAnswers && opponentAnswers.length === 10 && myAnswers.length === 10) {
    await settleBattle(user,roomData, answers);
  }
  return { code: 0, myScore: score };
}

// 用户中途退出房间，视为认输，剩余题目答题结果全部填充为false，答题完成
async function handleExitRoom(user, roomId) {
  const room = await db.collection('rooms').where({ roomId }).get();
  if (!room.data.length) return { code: -1, msg: '房间不存在' };
  const roomData = room.data[0];
  const answers = roomData.answers || {};
  if (!answers[user._id]) answers[user._id] = [];
  // 填充剩余题目为false
  for (let i = 0; i < 10; i++) {
    if (!answers[user._id][i]) {
      answers[user._id][i] = { isCorrect: false, time: Date.now() };
    }
  }
  await db.collection('rooms').doc(roomData._id).update({ answers });
  return { code: 0, exited: true };
}


// 查询对手状态
async function handleGetOpponent(user, roomId) {
  const room = await db.collection('rooms').where({ roomId }).get();
  if (!room.data.length) return { code: -1, msg: '房间不存在' };
  const roomData = room.data[0];
  const opponentId = roomData.users.find(id => id !== user._id);
  if(opponentId != undefined){
	  const opponent = await db.collection('users').doc(opponentId).get();
	  const answers = roomData.answers || {};
	  const myAnswers = answers[user._id] || [];
	  const oppAnswers = answers[opponentId] || [];
	  let oppScore = 0, oppProgress = oppAnswers.length;
	  oppAnswers.forEach(item => { if (item && item.isCorrect) oppScore += 10; });
	  return {
	    code: 0,
	    opponent: { nickName: opponent.data[0].nickName, avatar: opponent.data[0].avatar },
	    opponentScore: oppScore,
	    opponentProgress:oppProgress,
	    status: roomData.status,
	  };
  }else{
	  return { code: -1, msg: '等待好友加入' };
  }
}

// 用户完成答题
async function handleFinish(user, roomId) {
  const room = await db.collection('rooms').where({ roomId }).get();
  if (!room.data.length) return { code: -1, msg: '房间不存在' };
  const roomData = room.data[0];
  const answers = roomData.answers || {};
  if (!answers[user._id]) answers[user._id] = [];
  // 标记完成（仅当答够10题）
  if (answers[user._id].length < 10) return { code: -1, msg: '未完成所有题目' };
  // 检查对方是否也完成
  const opponentId = roomData.users.find(id => id !== user._id);
  const opponentAnswers = answers[opponentId] || [];
  if (opponentAnswers.length === 10) {
    await settleBattle(user,roomData, answers);
  }
  return { code: 0, finished: true };
}

// 结算对战
async function settleBattle(user,roomData, answers) {
  const users = roomData.users;
  const scores = {};
  users.forEach(userId => {
    let score = 0;
    const ans = answers[userId] || [];
    ans.forEach(item => { if (item && item.isCorrect) score += 10; });
    scores[userId] = score;
  });
  // 判定胜负：得分高胜，同分则先完成者胜（比较最后一题时间）
  let winner = null;
  if (scores[users[0]] > scores[users[1]]) winner = users[0];
  else if (scores[users[1]] > scores[users[0]]) winner = users[1];
  else {
    // 平局
    winner = 'draw';
  }

  // 更新 battle 集合
  await db.collection('battle').add({
    roomId: roomData.roomId,
    users,
    scores,
    winner,
    createdAt: Date.now(),
  });
  // 更新用户对战统计（略，需完善）
  // 更新房间状态
  await db.collection('rooms').where({ roomId: roomData.roomId }).update({ status: 'finished', winner });
  // 清理匹配池
  users.forEach(async (userId) => {
    await db.collection('match_pool').where({ userId }).remove();
  });

  handleGetBattleCount(users); // 更新用户对战统计
}

// 获取对战结果
async function handleGetResult(user, roomId) {
  const battle = await db.collection('battle').where({ roomId }).get();
  if (!battle.data.length) return { code: -1, msg: '结果未生成' };
  const battleData = battle.data[0];
  const myScore = battleData.scores[user._id];
  const opponentId = battleData.users.find(id => id !== user._id);
  const opponentScore = battleData.scores[opponentId];
  const me = await db.collection('users').doc(user._id).get();
  const opponent = await db.collection('users').doc(opponentId).get();
  let winner = 'me';
  if (battleData.winner === 'draw') winner = 'draw';
  else if (battleData.winner !== user._id) winner = 'opponent';
  return {
    code: 0,
    me: { nickName: me.data[0].nickName, avatar: me.data[0].avatar, score: myScore },
    opponent: { nickName: opponent.data[0].nickName, avatar: opponent.data[0].avatar, score: opponentScore },
    winner,
  };
}

// 获取用户对战数据，总对战数，胜场数，失败数，平局数，并更新到users表中
async function handleGetBattleCount(users) {
  users.forEach(async (id) => {
	  const battles = await db.collection('rooms').where({ users: _.in([id]) }).get();
	  const battleCount = battles.data.length;
	  let battleWin = 0, battleLose = 0, draw = 0;
	  // 去掉battles中，winner为空的
	  battles.data = battles.data.filter(battle => battle.winner);
	  battles.data.forEach(battle => {
	    if (battle.winner === 'draw') draw++;
	    else if (battle.winner === id) battleWin++;
	    else battleLose++;
	  });
	  // 更新用户数据
	  await db.collection('users').doc(id).update({
	    battlecount: battleCount,
	    battlewin: battleWin,
	    battlelose: battleLose,
	    draw: draw,
	  });
	  return { code: 0, battleCount, battleWin, battleLose, draw };
  })
}