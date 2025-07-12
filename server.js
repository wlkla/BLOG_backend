const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100 // 限制每个 IP 每 15 分钟最多 100 个请求
});
app.use('/api/', limiter);

// 静态文件服务
app.use('/uploads', express.static('uploads'));

// 数据库连接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/personal-blog', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ 数据库连接成功'))
.catch(err => console.error('❌ 数据库连接失败:', err));

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/comments', require('./routes/comments'));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: '服务器运行正常' });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ message: '接口不存在' });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: '服务器内部错误' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`);
});
