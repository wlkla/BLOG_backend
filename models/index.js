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

const User = mongoose.model('User', userSchema);

module.exports = User;
