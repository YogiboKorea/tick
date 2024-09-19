const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();

// CORS 허용
app.use(cors());
app.use(express.json());

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = 'couponDB';  // MongoDB 데이터베이스는 couponDB로 유지
let db;

// MongoDB 연결
MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(client => {
    console.log('Connected to MongoDB');
    db = client.db(dbName);
  })
  .catch(error => console.error(error));

// 쿠폰 발급 API
app.post('/issue-coupon', async (req, res) => {
  try {
    const { userId, orderNumbers, totalPay } = req.body;

    // 필수 필드 체크
    if (!userId || !orderNumbers || !totalPay) {
      return res.status(400).json({ message: '필수 필드가 누락되었습니다.' });
    }

    // 중복된 주문번호 확인
    const existingCoupon = await db.collection('coupons').findOne({ orderNumbers });
    if (existingCoupon) {
      return res.status(400).json({ message: '이 주문번호에 대해서는 이미 쿠폰이 발급되었습니다.' });
    }

    // 결제 금액에 따른 쿠폰 발급 수량 결정
    let couponsIssued = 0;
    if (totalPay >= 300000) {
      couponsIssued = 3;
    } else if (totalPay >= 200000) {
      couponsIssued = 2;
    } else if (totalPay >= 100000) {
      couponsIssued = 1;
    } else {
      return res.status(400).json({ message: '결제 금액이 부족하여 쿠폰이 발급되지 않았습니다.' });
    }

    // MongoDB의 'coupons' 컬렉션에 쿠폰 데이터 저장
    const result = await db.collection('coupons').insertOne({
      userId,
      orderNumbers,
      totalPay,
      couponsIssued,
      issuedAt: new Date(),
    });

    // 발급된 쿠폰 정보 반환
    res.status(201).json({
      message: '쿠폰이 성공적으로 발급되었습니다.',
      couponId: result.insertedId,
      couponsIssued,
    });
  } catch (error) {
    console.error('쿠폰 발급 오류:', error);
    res.status(500).json({ message: '쿠폰 발급 중 오류가 발생했습니다.' });
  }
});

// 서버 실행
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
