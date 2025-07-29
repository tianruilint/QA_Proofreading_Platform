
import os
import sys
from dotenv import load_dotenv

# 将项目根目录添加到Python路径中
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
load_dotenv()

from src.main import create_app, db
from src.models.user import User
from src.models.admin_group import AdminGroup
from src.models.user_group import UserGroup

def init_database():
    """
    初始化数据库：删除所有旧表，创建新表，并填充初始数据。
    """
    # 创建一个应用上下文
    app = create_app(os.getenv('FLASK_ENV') or 'default')
    with app.app_context():
        print("正在删除旧的数据库表...")
        db.drop_all()
        print("旧表已删除。")

        print("正在创建新的数据库表...")
        # 导入所有模型，以确保SQLAlchemy能够识别它们
        # 虽然它们可能已在create_app中导入，但在这里显式导入更安全
        from src.models import (
            user, admin_group, user_group, task, collaboration_task,
            collaboration_task_draft, collaboration_task_summary,
            notification, file, qa_pair
        )
        db.create_all()
        print("新表已成功创建。")

        # 检查是否需要填充初始数据
        if not User.query.filter_by(role='super_admin').first():
            print('正在填充初始数据...')
            try:
                # 创建超级管理员
                super_admin = User.create_user(
                    username='superadmin',
                    password='password',
                    display_name='超级管理员',
                    role='super_admin'
                )

                # 创建管理员组
                admin_group_dev = AdminGroup.create_group(
                    name='开发组管理员',
                    description='负责开发相关任务的管理员',
                    created_by=super_admin.id
                )
                admin_group_ops = AdminGroup.create_group(
                    name='运营组管理员',
                    description='负责运营相关任务的管理员',
                    created_by=super_admin.id
                )

                # 创建用户组
                user_group_dev = UserGroup.create_group(
                    name='开发组用户',
                    description='开发部门的普通用户',
                    created_by=super_admin.id
                )
                user_group_ops = UserGroup.create_group(
                    name='运营组用户',
                    description='运营部门的普通用户',
                    created_by=super_admin.id
                )

                # 关联管理员组和用户组
                admin_group_dev.add_user_group(user_group_dev)
                admin_group_ops.add_user_group(user_group_ops)

                # 创建其他用户
                User.create_user(
                    username='adminuser',
                    password='password',
                    display_name='管理员A',
                    role='admin',
                    admin_group_id=admin_group_dev.id
                )
                User.create_user(
                    username='user1',
                    password='password',
                    display_name='普通用户1',
                    role='user',
                    user_group_id=user_group_dev.id
                )
                User.create_user(
                    username='user2',
                    password='password',
                    display_name='普通用户2',
                    role='user',
                    user_group_id=user_group_ops.id
                )
                
                db.session.commit()
                print("数据库初始化数据填充完成。")
                print("-----------------------------------------")
                print("初始用户凭据:")
                print("  - 超级管理员: superadmin / password")
                print("  - 管理员: adminuser / password")
                print("  - 普通用户: user1 / password, user2 / password")
                print("-----------------------------------------")
                
            except Exception as e:
                db.session.rollback()
                print(f"数据库初始化失败: {e}")
        else:
            print('数据库已包含数据，跳过填充步骤。')

if __name__ == '__main__':
    # 确保instance文件夹存在
    if not os.path.exists('instance'):
        os.makedirs('instance')
    init_database()


