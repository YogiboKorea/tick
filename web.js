require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const cors = require('cors');

const app = express();

// CORS 허용 설정
app.use(cors({
  origin: '*'  // 필요에 따라 특정 도메인으로 제한 가능
}));

// MongoDB 연결 URI 설정: 로컬을 기본으로 사용하며, 환경 변수를 통해 외부 데이터베이스로 전환 가능
const url = process.env.MONGODB_URI || 'mongodb://localhost:27017';  // 로컬 MongoDB
const dbName = 'ticket';
let db;

// MongoDB 연결 (옵션 삭제)
MongoClient.connect(url)
  .then(client => {
    console.log('Connected to MongoDB at', url);
    db = client.db(dbName);
  })
  .catch(error => {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);  // MongoDB 연결 실패 시 프로세스 종료
  });

// JSON 파싱 미들웨어
app.use(express.json());

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// 티켓 발급 API
app.post('/issue-ticket', async (req, res) => {
  try {
    const { userId, orderNumbers, amountPaid } = req.body;

    // 오늘 날짜의 시작과 끝 시간 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 자정
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // 다음날 자정

    // 당일 이미 발급된 티켓이 있는지 확인
    const existingTicket = await db.collection('tickets').findOne({
      userId,
      issuedAt: { $gte: today, $lt: tomorrow }, // 오늘 날짜에 발급된 티켓 검색
    });

    if (existingTicket) {
      return res.status(400).json({ message: '오늘은 이미 티켓이 발급되었습니다.' });
    }

    // 결제 금액에 따른 티켓 발급 수량 결정
    let ticketsIssued = 0;

    if (amountPaid >= 300000) {
      ticketsIssued = 3; // 30만 원 이상일 때 3장 발급
    } else if (amountPaid >= 200000) {
      ticketsIssued = 2; // 20만 원 이상일 때 2장 발급
    } else if (amountPaid >= 100000) {
      ticketsIssued = 1; // 10만 원 이상일 때 1장 발급
    } else {
      return res.status(400).json({ message: '결제 금액이 부족하여 티켓이 발급되지 않았습니다.' });
    }

    // MongoDB에 티켓 데이터 저장
    const result = await db.collection('tickets').insertOne({
      userId,
      orderNumbers,
      amountPaid,
      ticketsIssued,
      issuedAt: new Date(),
    });

    // 발급된 티켓 정보 반환
    res.status(201).json({
      message: '티켓이 성공적으로 발급되었습니다.',
      ticketId: result.insertedId,
      ticketsIssued,
    });
  } catch (error) {
    console.error('티켓 발급 오류:', error);
    res.status(500).json({ message: '티켓 발급 중 오류가 발생했습니다.' });
  }
});

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
