const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { User } = require('../models');

const router = express.Router();

// 邮件配置
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// 登录限制：同一IP每15分钟最多尝试5次
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 最多5次尝试
  message: { message: '登录尝试次数过多，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 邮件限制：同一IP每小时最多发送3封邮件
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 3, // 最多3封邮件
  message: { message: '邮件发送过于频繁，请1小时后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 注册
router.post('/register', [
  body('username')
    .isLength({ min: 3, max: 20 })
    .withMessage('用户名必须为3-20个字符')
    .matches(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/)
    .withMessage('用户名只能包含字母、数字、下划线或中文'),
  body('email')
    .isEmail()
    .withMessage('请输入有效的邮箱地址')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('密码至少6个字符')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .withMessage('密码必须包含至少一个字母和一个数字')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: '输入验证失败',
        errors: errors.array() 
      });
    }

    const { username, email, password } = req.body;

    // 检查用户是否已存在
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: existingUser.email === email ? '该邮箱已被注册' : '该用户名已被使用'
      });
    }

    // 加密密码
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 生成邮箱验证令牌
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');
    const emailVerifyExpires = Date.now() + 24 * 60 * 60 * 1000; // 24小时

    // 创建用户
    const user = new User({
      username,
      email,
      password: hashedPassword,
      emailVerifyToken,
      emailVerifyExpires,
      isEmailVerified: false
    });

    await user.save();

    // 发送验证邮件
    try {
      const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${emailVerifyToken}`;
      
      await transporter.sendMail({
        from: `"${process.env.SITE_NAME || '个人博客'}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '验证您的邮箱地址',
        html: `
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
            <h2 style="color: #333;">欢迎注册${process.env.SITE_NAME || '个人博客'}！</h2>
            <p>感谢您的注册，请点击下面的链接验证您的邮箱地址：</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyUrl}" 
                 style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                验证邮箱
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              如果按钮无法点击，请复制以下链接到浏览器地址栏：<br>
              <a href="${verifyUrl}">${verifyUrl}</a>
            </p>
            <p style="color: #666; font-size: 14px;">
              此链接24小时内有效，过期后请重新申请验证。
            </p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('发送验证邮件失败:', emailError);
      // 邮件发送失败不影响注册
    }

    res.status(201).json({
      success: true,
      message: '注册成功！请查看邮箱完成验证',
      data: {
        userId: user._id,
        username: user.username,
        email: user.email,
        emailSent: true
      }
    });

  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ 
      success: false,
      message: '服务器错误，注册失败' 
    });
  }
});

// 邮箱验证
router.post('/verify-email', [
  body('token').notEmpty().withMessage('验证令牌不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: '验证令牌无效',
        errors: errors.array() 
      });
    }

    const { token } = req.body;

    const user = await User.findOne({
      emailVerifyToken: token,
      emailVerifyExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: '验证链接无效或已过期'
      });
    }

    // 更新用户验证状态
    user.isEmailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();

    // 生成JWT令牌
    const jwtToken = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: '邮箱验证成功！',
      data: {
        token: jwtToken,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          isAdmin: user.isAdmin,
          isEmailVerified: user.isEmailVerified
        }
      }
    });

  } catch (error) {
    console.error('邮箱验证错误:', error);
    res.status(500).json({ 
      success: false,
      message: '服务器错误' 
    });
  }
});

// 重新发送验证邮件
router.post('/resend-verification', emailLimiter, [
  body('email').isEmail().withMessage('请输入有效的邮箱地址')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: '邮箱格式无效',
        errors: errors.array() 
      });
    }

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '该邮箱未注册'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: '该邮箱已经验证过了'
      });
    }

    // 生成新的验证令牌
    const emailVerifyToken = crypto.randomBytes(32).toString('hex');
    const emailVerifyExpires = Date.now() + 24 * 60 * 60 * 1000;

    user.emailVerifyToken = emailVerifyToken;
    user.emailVerifyExpires = emailVerifyExpires;
    await user.save();

    // 发送验证邮件
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${emailVerifyToken}`;
    
    await transporter.sendMail({
      from: `"${process.env.SITE_NAME || '个人博客'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '重新验证您的邮箱地址',
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="color: #333;">重新验证邮箱</h2>
          <p>您请求重新发送验证邮件，请点击下面的链接验证您的邮箱地址：</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              验证邮箱
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            如果按钮无法点击，请复制以下链接到浏览器地址栏：<br>
            <a href="${verifyUrl}">${verifyUrl}</a>
          </p>
          <p style="color: #666; font-size: 14px;">
            此链接24小时内有效，过期后请重新申请验证。
          </p>
        </div>
      `
    });

    res.json({
      success: true,
      message: '验证邮件已重新发送，请查看邮箱'
    });

  } catch (error) {
    console.error('重发验证邮件错误:', error);
    res.status(500).json({ 
      success: false,
      message: '发送邮件失败，请稍后重试' 
    });
  }
});

