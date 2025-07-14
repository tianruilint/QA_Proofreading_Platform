
-- QA对校对协作平台数据库设计
-- 数据库: PostgreSQL

-- 创建数据库
-- CREATE DATABASE qa_proofreading_platform;

-- 使用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

-- 任务状态枚举
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed');

-- 任务分配状态枚举
CREATE TYPE assignment_status AS ENUM ('not_started', 'in_progress', 'completed');

-- 任务表（协作任务）
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    original_file_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status task_status DEFAULT 'pending',
    total_qa_pairs INTEGER NOT NULL DEFAULT 0,
    completed_assignments INTEGER DEFAULT 0,
    total_assignments INTEGER DEFAULT 0,
    merged_file_path VARCHAR(500),
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

-- 任务分配表
CREATE TABLE task_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_index INTEGER NOT NULL,
    end_index INTEGER NOT NULL,
    assigned_qa_pairs INTEGER NOT NULL,
    status assignment_status DEFAULT 'not_started',
    last_submitted_at TIMESTAMP,
    submitted_file_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, user_id)
);

-- 单文件校对会话表（用于访客模式和登录用户的单文件校对）
CREATE TABLE single_file_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for guest mode
    original_filename VARCHAR(255) NOT NULL,
    original_file_path VARCHAR(500) NOT NULL,
    total_qa_pairs INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

-- QA对数据表
CREATE TABLE qa_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_assignment_id UUID REFERENCES task_assignments(id) ON DELETE CASCADE, -- 协作任务的QA对
    single_file_session_id UUID REFERENCES single_file_sessions(id) ON DELETE CASCADE, -- 单文件校对的QA对
    original_index INTEGER NOT NULL, -- 在原始文件中的行号（从0开始）
    prompt TEXT NOT NULL,
    completion TEXT NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE, -- 软删除标记
    edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    last_edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- 确保QA对要么属于协作任务，要么属于单文件会话，但不能同时属于两者
    CONSTRAINT qa_pairs_assignment_xor_session CHECK (
        (task_assignment_id IS NOT NULL AND single_file_session_id IS NULL) OR
        (task_assignment_id IS NULL AND single_file_session_id IS NOT NULL)
    )
);

-- 创建索引以提高查询性能
CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_tasks_creator_id ON tasks(creator_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_expires_at ON tasks(expires_at);
CREATE INDEX idx_task_assignments_task_id ON task_assignments(task_id);
CREATE INDEX idx_task_assignments_user_id ON task_assignments(user_id);
CREATE INDEX idx_task_assignments_status ON task_assignments(status);
CREATE INDEX idx_single_file_sessions_user_id ON single_file_sessions(user_id);
CREATE INDEX idx_single_file_sessions_expires_at ON single_file_sessions(expires_at);
CREATE INDEX idx_qa_pairs_task_assignment_id ON qa_pairs(task_assignment_id);
CREATE INDEX idx_qa_pairs_single_file_session_id ON qa_pairs(single_file_session_id);
CREATE INDEX idx_qa_pairs_original_index ON qa_pairs(original_index);
CREATE INDEX idx_qa_pairs_is_deleted ON qa_pairs(is_deleted);

-- 插入默认用户数据（示例）
INSERT INTO users (name, is_admin) VALUES 
('张三', true),
('李四', false),
('王五', false),
('赵六', false),
('钱七', false);

-- 创建清理过期数据的函数
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
    -- 删除过期的任务及其相关数据
    DELETE FROM tasks WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- 删除过期的单文件会话及其相关数据
    DELETE FROM single_file_sessions WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- 记录清理日志
    RAISE NOTICE 'Expired data cleanup completed at %', CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- 创建定时清理任务的触发器（需要配合外部cron job）
-- 这里只是示例，实际部署时需要配置系统级别的定时任务

