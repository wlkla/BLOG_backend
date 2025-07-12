import React, { useState, useEffect } from 'react';
import { User, FileText, MessageSquare, Tag, TrendingUp, Calendar, Eye, Users } from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalUsers: 0,
    totalComments: 0,
    totalCategories: 0,
    recentPosts: [],
    recentComments: [],
    pendingComments: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // 模拟API调用 - 在实际项目中替换为真实的API调用
      const mockData = {
        totalPosts: 23,
        totalUsers: 156,
        totalComments: 89,
        totalCategories: 8,
        pendingComments: 5,
        recentPosts: [
          {
            id: 1,
            title: "React 18 新特性详解",
            author: "张三",
            createdAt: "2025-01-10",
            viewCount: 245,
            status: "published"
          },
          {
            id: 2,
            title: "Node.js 性能优化最佳实践",
            author: "李四",
            createdAt: "2025-01-09",
            viewCount: 189,
            status: "published"
          },
          {
            id: 3,
            title: "前端工程化工具链搭建",
            author: "王五",
            createdAt: "2025-01-08",
            viewCount: 167,
            status: "draft"
          }
        ],
        recentComments: [
          {
            id: 1,
            content: "这篇文章写得很好，学到了很多！",
            author: "用户A",
            postTitle: "React 18 新特性详解",
            createdAt: "2025-01-10 14:30",
            isApproved: true
          },
          {
            id: 2,
            content: "能否详细说明一下这个概念？",
            author: "用户B",
            postTitle: "Node.js 性能优化最佳实践",
            createdAt: "2025-01-10 13:15",
            isApproved: false
          }
        ]
      };

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setStats(mockData);
    } catch (error) {
      console.error('获取仪表板数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, color, trend }) => (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && (
            <div className="flex items-center mt-2">
              <TrendingUp size={16} className="text-green-500 mr-1" />
              <span className="text-green-500 text-sm font-medium">{trend}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  );

  const PostRow = ({ post }) => (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">{post.title}</div>
        <div className="text-sm text-gray-500">作者: {post.author}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          post.status === 'published' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {post.status === 'published' ? '已发布' : '草稿'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <div className="flex items-center">
          <Eye size={16} className="mr-1" />
          {post.viewCount}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {post.createdAt}
      </td>
    </tr>
  );

  const CommentRow = ({ comment }) => (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">{comment.content}</div>
        <div className="text-sm text-gray-500">来自: {comment.author}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {comment.postTitle}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          comment.isApproved 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {comment.isApproved ? '已审核' : '待审核'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {comment.createdAt}
      </td>
    </tr>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">管理员仪表板</h1>
            <div className="flex items-center space-x-4">
              <Calendar size={20} className="text-gray-400" />
              <span className="text-gray-600">{new Date().toLocaleDateString('zh-CN')}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={FileText}
            title="总文章数"
            value={stats.totalPosts}
            color="bg-blue-500"
            trend="+12%"
          />
          <StatCard
            icon={Users}
            title="总用户数"
            value={stats.totalUsers}
            color="bg-green-500"
            trend="+8%"
          />
          <StatCard
            icon={MessageSquare}
            title="总评论数"
            value={stats.totalComments}
            color="bg-purple-500"
            trend="+15%"
          />
          <StatCard
            icon={Tag}
            title="分类数量"
            value={stats.totalCategories}
            color="bg-orange-500"
          />
        </div>

        {/* 待处理提醒 */}
        {stats.pendingComments > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <MessageSquare className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  您有 <span className="font-medium">{stats.pendingComments}</span> 条评论待审核
                  <a href="#" className="ml-2 font-medium underline text-yellow-700 hover:text-yellow-600">
                    立即处理
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 最近文章 */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">最近文章</h3>
            </div>
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      文章
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      浏览
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      日期
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.recentPosts.map(post => (
                    <PostRow key={post.id} post={post} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 bg-gray-50 text-right">
              <a href="#" className="text-sm text-blue-600 hover:text-blue-500">
                查看所有文章 →
              </a>
            </div>
          </div>

          {/* 最近评论 */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">最近评论</h3>
            </div>
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      评论内容
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      文章
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      时间
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.recentComments.map(comment => (
                    <CommentRow key={comment.id} comment={comment} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 bg-gray-50 text-right">
              <a href="#" className="text-sm text-blue-600 hover:text-blue-500">
                查看所有评论 →
              </a>
            </div>
          </div>
        </div>

        {/* 快速操作 */}
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">快速操作</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors">
              <FileText className="inline-block mr-2" size={20} />
              创建新文章
            </button>
            <button className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors">
              <Tag className="inline-block mr-2" size={20} />
              管理分类
            </button>
            <button className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-colors">
              <MessageSquare className="inline-block mr-2" size={20} />
              审核评论
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
