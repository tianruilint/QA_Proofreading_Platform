
# QA对校对协作平台 - 技术方案

## 1. 概述

本技术方案旨在为QA对校对协作平台提供详细的技术实现路径。该平台旨在提高QA对校对效率，支持多人协作，提供可视化编辑、任务分配、进度追踪等功能。平台将部署在公司内部的Ubuntu 3090服务器上。

## 2. 技术栈选择

根据产品需求文档（PRD）的建议以及作为高级全栈工程师的经验，我们选择以下技术栈：

### 2.1 前端
- **框架**: React
  - **理由**: React是一个声明式、高效且灵活的JavaScript库，用于构建用户界面。它拥有庞大的社区支持和丰富的生态系统，适合构建复杂的单页应用（SPA）。
- **UI组件库**: Ant Design
  - **理由**: Ant Design是一套企业级UI设计语言和React组件库，提供高质量的组件和一致的设计规范，能够加速开发并保证用户体验。
- **文本编辑器**: Monaco Editor
  - **理由**: Monaco Editor是VS Code的底层代码编辑器，功能强大，支持语法高亮、代码提示等，非常适合QA对的文本编辑需求。

### 2.2 后端
- **框架**: Python FastAPI
  - **理由**: FastAPI是一个现代、快速（高性能）的Python Web框架，用于构建API。它基于标准的Python类型提示，支持异步编程，并自动生成OpenAPI（Swagger）文档，极大地提高了开发效率和API的可维护性。考虑到PRD中提及的3090服务器和可能的AI相关扩展，Python生态系统将提供更好的兼容性和便利性。
- **数据库**: PostgreSQL
  - **理由**: PostgreSQL是一个功能强大、开源的对象关系型数据库系统，以其可靠性、数据完整性和强大的功能集而闻名。它支持JSONB类型，非常适合存储QA对的JSON数据，并且在大文件处理和并发访问方面表现出色。
- **缓存**: Redis
  - **理由**: Redis是一个开源的内存数据结构存储，可用作数据库、缓存和消息代理。它提供极高的读写性能，适合用于存储用户会话、任务进度、临时数据以及加速频繁访问的数据。

### 2.3 文件处理
- **大文件处理**: 采用流式处理（Streaming）和分块上传（Chunked Upload）技术，避免一次性加载整个文件到内存，提高处理效率和稳定性。
- **前端分页加载**: 前端只加载当前页面的QA对数据，通过API请求获取更多数据，减少浏览器内存占用。
- **JSONL解析**: 后端使用`json`模块逐行解析JSONL文件。
- **Excel转换**: 使用`openpyxl`（Python库）进行Excel文件的读写操作。

## 3. 系统架构设计

平台将采用前后端分离的架构，通过RESTful API进行通信。

### 3.1 总体架构图

```mermaid
graph TD
    A[用户浏览器] -->|HTTP/HTTPS| B(Nginx/负载均衡)
    B -->|HTTP/HTTPS| C[前端服务 (React)]
    C -->|RESTful API| D[后端服务 (FastAPI)]
    D -->|SQL| E[PostgreSQL 数据库]
    D -->|Cache| F[Redis 缓存]
    D -->|文件存储| G[本地文件系统/对象存储]
```

### 3.2 模块设计

#### 3.2.1 前端模块
- **登录模块**: 处理用户登录、访客模式切换。
- **文件上传模块**: 支持拖拽上传JSONL文件，文件格式校验。
- **QA对编辑模块**: 可视化展示QA对，支持文本编辑、保存、导出JSONL/Excel。
- **任务管理模块**: 创建协作任务、分配、进度追踪、任务提交、合并下载。
- **任务列表模块**: 展示待办/已完成任务，数据隔离。
- **通用组件库**: 封装常用UI组件和工具函数。

#### 3.2.2 后端模块
- **用户认证模块**: 处理用户登录、会话管理。
- **文件处理模块**: 负责JSONL文件的上传、解析、存储、Excel转换。
- **QA对管理模块**: 提供QA对的增删改查API。
- **任务管理模块**: 负责任务的创建、分配、进度更新、合并、数据清理。
- **数据库交互模块**: 封装数据库操作，提供统一的数据访问接口。
- **缓存模块**: 封装Redis操作，用于数据缓存和会话管理。

## 4. 数据库设计

### 4.1 表结构（初步）

- **`users` 表**: 存储用户信息
  - `id` (PK, UUID)
  - `name` (VARCHAR, UNIQUE)
  - `is_admin` (BOOLEAN, DEFAULT FALSE)

- **`tasks` 表**: 存储协作任务信息
  - `id` (PK, UUID)
  - `creator_id` (FK to users.id)
  - `original_filename` (VARCHAR)
  - `created_at` (TIMESTAMP)
  - `status` (ENUM: 'pending', 'in_progress', 'completed')
  - `total_qa_pairs` (INTEGER)
  - `completed_qa_pairs` (INTEGER)
  - `merged_file_path` (VARCHAR, NULLABLE)

