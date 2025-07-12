const mongoose = require('mongoose');

// 用户模型
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  avatar: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    maxlength: 500,
    default: ''
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  // 邮箱验证相关
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerifyToken: {
    type: String
  },
  emailVerifyExpires: {
    type: Date
  },
  // 密码重置相关
  passwordResetToken: {
    type: String
  },
  passwordResetExpires: {
    type: Date
  },
  passwordChangedAt: {
    type: Date
  },
  // 登录相关
  lastLoginAt: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  // 账户状态
  isActive: {
    type: Boolean,
    default: true
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  banReason: {
    type: String
  },
  banExpires: {
    type: Date
  }
}, {
  timestamps: true
});

// 虚拟字段：是否被锁定
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// 索引
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ emailVerifyToken: 1 });
userSchema.index({ passwordResetToken: 1 });

// 中间件：保存前清理过期的令牌
userSchema.pre('save', function(next) {
  // 清理过期的邮箱验证令牌
  if (this.emailVerifyExpires && this.emailVerifyExpires < Date.now()) {
    this.emailVerifyToken = undefined;
    this.emailVerifyExpires = undefined;
  }
  
  // 清理过期的密码重置令牌
  if (this.passwordResetExpires && this.passwordResetExpires < Date.now()) {
    this.passwordResetToken = undefined;
    this.passwordResetExpires = undefined;
  }
  
  next();
});

// 实例方法：增加登录失败次数
userSchema.methods.incLoginAttempts = function() {
  // 如果有之前的锁定且已过期，则重置
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: {
        loginAttempts: 1,
        lockUntil: 1
      }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // 如果超过最大尝试次数且未锁定，则锁定账户
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2小时
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = {
      lockUntil: Date.now() + lockTime
    };
  }
  
  return this.updateOne(updates);
};

// 实例方法：重置登录尝试
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      loginAttempts: 1,
      lockUntil: 1
    }
  });
};

// 静态方法：查找未锁定的用户
userSchema.statics.findByEmail = function(email) {
  return this.findOne({
    email,
    isActive: true,
    isBanned: false,
    $or: [
      { lockUntil: { $exists: false } },
      { lockUntil: { $lt: Date.now() } }
    ]
  });
};

// 分类模型
const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    maxlength: 200,
    default: ''
  },
  color: {
    type: String,
    default: '#007bff',
    match: /^#([0-9A-F]{3}){1,2}$/i
  },
  postCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// 索引
categorySchema.index({ name: 1 });

// 文章模型
const postSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true
  },
  summary: {
    type: String,
    maxlength: 500,
    default: ''
  },
  coverImage: {
    type: String,
    default: ''
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 20
  }],
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: {
    type: Date
  },
  viewCount: {
    type: Number,
    default: 0
  },
  commentCount: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  // SEO 相关
  metaTitle: {
    type: String,
    maxlength: 60
  },
  metaDescription: {
    type: String,
    maxlength: 160
  },
  // 文章状态
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  // 置顶
  isPinned: {
    type: Boolean,
    default: false
  },
  // 排序权重
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// 索引
postSchema.index({ title: 'text', content: 'text', summary: 'text' });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ category: 1, createdAt: -1 });
postSchema.index({ isPublished: 1, publishedAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ isPinned: -1, publishedAt: -1 });

// 虚拟字段：阅读时间估算（基于内容长度）
postSchema.virtual('readingTime').get(function() {
  const wordsPerMinute = 200;
  const wordCount = this.content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
});

// 中间件：保存前自动生成摘要（如果没有提供）
postSchema.pre('save', function(next) {
  if (!this.summary && this.content) {
    // 从内容中提取前150个字符作为摘要
    this.summary = this.content.replace(/<[^>]*>/g, '').substring(0, 150) + '...';
  }
  
  // 如果文章发布但没有发布时间，设置发布时间
  if (this.isPublished && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // 如果文章未发布，清除发布时间
  if (!this.isPublished) {
    this.publishedAt = null;
  }
  
  next();
});

// 评论模型
const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  author: {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    website: {
      type: String,
      trim: true,
      maxlength: 200
    },
    avatar: {
      type: String,
      default: ''
    }
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  ip: {
    type: String
  },
  userAgent: {
    type: String
  },
  // 审核相关
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: {
    type: Date
  },
  // 垃圾评论检测
  isSpam: {
    type: Boolean,
    default: false
  },
  spamScore: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// 索引
commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ author: 1 });
commentSchema.index({ isApproved: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1 });

// 虚拟字段：回复数量
commentSchema.virtual('replyCount', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentComment',
  count: true
});

// 中间件：生成默认头像
commentSchema.pre('save', function(next) {
  if (!this.author.avatar) {
    // 使用 Gravatar 或默认头像
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(this.author.email).digest('hex');
    this.author.avatar = `https://www.gravatar.com/avatar/${hash}?d=identicon&s=80`;
  }
  next();
});

// 标签模型（可选，用于标签管理）
const tagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 20
  },
  description: {
    type: String,
    maxlength: 200,
    default: ''
  },
  color: {
    type: String,
    default: '#6c757d',
    match: /^#([0-9A-F]{3}){1,2}$/i
  },
  postCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

tagSchema.index({ name: 1 });

// 系统设置模型
const settingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    default: 'general'
  },
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

settingSchema.index({ key: 1 });
settingSchema.index({ category: 1 });

// 创建模型
const User = mongoose.model('User', userSchema);
const Category = mongoose.model('Category', categorySchema);
const Post = mongoose.model('Post', postSchema);
const Comment = mongoose.model('Comment', commentSchema);
const Tag = mongoose.model('Tag', tagSchema);
const Setting = mongoose.model('Setting', settingSchema);

// 导出所有模型
module.exports = {
  User,
  Category,
  Post,
  Comment,
  Tag,
  Setting
};
