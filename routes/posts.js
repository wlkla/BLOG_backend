const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { Post, Category, User } = require('../models');

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

// 获取所有已发布的文章
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const category = req.query.category;
    const search = req.query.search;

    let query = { isPublished: true };
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.$text = { $search: search };
    }

    const posts = await Post.find(query)
      .populate('author', 'username avatar')
      .populate('category', 'name color')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments(query);

    res.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('获取文章错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取单个文章
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username avatar bio')
      .populate('category', 'name color');

    if (!post) {
      return res.status(404).json({ message: '文章不存在' });
    }

    // 如果文章未发布，只有作者或管理员可以查看
    if (!post.isPublished) {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (!token) {
        return res.status(404).json({ message: '文章不存在' });
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user || (!user.isAdmin && user._id.toString() !== post.author._id.toString())) {
          return res.status(404).json({ message: '文章不存在' });
        }
      } catch (error) {
        return res.status(404).json({ message: '文章不存在' });
      }
    }

    // 增加浏览量
    post.viewCount += 1;
    await post.save();

    res.json(post);

  } catch (error) {
    console.error('获取文章错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 创建文章
router.post('/', auth, [
  body('title').notEmpty().withMessage('标题不能为空'),
  body('content').notEmpty().withMessage('内容不能为空'),
  body('category').isMongoId().withMessage('无效的分类ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, content, summary, coverImage, category, tags, isPublished } = req.body;

    // 验证分类是否存在
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({ message: '分类不存在' });
    }

    const post = new Post({
      title,
      content,
      summary,
      coverImage,
      author: req.user._id,
      category,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      isPublished: isPublished || false,
      publishedAt: isPublished ? new Date() : null
    });

    await post.save();
    
    const populatedPost = await Post.findById(post._id)
      .populate('author', 'username avatar')
      .populate('category', 'name color');

    res.status(201).json(populatedPost);

  } catch (error) {
    console.error('创建文章错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新文章
router.put('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: '文章不存在' });
    }

    // 只有作者或管理员可以编辑
    if (post.author.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: '无权限编辑此文章' });
    }

    const { title, content, summary, coverImage, category, tags, isPublished } = req.body;

    // 如果要发布文章，设置发布时间
    if (isPublished && !post.isPublished) {
      post.publishedAt = new Date();
    }

    Object.assign(post, {
      title: title || post.title,
      content: content || post.content,
      summary: summary || post.summary,
      coverImage: coverImage || post.coverImage,
      category: category || post.category,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : post.tags,
      isPublished: isPublished !== undefined ? isPublished : post.isPublished
    });

    await post.save();

    const updatedPost = await Post.findById(post._id)
      .populate('author', 'username avatar')
      .populate('category', 'name color');

    res.json(updatedPost);

  } catch (error) {
    console.error('更新文章错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 删除文章
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: '文章不存在' });
    }

    // 只有作者或管理员可以删除
    if (post.author.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: '无权限删除此文章' });
    }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: '文章已删除' });

  } catch (error) {
    console.error('删除文章错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取我的文章（需要认证）
router.get('/admin/my-posts', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ author: req.user._id })
      .populate('category', 'name color')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({ author: req.user._id });

    res.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('获取我的文章错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

module.exports = router;
