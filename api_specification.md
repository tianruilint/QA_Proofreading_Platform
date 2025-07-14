# QA对校对协作平台 API 接口规范

## 1. 概述

本文档定义了QA对校对协作平台的RESTful API接口规范。所有API接口均采用JSON格式进行数据交换，遵循HTTP状态码标准。

### 1.1 基础信息
- **Base URL**: `http://localhost:8000/api/v1`
- **Content-Type**: `application/json`
- **字符编码**: UTF-8

### 1.2 通用响应格式

#### 成功响应
```json
{
    "success": true,
    "data": {}, // 具体数据
    "message": "操作成功"
}
```

#### 错误响应
```json
{
    "success": false,
    "error": {
        "code": "ERROR_CODE",
        "message": "错误描述",
        "details": {} // 可选的详细错误信息
    }
}
```

### 1.3 HTTP状态码
- `200 OK`: 请求成功
- `201 Created`: 资源创建成功
- `400 Bad Request`: 请求参数错误
- `401 Unauthorized`: 未授权
- `403 Forbidden`: 禁止访问
- `404 Not Found`: 资源不存在
- `422 Unprocessable Entity`: 请求格式正确但语义错误
- `500 Internal Server Error`: 服务器内部错误

## 2. 用户认证模块

### 2.1 获取用户列表
**GET** `/auth/users`

获取系统中预设的用户列表，用于登录时选择。

#### 响应示例
```json
{
    "success": true,
    "data": {
        "users": [
            {
                "id": "uuid-string",
                "name": "张三",
                "is_admin": true
            },
            {
                "id": "uuid-string", 
                "name": "李四",
                "is_admin": false
            }
        ]
    }
}
```

### 2.2 用户登录
**POST** `/auth/login`

用户通过选择姓名进行登录。

#### 请求参数
```json
{
    "user_id": "uuid-string"
}
```

#### 响应示例
```json
{
    "success": true,
    "data": {
        "user": {
            "id": "uuid-string",
            "name": "张三",
            "is_admin": true
        },
        "session_token": "session-token-string"
    }
}
```

### 2.3 用户登出
**POST** `/auth/logout`

用户登出，清除会话。

#### 请求头
```
Authorization: Bearer <session_token>
```

#### 响应示例
```json
{
    "success": true,
    "message": "登出成功"
}
```

## 3. 单文件校对模块

### 3.1 上传JSONL文件
**POST** `/single_file/upload`

上传JSONL文件进行单文件校对。

#### 请求参数（multipart/form-data）
- `file`: JSONL文件
- `user_id`: 用户ID（可选，访客模式时为空）

#### 响应示例
```json
{
    "success": true,
    "data": {
        "session_id": "uuid-string",
        "filename": "example.jsonl",
        "total_qa_pairs": 1000,
        "file_info": {
            "size": 1024000,
            "upload_time": "2025-01-08T10:00:00Z"
        }
    }
}
```

### 3.2 获取QA对列表
**GET** `/single_file/{session_id}/qa_pairs`

获取单文件校对会话中的QA对列表，支持分页。

#### 查询参数
- `page`: 页码（默认1）
- `page_size`: 每页数量（默认20，最大100）
- `search`: 搜索关键词（可选）

#### 响应示例
```json
{
    "success": true,
    "data": {
        "qa_pairs": [
            {
                "id": "uuid-string",
                "original_index": 0,
                "prompt": "设摊审批需要通过哪个系统进行？",
                "completion": "设摊审批需要通过教工OA系统进行。",
                "is_deleted": false,
                "last_edited_at": "2025-01-08T10:00:00Z"
            }
        ],
        "pagination": {
            "page": 1,
            "page_size": 20,
            "total": 1000,
            "total_pages": 50
        }
    }
}
```

### 3.3 更新单个QA对
**PUT** `/single_file/{session_id}/qa_pairs/{qa_id}`

更新单个QA对的内容。

#### 请求参数
```json
{
    "prompt": "更新后的问题",
    "completion": "更新后的答案",
    "is_deleted": false
}
```

#### 响应示例
```json
{
    "success": true,
    "data": {
        "qa_pair": {
            "id": "uuid-string",
            "original_index": 0,
            "prompt": "更新后的问题",
            "completion": "更新后的答案",
            "is_deleted": false,
            "last_edited_at": "2025-01-08T10:30:00Z"
        }
    }
}
```

### 3.4 批量更新QA对
**PUT** `/single_file/{session_id}/qa_pairs/batch`