// 登录
router.post('/login', loginLimiter, [
  body('email').isEmail().withMessage('请输入有效的邮箱地址'),
  body('password').notEmpty().withMessage('密码不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: '输入验证失败',
        errors: errors.array() 
      });
    }

    const { email, password, rememberMe } = req.body;

    // 查找用户
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: '邮箱或密码错误' 
      });
    }

    // 验证密码
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false,
        message: '邮箱或密码错误' 
      });
    }

    // 检查邮箱是否已验证
    if (!user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: '请先验证邮箱后再登录',
        needVerification: true,
        email: user.email
      });
    }

    // 更新最后登录时间
    user.lastLoginAt = new Date();
    await user.save();

    // 生成JWT令牌
    const expiresIn = rememberMe ? '30d' : '7d';
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          isAdmin: user.isAdmin,
          isEmailVerified: user.isEmailVerified
        }
      }
    });

  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ 
      success: false,
      message: '服务器错误' 
    });
  }
});

// 忘记密码
router.post('/forgot-password', emailLimiter, [
  body('email').isEmail().withMessage('请输入有效的邮箱地址')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: '邮箱格式无效',
        errors: errors.array() 
      });
    }

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // 为了安全，不告诉用户邮箱是否存在
      return res.json({
        success: true,
        message: '如果该邮箱已注册，重置密码链接已发送到邮箱'
      });
    }

    // 生成重置密码令牌
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = Date.now() + 60 * 60 * 1000; // 1小时

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await user.save();

    // 发送重置密码邮件
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    await transporter.sendMail({
      from: `"${process.env.SITE_NAME || '个人博客'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '重置您的密码',
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="color: #333;">重置密码</h2>
          <p>您请求重置密码，请点击下面的链接设置新密码：</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              重置密码
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            如果按钮无法点击，请复制以下链接到浏览器地址栏：<br>
            <a href="${resetUrl}">${resetUrl}</a>
          </p>
          <p style="color: #666; font-size: 14px;">
            此链接1小时内有效，如果您没有请求重置密码，请忽略此邮件。
          </p>
        </div>
      `
    });

    res.json({
      success: true,
      message: '如果该邮箱已注册，重置密码链接已发送到邮箱'
    });

  } catch (error) {
    console.error('忘记密码错误:', error);
    res.status(500).json({ 
      success: false,
      message: '发送邮件失败，请稍后重试' 
    });
  }
});

// 重置密码
router.post('/reset-password', [
  body('token').notEmpty().withMessage('重置令牌不能为空'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('密码至少6个字符')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .withMessage('密码必须包含至少一个字母和一个数字')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: '输入验证失败',
        errors: errors.array() 
      });
    }

    const { token, password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: '重置链接无效或已过期'
      });
    }

    // 加密新密码
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 更新用户密码
    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = new Date();
    await user.save();

    // 发送密码重置成功通知邮件
    try {
      await transporter.sendMail({
        from: `"${process.env.SITE_NAME || '个人博客'}" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: '密码重置成功',
        html: `
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
            <h2 style="color: #28a745;">密码重置成功</h2>
            <p>您的密码已成功重置。如果这不是您的操作，请立即联系我们。</p>
            <p style="color: #666; font-size: 14px;">
              重置时间：${new Date().toLocaleString('zh-CN')}
            </p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('发送密码重置成功邮件失败:', emailError);
    }

    res.json({
      success: true,
      message: '密码重置成功，请使用新密码登录'
    });

  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({ 
      success: false,
      message: '服务器错误' 
    });
  }
});

// 修改密码（已登录用户）
router.post('/change-password', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: '未提供认证令牌' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: '用户不存在' 
      });
    }

    const { currentPassword, newPassword } = req.body;

    // 验证当前密码
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: '当前密码错误'
      });
    }

    // 验证新密码
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '新密码至少6个字符'
      });
    }

    if (!/^(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: '新密码必须包含至少一个字母和一个数字'
      });
    }

    // 加密新密码
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    user.password = hashedPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: '密码修改成功'
    });

  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({ 
      success: false,
      message: '服务器错误' 
    });
  }
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: '未提供认证令牌' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: '用户不存在' 
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          isAdmin: user.isAdmin,
          isEmailVerified: user.isEmailVerified
        }
      }
    });

  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(401).json({ 
      success: false,
      message: '无效的认证令牌' 
    });
  }
});

module.exports = router;