- **`task_assignments` 表**: 存储任务分配信息
  - `id` (PK, UUID)
  - `task_id` (FK to tasks.id)
  - `user_id` (FK to users.id)
  - `start_index` (INTEGER)
  - `end_index` (INTEGER)
  - `assigned_qa_pairs` (INTEGER)
  - `status` (ENUM: 'not_started', 'in_progress', 'completed')
  - `last_submitted_at` (TIMESTAMP, NULLABLE)
  - `submitted_file_path` (VARCHAR, NULLABLE)

- **`qa_pairs` 表**: 存储QA对数据（针对单文件校对和协作任务的临时存储）
  - `id` (PK, UUID)
  - `task_assignment_id` (FK to task_assignments.id, NULLABLE for single file mode)
  - `original_index` (INTEGER) - 在原始文件中的行号
  - `prompt` (TEXT)
  - `completion` (TEXT)
  - `is_deleted` (BOOLEAN, DEFAULT FALSE) - 软删除标记
  - `edited_by` (FK to users.id, NULLABLE)
  - `last_edited_at` (TIMESTAMP, NULLABLE)

### 4.2 文件存储

- 上传的原始JSONL文件和用户提交的编辑文件将存储在服务器的本地文件系统上，路径通过数据库记录。
- 考虑到未来扩展性，可考虑集成MinIO等对象存储服务。

## 5. API接口设计（初步）

### 5.1 用户认证
- `POST /api/v1/auth/login`: 用户登录（选择姓名）
- `GET /api/v1/auth/users`: 获取预设用户列表

### 5.2 单文件校对
- `POST /api/v1/single_file/upload`: 上传JSONL文件
- `GET /api/v1/single_file/{file_id}/qa_pairs`: 获取QA对列表（支持分页）
- `PUT /api/v1/single_file/{file_id}/qa_pairs/{qa_id}`: 更新单个QA对
- `POST /api/v1/single_file/{file_id}/export_jsonl`: 导出为JSONL
- `POST /api/v1/single_file/{file_id}/export_excel`: 导出为Excel

### 5.3 协作任务
- `POST /api/v1/collaboration/create_task`: 创建协作任务
- `GET /api/v1/collaboration/tasks/{task_id}`: 获取任务详情
- `GET /api/v1/collaboration/tasks/{task_id}/assignments`: 获取任务分配详情
- `GET /api/v1/collaboration/assignments/{assignment_id}/qa_pairs`: 获取分配给当前用户的QA对列表（支持分页）
- `PUT /api/v1/collaboration/assignments/{assignment_id}/qa_pairs/{qa_id}`: 更新分配给当前用户的单个QA对
- `POST /api/v1/collaboration/assignments/{assignment_id}/submit`: 提交任务部分
- `POST /api/v1/collaboration/tasks/{task_id}/merge_and_export_jsonl`: 合并并导出为JSONL（仅限创建者）
- `POST /api/v1/collaboration/tasks/{task_id}/merge_and_export_excel`: 合并并导出为Excel（仅限创建者）

### 5.4 任务列表
- `GET /api/v1/tasks/pending`: 获取待办任务列表
- `GET /api/v1/tasks/completed`: 获取已完成任务列表
- `GET /api/v1/tasks/{task_id}/download`: 下载已完成任务文件

## 6. 非功能性需求实现

- **性能**: 
  - **大文件处理**: 后端采用`aiofiles`进行异步文件I/O，配合`iter_content`进行流式处理。前端采用虚拟列表（Virtual List）和分页加载。
  - **响应时间**: FastAPI的异步特性和Redis缓存将确保API响应速度。前端组件的优化渲染。
- **兼容性**: 
  - 前端使用React和Ant Design，确保主流浏览器兼容性。
  - 采用响应式设计，支持平板设备。
- **安全性**: 
  - **HTTPS**: 部署时通过Nginx配置HTTPS。
  - **数据隔离**: 后端API严格控制数据访问权限，确保用户只能访问自己被分配的QA对。
  - **数据清理**: 定时任务（Cron Job）清理过期数据。
- **可用性**: 
  - 界面设计遵循Ant Design规范，简洁直观。
  - 错误处理和提示信息清晰。
  - 考虑实现键盘快捷键和自动保存功能。

## 7. 部署方案

- **环境**: Ubuntu 22.04 LTS
- **Web服务器**: Nginx (作为反向代理和静态文件服务)
- **后端部署**: Gunicorn + Uvicorn (运行FastAPI应用)
- **数据库**: PostgreSQL
- **缓存**: Redis
- **文件存储**: 本地文件系统

## 8. 风险与应对

- **大文件处理性能**: 持续优化流式处理逻辑，进行压力测试。
- **并发编辑冲突**: 采用乐观锁机制，每次保存时检查数据版本。
- **数据丢失**: 自动保存草稿，提供撤销功能，定期备份数据库。
- **权限管理**: 现有方案基于用户ID进行数据隔离，未来可扩展更细粒度的RBAC（基于角色的访问控制）。

## 9. 后续计划

- 详细的API文档编写。
- 前后端开发规范制定。
- 持续集成/持续部署（CI/CD）流程搭建。
- 单元测试和集成测试用例编写。