批量更新多个QA对。

#### 请求参数
```json
{
    "updates": [
        {
            "id": "uuid-string",
            "prompt": "更新后的问题1",
            "completion": "更新后的答案1",
            "is_deleted": false
        },
        {
            "id": "uuid-string",
            "prompt": "更新后的问题2", 
            "completion": "更新后的答案2",
            "is_deleted": true
        }
    ]
}
```

### 3.5 导出为JSONL
**POST** `/single_file/{session_id}/export/jsonl`

将编辑后的QA对导出为JSONL格式。

#### 响应示例
```json
{
    "success": true,
    "data": {
        "download_url": "/downloads/example_edited_20250108103000.jsonl",
        "filename": "example_edited_20250108103000.jsonl",
        "total_qa_pairs": 950
    }
}
```

### 3.6 导出为Excel
**POST** `/single_file/{session_id}/export/excel`

将编辑后的QA对导出为Excel格式。

#### 响应示例
```json
{
    "success": true,
    "data": {
        "download_url": "/downloads/example_20250108103000.xlsx",
        "filename": "example_20250108103000.xlsx",
        "total_qa_pairs": 950
    }
}
```

## 4. 协作任务模块

### 4.1 创建协作任务
**POST** `/collaboration/tasks`

创建新的协作任务并分配给团队成员。

#### 请求参数（multipart/form-data）
- `file`: JSONL文件
- `task_name`: 任务名称（可选，默认使用文件名）
- `assignments`: JSON字符串，包含分配信息

assignments格式示例：
```json
{
    "assignments": [
        {
            "user_id": "uuid-string",
            "qa_count": 100
        },
        {
            "user_id": "uuid-string", 
            "qa_count": 150
        }
    ]
}
```

#### 响应示例
```json
{
    "success": true,
    "data": {
        "task": {
            "id": "uuid-string",
            "original_filename": "large_qa_file.jsonl",
            "creator_id": "uuid-string",
            "created_at": "2025-01-08T10:00:00Z",
            "status": "pending",
            "total_qa_pairs": 1000,
            "total_assignments": 3
        },
        "assignments": [
            {
                "id": "uuid-string",
                "user_id": "uuid-string",
                "user_name": "张三",
                "start_index": 0,
                "end_index": 99,
                "assigned_qa_pairs": 100,
                "status": "not_started"
            }
        ]
    }
}
```

### 4.2 获取任务详情
**GET** `/collaboration/tasks/{task_id}`

获取协作任务的详细信息。

#### 响应示例
```json
{
    "success": true,
    "data": {
        "task": {
            "id": "uuid-string",
            "original_filename": "large_qa_file.jsonl",
            "creator_id": "uuid-string",
            "creator_name": "张三",
            "created_at": "2025-01-08T10:00:00Z",
            "status": "in_progress",
            "total_qa_pairs": 1000,
            "completed_assignments": 1,
            "total_assignments": 3,
            "progress_percentage": 33.33
        },
        "assignments": [
            {
                "id": "uuid-string",
                "user_id": "uuid-string",
                "user_name": "张三",
                "start_index": 0,
                "end_index": 99,
                "assigned_qa_pairs": 100,
                "status": "completed",
                "last_submitted_at": "2025-01-08T11:00:00Z"
            }
        ]
    }
}
```

### 4.3 获取分配给当前用户的QA对
**GET** `/collaboration/assignments/{assignment_id}/qa_pairs`

获取分配给当前用户的QA对列表。

#### 查询参数
- `page`: 页码（默认1）
- `page_size`: 每页数量（默认20，最大100）
- `search`: 搜索关键词（可选）

#### 响应示例
```json
{
    "success": true,
    "data": {
        "assignment": {
            "id": "uuid-string",
            "task_id": "uuid-string",
            "user_id": "uuid-string",
            "start_index": 0,
            "end_index": 99,
            "assigned_qa_pairs": 100,
            "status": "in_progress"
        },
        "qa_pairs": [
            {
                "id": "uuid-string",
                "original_index": 0,
                "prompt": "设摊审批需要通过哪个系统进行？",
                "completion": "设摊审批需要通过教工OA系统进行。",
                "is_deleted": false,
                "last_edited_at": "2025-01-08T10:00:00Z"
            }
        ],
        "pagination": {
            "page": 1,
            "page_size": 20,
            "total": 100,
            "total_pages": 5
        }
    }
}
```

