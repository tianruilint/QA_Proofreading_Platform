import os
from datetime import timedelta

class Config:
    """应用配置类"""
    
    # 基础配置
    SECRET_KEY = os.environ.get("SECRET_KEY") or "dev-secret-key-change-in-production"
    
    # 数据库配置
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL") or \
        "sqlite:///" + os.path.join(os.path.dirname(os.path.dirname(__file__)), "instance", "qa_proofreading.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }
    
    # JWT配置
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or SECRET_KEY
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    
    # Redis配置
    REDIS_URL = os.environ.get("REDIS_URL") or "redis://localhost:6379/0"
    
    # 文件上传配置
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
    EXPORT_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "exports")
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB
    ALLOWED_EXTENSIONS = {"jsonl", "json"}
    
    # CORS配置
    CORS_ORIGINS = ["http://localhost:5173"]
    
    # 分页配置
    DEFAULT_PAGE_SIZE = 20
    MAX_PAGE_SIZE = 100
    
    # 会话配置
    SESSION_TIMEOUT = 24 * 60 * 60  # 24小时（秒）
    GUEST_SESSION_TIMEOUT = 2 * 60 * 60  # 2小时（秒）
    
    # 文件清理配置
    AUTO_CLEANUP_ENABLED = True
    CLEANUP_INTERVAL = 60 * 60  # 1小时（秒）
    
    # 日志配置
    LOG_LEVEL = os.environ.get("LOG_LEVEL") or "INFO"
    LOG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs", "app.log")
    
    # 安全配置
    BCRYPT_LOG_ROUNDS = 12
    
    @staticmethod
    def init_app(app):
        """初始化应用配置"""
        # 创建必要的目录
        os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(Config.EXPORT_FOLDER, exist_ok=True)
        os.makedirs(os.path.dirname(Config.LOG_FILE), exist_ok=True)


class DevelopmentConfig(Config):
    """开发环境配置"""
    DEBUG = True
    

class ProductionConfig(Config):
    """生产环境配置"""
    DEBUG = False
    CORS_ORIGINS = ["http://localhost:5001"]  # 生产环境限制CORS来源


class TestingConfig(Config):
    """测试环境配置"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    WTF_CSRF_ENABLED = False


config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
    "default": DevelopmentConfig
}


