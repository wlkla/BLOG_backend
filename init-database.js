const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { User, Category, Setting } = require('./models');

async function initDatabase() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/personal-blog', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ 数据库连接成功');

    // 创建默认管理员用户
    const adminExists = await User.findOne({ isAdmin: true });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123456', 12);
      
      const adminUser = new User({
        username: 'admin',
        email: 'admin@example.com',
        password: hashedPassword,
        isAdmin: true,
        isEmailVerified: true,
        bio: '网站管理员'
      });

      await adminUser.save();
      console.log('✅ 默认管理员用户创建成功');
      console.log('   用户名: admin');
      console.log('   邮箱: admin@example.com');
      console.log('   密码: admin123456');
      console.log('   ⚠️  请及时修改默认密码！');
    } else {
      console.log('ℹ️  管理员用户已存在');
    }

    // 创建默认分类
    const defaultCategories = [
      {
        name: '技术分享',
        description: '技术相关的文章和教程',
        color: '#007bff'
      },
      {
        name: '生活随笔',
        description: '日常生活的感悟和记录',
        color: '#28a745'
      },
      {
        name: '学习笔记',
        description: '学习过程中的笔记和总结',
        color: '#ffc107'
      },
      {
        name: '项目展示',
        description: '个人项目的展示和分享',
        color: '#dc3545'
      }
    ];

    for (const categoryData of defaultCategories) {
      const existingCategory = await Category.findOne({ name: categoryData.name });
      if (!existingCategory) {
        const category = new Category(categoryData);
        await category.save();
        console.log(`✅ 创建分类: ${categoryData.name}`);
      }
    }

    // 创建默认系统设置
    const defaultSettings = [
      {
        key: 'site_title',
        value: '我的个人博客',
        description: '网站标题',
        category: 'general',
        isPublic: true
      },
      {
        key: 'site_description',
        value: '分享技术、记录生活的个人博客',
        description: '网站描述',
        category: 'general',
        isPublic: true
      },
      {
        key: 'site_keywords',
        value: '个人博客,技术分享,生活随笔',
        description: '网站关键词',
        category: 'seo',
        isPublic: true
      },
      {
        key: 'posts_per_page',
        value: 10,
        description: '每页文章数量',
        category: 'display',
        isPublic: true
      },
      {
        key: 'comment_approval_required',
        value: true,
        description: '评论是否需要审核',
        category: 'comment',
        isPublic: false
      },
      {
        key: 'allow_registration',
        value: false,
        description: '是否允许用户注册',
        category: 'user',
        isPublic: false
      }
    ];

    for (const settingData of defaultSettings) {
      const existingSetting = await Setting.findOne({ key: settingData.key });
      if (!existingSetting) {
        const setting = new Setting(settingData);
        await setting.save();
        console.log(`✅ 创建设置: ${settingData.key}`);
      }
    }

    console.log('🎉 数据库初始化完成！');
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📤 数据库连接已关闭');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;
