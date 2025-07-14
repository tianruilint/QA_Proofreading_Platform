import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, jsonify
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
    
    # 创建上传和导出目录
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['EXPORT_FOLDER'], exist_ok=True)
    
    @app.route('/', defaults={'path': ''}) 
    @app.route('/<path:path>')
    def serve(path):
        """服务前端文件和SPA路由回退"""
        # 如果是API请求，返回404
        if path.startswith('api/'):
            return jsonify({
                'success': False, 
                'error': {
                    'code': 'NOT_FOUND', 
                    'message': '请求的API不存在'
                }
            }), 404
        
        # 检查静态文件是否存在
        if path and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        
        # 对于所有其他请求，返回index.html（SPA路由回退）
        index_path = os.path.join(app.static_folder, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(app.static_folder, 'index.html')
        else:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'FRONTEND_NOT_200_FOUND',
                    'message': '前端文件未找到，请先构建前端项目'
                }
            }), 404
    
    @app.errorhandler(404)
    def not_found(error):
        """404错误处理"""
        return jsonify({
            'success': False,
            'error': {
                'code': 'NOT_FOUND',
                'message': '请求的资源不存在'
            }
        }), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        """500错误处理"""
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
        """403错误处理"""
        return jsonify({
            'success': False,
            'error': {
                'code': 'FORBIDDEN',
                'message': '权限不足'
            }
        }), 403
    
    @app.errorhandler(401)
    def unauthorized(error):
        """401错误处理"""
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
        """健康检查"""
        return jsonify({
            'success': True,
            'message': 'QA对校对协作平台运行正常',
            'version': '2.0.0'
        })
    
    # 初始化数据库
    with app.app_context():
        try:
            # 每次启动时都删除旧数据库文件，确保重新创建
            db_path = os.path.join(app.instance_path, 'qa_platform.db')
            if os.path.exists(db_path):
                os.remove(db_path)
                print(f"已删除旧数据库文件: {db_path}")

            # 创建数据库表
            db.create_all()
            
            # 检查是否需要初始化数据
            if not User.query.filter_by(role='super_admin').first():
                init_database()
                
        except Exception as e:
            print(f"数据库初始化失败: {e}")
    
    return app

def init_database():
    """初始化数据库数据"""
    try:
        # 创建超级管理员
        super_admin = User.create_user(
            username='super_admin',
            password='1111',
            display_name='超级管理员',
            role='super_admin'
        )
        
        # 创建默认管理员组
        admin_group = AdminGroup.create_group(
            name='默认管理员组',
            description='系统默认创建的管理员组',
            created_by=super_admin.id
        )
        
        # 创建默认用户组
        user_group = UserGroup.create_group(
            name='默认用户组',
            description='系统默认创建的用户组',
            created_by=super_admin.id
        )
        
        # 关联默认管理员组和用户组
        admin_group.add_user_group(user_group)
        
        # 创建示例管理员（张三）
        admin_user = User.create_user(
            username='zhangsan',
            password='1111',
            display_name='张三管理员',
            role='admin',
            admin_group_id=admin_group.id
        )
        
        # 创建示例用户
        User.create_user(
            username='lisi',
            password='1111',
            display_name='李四',
            role='user',
            user_group_id=user_group.id
        )
        
        User.create_user(
            username='wangwu',
            password='1111',
            display_name='王五',
            role='user',
            user_group_id=user_group.id
        )
        
        User.create_user(
            username='zhaoliu',
            password='1111',
            display_name='赵六',
            role='user',
            user_group_id=user_group.id
        )
        
        print("数据库初始化完成")
        
    except Exception as e:
        db.session.rollback()
        print(f"数据库初始化失败: {e}")

# 创建应用实例
app = create_app(os.environ.get('FLASK_ENV', 'default'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)


