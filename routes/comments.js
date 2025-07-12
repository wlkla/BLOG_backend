const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { Comment, Post, User } = require('../models');

const router = express.Router();

// 认证中间件（可选）
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      req.user = user;
    }
    next();
  } catch (error) {
    next();
  }
};

// 管理员权限中间件
const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: '未提供认证令牌' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: '需要管理员权限' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: '无效的认证令牌' });
  }
};

// 获取文章的评论
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // 验证文章是否存在
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: '文章不存在' });
    }

    // 获取已审核的评论
    const comments = await Comment.find({ 
      post: postId, 
      isApproved: true 
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    const total = await Comment.countDocuments({ 
      post: postId, 
      isApproved: true 
    });

    // 构建评论树结构
    const commentTree = buildCommentTree(comments);

    res.json({
      comments: commentTree,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('获取评论错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 创建评论
router.post('/', [
  body('content').notEmpty().withMessage('评论内容不能为空'),
  body('author.name').notEmpty().withMessage('姓名不能为空'),
  body('author.email').isEmail().withMessage('请输入有效的邮箱地址'),
  body('post').isMongoId().withMessage('无效的文章ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, author, post, parentComment } = req.body;

    // 验证文章是否存在
    const postExists = await Post.findById(post);
    if (!postExists) {
      return res.status(400).json({ message: '文章不存在' });
    }

    // 如果是回复评论，验证父评论是否存在
    if (parentComment) {
      const parentExists = await Comment.findById(parentComment);
      if (!parentExists) {
        return res.status(400).json({ message: '父评论不存在' });
      }
    }

    const comment = new Comment({
      content,
      author: {
        name: author.name,
        email: author.email,
        website: author.website || ''
      },
      post,
      parentComment: parentComment || null,
      isApproved: false, // 默认需要审核
      ip: req.ip || req.connection.remoteAddress
    });

    await comment.save();

    // 更新文章评论数
    await Post.findByIdAndUpdate(post, {
      $inc: { commentCount: 1 }
    });

    res.status(201).json({
      message: '评论已提交，等待审核',
      comment: {
        id: comment._id,
        content: comment.content,
        author: comment.author,
        createdAt: comment.createdAt
      }
    });

  } catch (error) {
    console.error('创建评论错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取待审核的评论（管理员）
router.get('/admin/pending', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({ isApproved: false })
      .populate('post', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({ isApproved: false });

    res.json({
      comments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('获取待审核评论错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 审核评论（管理员）
router.put('/:id/approve', adminAuth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ message: '评论不存在' });
    }

    comment.isApproved = true;
    await comment.save();

    res.json({ message: '评论已审核通过' });

  } catch (error) {
    console.error('审核评论错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 删除评论（管理员）
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ message: '评论不存在' });
    }

    // 删除子评论
    await Comment.deleteMany({ parentComment: req.params.id });
    
    // 删除评论本身
    await Comment.findByIdAndDelete(req.params.id);

    // 更新文章评论数
    const deletedCount = await Comment.countDocuments({ parentComment: req.params.id }) + 1;
    await Post.findByIdAndUpdate(comment.post, {
      $inc: { commentCount: -deletedCount }
    });

    res.json({ message: '评论已删除' });

  } catch (error) {
    console.error('删除评论错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 构建评论树结构的辅助函数
function buildCommentTree(comments) {
  const commentMap = {};
  const rootComments = [];

  // 创建评论映射
  comments.forEach(comment => {
    commentMap[comment._id] = {
      ...comment.toObject(),
      replies: []
    };
  });

  // 构建树结构
  comments.forEach(comment => {
    if (comment.parentComment) {
      const parent = commentMap[comment.parentComment];
      if (parent) {
        parent.replies.push(commentMap[comment._id]);
      }
    } else {
      rootComments.push(commentMap[comment._id]);
    }
  });

  return rootComments;
}

module.exports = router;
