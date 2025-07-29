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
from src.models.collaboration_task import CollaborationTask, CollaborationTaskAssignment
from src.models.collaboration_task_draft import CollaborationTaskDraft, CollaborationTaskSession
from src.models.collaboration_task_summary import CollaborationTaskSummary, CollaborationTaskQualityCheck
from src.models.notification import Notification, TaskStatusReminder
from src.models.file import File
from src.models.qa_pair import QAPair

# 导入路由蓝图
from src.routes.auth import auth_bp
from src.routes.user_management import user_management_bp
from src.routes.group_management import group_management_bp
from src.routes.file_management import file_management_bp
from src.routes.task_management import task_management_bp
from src.routes.collaboration_task import collaboration_task_bp
from src.routes.collaboration_task_draft import collaboration_task_draft_bp
from src.routes.collaboration_task_summary import collaboration_task_summary_bp
from src.routes.collaboration_task_final import collaboration_task_final_bp
from src.routes.notification import notification_bp

def create_app(config_name='default'):
    """应用工厂函数"""
    static_folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'src', 'static')
    app = Flask(__name__, static_folder=static_folder, static_url_path='')
    
    from src.config import config
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)
    
    # --- 关键修复：为CORS添加 expose_headers ---
    # 这将允许前端JS读取到 Content-Disposition 头，从而正确处理文件下载
    CORS(app, origins=app.config['CORS_ORIGINS'], supports_credentials=True, expose_headers=['Content-Disposition'])
    
    db.init_app(app)
    
    # 注册蓝图
    app.register_blueprint(auth_bp, url_prefix='/api/v1/auth')
    app.register_blueprint(user_management_bp, url_prefix='/api/v1')
    app.register_blueprint(group_management_bp, url_prefix='/api/v1')
    app.register_blueprint(file_management_bp, url_prefix='/api/v1')
    app.register_blueprint(task_management_bp, url_prefix='/api/v1')
    app.register_blueprint(collaboration_task_bp, url_prefix='/api/v1')
    app.register_blueprint(collaboration_task_draft_bp, url_prefix='/api/v1')
    app.register_blueprint(collaboration_task_summary_bp, url_prefix='/api/v1')
    app.register_blueprint(collaboration_task_final_bp, url_prefix='/api/v1')
    app.register_blueprint(notification_bp, url_prefix='/api/v1')
    
    app.cli.add_command(init_db_command)

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.config["EXPORT_FOLDER"], exist_ok=True)

    @app.route("/guest")
    def serve_guest():
        return send_from_directory(app.static_folder, "index.html")

    @app.route("/")
    @app.route("/<path:path>")
    def serve(path=""):
        if path.startswith("api/"):
            return jsonify(create_response(False, error={'code': 'NOT_FOUND', 'message': '请求的API不存在'})), 404
        if path and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        index_path = os.path.join(app.static_folder, "index.html")
        if os.path.exists(index_path):
            return send_from_directory(app.static_folder, "index.html")
        else:
            return jsonify(create_response(False, error={'code': 'FRONTEND_NOT_FOUND', 'message': '前端文件未找到'})), 404
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify(create_response(False, error={'code': 'NOT_FOUND', 'message': '请求的资源不存在'})), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify(create_response(False, error={'code': 'INTERNAL_ERROR', 'message': '服务器内部错误'})), 500
        
    # ... 其他错误处理 ...

    return app

@click.command('init-db')
@with_appcontext
def init_db_command():
    """清除现有数据并创建新表。"""
    db.create_all()
    click.echo('数据库表结构已初始化。')
    # ... 填充初始数据 ...

# 创建应用实例
app = create_app(os.environ.get('FLASK_ENV', 'default'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)

