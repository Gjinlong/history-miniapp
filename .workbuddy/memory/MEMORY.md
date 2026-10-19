# 项目长期记忆 - 历史答题闯关小程序

## 产品定位
微信小程序（uni-app + uniCloud 阿里云），历史答题闯关类，AppID: wx6c4806f018ac582c。

## 虚拟支付（下载题库）决策
- 主体：个人主体（已完成个人认证 + 备案，服务类目已含"工具"）。
- 需求：首页 + 个人中心增加"下载题库"，付费 3.9 元（GOODS_PRICE=390 分），一次付费、无限下载。
- 导出形态：云端聚合 + 导出 Excel（node-xlsx），前端 wx.openDocument，文件名「史海识趣题库.xlsx」。
- 覆盖范围：安卓 + iOS 双端都做微信虚拟支付；iOS 由 wx.requestVirtualPayment 自动路由到 Apple Pay，前端无需区分平台，不再走客服。iOS 无需 Apple Developer 账号（苹果"小程序合作伙伴计划"由微信作为宿主统一对接，开发者只配微信侧：小程序简称 + 开 Apple IAP 支付开关）。
- 费率：安卓 1%；iOS 12%（苹果佣金，腾讯 5% 2026 限时减免，合计 12%）；个人主体月限额 10 万元。iOS 不支持沙箱，仅现网(env=0)可测，最低 1 元（3.9 元满足）。
- 支付 API：wx.requestVirtualPayment（mode=short_series_goods）；服务端双签名 paySig(HMAC-SHA256/AppKey)+signature(HMAC-SHA256/session_key)；发货靠后台推送 xpay_goods_deliver_notify（安全模式 AES-256-CBC，须幂等）。
- 数据模型：users 加 paidBank/paidAt/orderIds；新建 orders（outTradeNo 唯一索引）。

## 已知技术债
- getUserInfo 云函数硬编码了 AppSecret（且已提交仓库），需挪到 uni-config-center。
