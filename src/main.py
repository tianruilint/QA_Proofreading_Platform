import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import click
from flask import Flask, send_from_directory, jsonify
from flask.cli import with_appcontext
from flask_cors import CORS
from src.config import Config
from src.models import db
from src.models.user import User
from src.models.admin_group import AdminGroup
from src.models.user_group import UserGroup
from src.models.task import Task, TaskAssignment
from src.models.file import File
from src.models.qa_pair import QAPair

# 导入路由蓝图
from src.routes.auth import auth_bp
from src.routes.user_management import user_management_bp
from src.routes.group_management import group_management_bp
from src.routes.file_management import file_management_bp
from src.routes.task_management import task_management_bp

def create_app(config_name='default'):
    """应用工厂函数"""
    # 设置静态文件目录为构建后的前端文件目录
    static_folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'src', 'static')
    app = Flask(__name__, static_folder=static_folder, static_url_path='')
    
    # 加载配置
    from src.config import config
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)
    
    # 启用CORS
    CORS(app, origins=app.config['CORS_ORIGINS'])
    
    # 初始化数据库
    db.init_app(app)
    
    # 注册蓝图
    app.register_blueprint(auth_bp, url_prefix='/api/v1/auth')
    app.register_blueprint(user_management_bp, url_prefix='/api/v1')
    app.register_blueprint(group_management_bp, url_prefix='/api/v1')
    app.register_blueprint(file_management_bp, url_prefix='/api/v1')
    app.register_blueprint(task_management_bp, url_prefix='/api/v1')
    
    # 注册新的数据库初始化命令
    app.cli.add_command(init_db_command)

    # 创建上传和导出目录
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.config["EXPORT_FOLDER"], exist_ok=True)

    @app.route("/guest")
    def serve_guest():
        return send_from_directory(app.static_folder, "index.html")

    @app.route("/")
    @app.route("/<path:path>")
    def serve(path=""):
        """服务前端文件和SPA路由回退"""
        if path.startswith("api/"):
            return jsonify({
                "success": False,
                "error": {
                    "code": "NOT_FOUND",
                    "message": "请求的API不存在"
                }
            }), 404

        if path and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)

        index_path = os.path.join(app.static_folder, "index.html")
        if os.path.exists(index_path):
            return send_from_directory(app.static_folder, "index.html")
        else:
            return jsonify({
                "success": False,
                "error": {
                    "code": "FRONTEND_NOT_200_FOUND",
                    "message": "前端文件未找到，请先构建前端项目"
                }
            }), 404
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'success': False,
            'error': {
                'code': 'NOT_FOUND',
                'message': '请求的资源不存在'
            }
        }), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': '服务器内部错误'
            }
        }), 500
    
    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({
            'success': False,
            'error': {
                'code': 'FORBIDDEN',
                'message': '权限不足'
            }
        }), 403
    
    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({
            'success': False,
            'error': {
                'code': 'UNAUTHORIZED',
                'message': '请先登录'
            }
        }), 401
    
    # 健康检查接口
    @app.route('/api/health')
    def health_check():
        return jsonify({
            'success': True,
            'message': 'QA对校对协作平台运行正常',
            'version': '2.0.0'
        })
    
    # 注意：旧的自动初始化数据库的 with app.app_context() 块已被移除
    
    return app

@click.command('init-db')
@with_appcontext
def init_db_command():
    """清除现有数据并创建新表。"""
    db.create_all()
    click.echo('数据库表结构已初始化。')
    
    # 检查是否需要填充初始数据
    if not User.query.filter_by(role='super_admin').first():
        click.echo('正在填充初始数据...')
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
            click.echo("数据库初始化数据填充完成。")
            
        except Exception as e:
            db.session.rollback()
            click.echo(f"数据库初始化失败: {e}")
    else:
        click.echo('数据库已包含数据，跳过填充步骤。')

# 创建应用实例
app = create_app(os.environ.get('FLASK_ENV', 'default'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)