### 4.4 更新分配的QA对
**PUT** `/collaboration/assignments/{assignment_id}/qa_pairs/{qa_id}`

更新分配给当前用户的单个QA对。

#### 请求参数
```json
{
    "prompt": "更新后的问题",
    "completion": "更新后的答案",
    "is_deleted": false
}
```

### 4.5 提交任务部分
**POST** `/collaboration/assignments/{assignment_id}/submit`

提交当前用户负责的任务部分。

#### 响应示例
```json
{
    "success": true,
    "data": {
        "assignment": {
            "id": "uuid-string",
            "status": "completed",
            "last_submitted_at": "2025-01-08T12:00:00Z",
            "submitted_qa_pairs": 95
        },
        "task_progress": {
            "completed_assignments": 2,
            "total_assignments": 3,
            "progress_percentage": 66.67
        }
    }
}
```

### 4.6 合并并导出JSONL
**POST** `/collaboration/tasks/{task_id}/export/jsonl`

合并所有已提交的任务部分并导出为JSONL（仅限任务创建者）。

#### 响应示例
```json
{
    "success": true,
    "data": {
        "download_url": "/downloads/merged_large_qa_file_20250108120000.jsonl",
        "filename": "merged_large_qa_file_20250108120000.jsonl",
        "total_qa_pairs": 950,
        "merged_from_assignments": 3
    }
}
```

### 4.7 合并并导出Excel
**POST** `/collaboration/tasks/{task_id}/export/excel`

合并所有已提交的任务部分并导出为Excel（仅限任务创建者）。

## 5. 任务列表模块

### 5.1 获取待办任务列表
**GET** `/tasks/pending`

获取当前用户的待办任务列表。

#### 响应示例
```json
{
    "success": true,
    "data": {
        "tasks": [
            {
                "id": "uuid-string",
                "type": "single_file",
                "title": "example.jsonl",
                "created_at": "2025-01-08T10:00:00Z",
                "total_qa_pairs": 100,
                "status": "in_progress"
            },
            {
                "id": "uuid-string",
                "type": "collaboration",
                "title": "large_qa_file.jsonl",
                "creator_name": "张三",
                "created_at": "2025-01-08T09:00:00Z",
                "assigned_qa_pairs": 150,
                "status": "not_started"
            }
        ]
    }
}
```

### 5.2 获取已完成任务列表
**GET** `/tasks/completed`

获取当前用户的已完成任务列表。

#### 响应示例
```json
{
    "success": true,
    "data": {
        "tasks": [
            {
                "id": "uuid-string",
                "type": "single_file",
                "title": "completed_example.jsonl",
                "completed_at": "2025-01-08T08:00:00Z",
                "total_qa_pairs": 50,
                "download_available": true,
                "expires_at": "2025-01-09T08:00:00Z"
            }
        ]
    }
}
```

## 6. 文件下载模块

### 6.1 下载文件
**GET** `/downloads/{filename}`

下载导出的文件。

#### 响应
返回文件流，Content-Type根据文件类型设置。

## 7. 错误代码定义

| 错误代码 | 描述 |
|---------|------|
| `INVALID_FILE_FORMAT` | 文件格式不正确 |
| `FILE_TOO_LARGE` | 文件过大 |
| `USER_NOT_FOUND` | 用户不存在 |
| `TASK_NOT_FOUND` | 任务不存在 |
| `ASSIGNMENT_NOT_FOUND` | 任务分配不存在 |
| `PERMISSION_DENIED` | 权限不足 |
| `TASK_ALREADY_COMPLETED` | 任务已完成 |
| `INVALID_QA_PAIR` | QA对数据无效 |
| `SESSION_EXPIRED` | 会话已过期 |
| `CONCURRENT_EDIT_CONFLICT` | 并发编辑冲突 |

## 8. 认证和授权

### 8.1 会话管理
- 用户登录后获得session_token
- 所有需要认证的API请求需在请求头中包含：`Authorization: Bearer <session_token>`
- 访客模式下不需要认证，但功能受限

### 8.2 权限控制
- 用户只能访问自己创建的单文件会话
- 用户只能访问分配给自己的协作任务部分
- 只有任务创建者可以查看完整任务信息和导出合并文件
- 管理员用户具有额外权限（预留扩展）

## 9. 限制和配额

- 单个文件最大大小：100MB
- 单个文件最大QA对数量：50,000
- 单个任务最大参与人数：20
- 会话有效期：24小时
- 文件保留期：24小时（完成后）

