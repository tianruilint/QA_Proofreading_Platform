#!/usr/bin/env python3
"""
SQLite数据库初始化脚本
"""
import os
import sys
import uuid
from datetime import datetime

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.main import app
from src.models import db
from src.models.user import User

def init_database():
    """初始化数据库"""
    with app.app_context():
        # 删除现有数据库文件
        db_path = 'qa_proofreading.db'
        if os.path.exists(db_path):
            os.remove(db_path)
            print(f"已删除现有数据库文件: {db_path}")
        
        # 创建所有表
        db.create_all()
        print("数据库表创建成功")
        
        # 创建测试用户
        users_data = [
            {'name': '张三', 'is_admin': True},
            {'name': '李四', 'is_admin': False},
            {'name': '王五', 'is_admin': False},
            {'name': '赵六', 'is_admin': False},
            {'name': '钱七', 'is_admin': False},
        ]
        
        for user_data in users_data:
            user = User(
                id=str(uuid.uuid4()),
                name=user_data['name'],
                is_admin=user_data['is_admin'],
                created_at=datetime.utcnow()
            )
            db.session.add(user)
        
        db.session.commit()
        print(f"已创建 {len(users_data)} 个测试用户")
        
        print("数据库初始化完成！")

if __name__ == '__main__':
    init_database()

