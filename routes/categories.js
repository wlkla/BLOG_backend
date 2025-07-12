const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { Category, User } = require('../models');

const router = express.Router();

// 认证中间件
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: '未提供认证令牌' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: '用户不存在' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: '无效的认证令牌' });
  }
};

// 管理员权限中间件
const adminAuth = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: '需要管理员权限' });
  }
  next();
};

// 获取所有分类
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    console.error('获取分类错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取单个分类
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: '分类不存在' });
    }

    res.json(category);
  } catch (error) {
    console.error('获取分类错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 创建分类（管理员）
router.post('/', auth, adminAuth, [
  body('name').notEmpty().withMessage('分类名称不能为空'),
  body('color').isHexColor().withMessage('请输入有效的颜色值')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, color } = req.body;

    // 检查分类名称是否已存在
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({ message: '分类名称已存在' });
    }

    const category = new Category({
      name,
      description,
      color: color || '#007bff'
    });

    await category.save();
    res.status(201).json(category);

  } catch (error) {
    console.error('创建分类错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新分类（管理员）
router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: '分类不存在' });
    }

    const { name, description, color } = req.body;

    // 如果要更改名称，检查是否已存在
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        return res.status(400).json({ message: '分类名称已存在' });
      }
    }

    Object.assign(category, {
      name: name || category.name,
      description: description !== undefined ? description : category.description,
      color: color || category.color
    });

    await category.save();
    res.json(category);

  } catch (error) {
    console.error('更新分类错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 删除分类（管理员）
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: '分类不存在' });
    }

    // 检查是否有文章使用此分类
    const { Post } = require('../models');
    const postsUsingCategory = await Post.countDocuments({ category: req.params.id });
    
    if (postsUsingCategory > 0) {
      return res.status(400).json({ 
        message: `无法删除分类，还有 ${postsUsingCategory} 篇文章正在使用此分类` 
      });
    }

    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: '分类已删除' });

  } catch (error) {
    console.error('删除分类错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;
