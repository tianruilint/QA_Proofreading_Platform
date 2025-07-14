# QA对校对协作平台 v2.0

## 项目概述

QA对校对协作平台是一个专为企业内部设计的智能化文档校对协作系统。该平台通过结构化的QA对（问答对）形式，将传统的文档校对工作转化为可追踪、可管理、可协作的数字化流程。

### v2.0 版本特性

- ✅ **前后端分离架构**：React + Flask，提升可维护性和扩展性
- ✅ **细粒度权限控制**：基于用户组和管理员组的权限管理
- ✅ **文件管理优化**：取消自动删除，增强删除权限控制
- ✅ **完整溯源功能**：QA对校对历史追踪和质量管控
- ✅ **生产环境部署**：支持Docker、Nginx、Gunicorn等生产配置

## 快速开始

### 系统要求

- Ubuntu 20.04 LTS Server
- Python 3.8.10
- Node.js 18.x
- 4核CPU，8GB RAM，20GB存储（推荐）

### 安装步骤

1. **解压项目文件**
   ```bash
   tar -xzf qa-proofreading-platform-v2.tar.gz
   cd qa-proofreading-platform
   ```

2. **安装Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **配置后端环境**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python init_sqlite_db.py
   ```

4. **构建前端**
   ```bash
   npm install
   npm run build
   ```

5. **启动服务**
   ```bash
   source venv/bin/activate
   python src/main.py
   ```

6. **访问应用**
   
   在浏览器中访问：`http://YOUR_SERVER_IP:5001`

## 文档

- 📖 [完整部署教程](docs/最终部署教程.md) - 详细的生产环境部署指南
- 📋 [产品需求文档](docs/更新后的PRD.md) - 完整的功能需求和技术架构
- 🏗️ [前端构建指南](docs/前端构建指南.md) - 前端开发和构建说明
- 📁 [项目结构说明](docs/项目结构说明.md) - 代码组织和文件结构

## 主要功能

### 用户管理
- 基于角色的访问控制（RBAC）
- 用户组和管理员组管理
- 细粒度权限控制

### 任务管理
- 智能任务分配
- 实时协作支持
- 进度跟踪和状态管理

### 文件处理
- 多格式支持（JSONL、Excel、文本）
- 持久化存储
- 权限控制的删除机制

### QA对校对
- 直观的校对界面
- 多轮校对支持
- 质量控制和评分

### 溯源审计
- 完整的操作记录
- 工作质量分析
- 合规审计支持

## 技术架构

### 前端
- **框架**: React 18
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **组件库**: shadcn/ui

### 后端
- **框架**: Flask
- **数据库**: SQLite/PostgreSQL
- **ORM**: SQLAlchemy
- **认证**: JWT

### 部署
- **容器化**: Docker支持
- **Web服务器**: Nginx
- **应用服务器**: Gunicorn
- **监控**: 系统监控和日志

## 默认用户

系统初始化后会创建以下测试用户：

- **张三** - 管理员账户
- **李四** - 普通用户
- **王五** - 普通用户
- **赵六** - 普通用户
- **钱七** - 普通用户

## 安全说明

- 生产环境请务必更改默认密码
- 配置HTTPS和防火墙
- 定期备份数据库
- 监控系统安全状况

## 支持

如果在部署或使用过程中遇到问题：

1. 查看 [故障排除](docs/最终部署教程.md#故障排除) 部分
2. 检查应用日志输出
3. 验证系统要求和配置

## 版本历史

### v2.0 (2025-07-09)
- 前后端分离架构重构
- 新增用户组和管理员组管理
- 取消文件自动删除机制
- 实现完整溯源功能
- 优化UI界面和用户体验
- 完善部署文档和生产配置

### v1.0
- 基础QA对校对功能
- 单文件处理模式
- 简单用户管理

## 许可证

本项目为企业内部使用系统，请遵守相关使用协议。

