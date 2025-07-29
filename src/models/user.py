from . import db, BaseModel
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

class User(BaseModel):
    __tablename__ = 'users'
    
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    display_name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.Enum('super_admin', 'admin', 'user', name='user_role'), nullable=False, default='user')
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    last_login_at = db.Column(db.DateTime, nullable=True)
    
    # 外键关系
    admin_group_id = db.Column(db.Integer, db.ForeignKey('admin_groups.id'), nullable=True)
    user_group_id = db.Column(db.Integer, db.ForeignKey('user_groups.id'), nullable=True)
    
    # 关系定义
    admin_group = db.relationship('AdminGroup', foreign_keys=[admin_group_id], backref='members')
    user_group = db.relationship('UserGroup', foreign_keys=[user_group_id], backref='members')
    
    @classmethod
    def create_user(cls, username, password, display_name, role='user', admin_group_id=None, user_group_id=None):
        """创建新用户"""
        user = cls(
            username=username,
            password_hash=generate_password_hash(password),
            display_name=display_name,
            role=role,
            admin_group_id=admin_group_id,
            user_group_id=user_group_id
        )
        db.session.add(user)
        db.session.commit()
        return user
    
    @classmethod
    def get_by_username(cls, username):
        """根据用户名获取活跃的用户"""
        return cls.query.filter_by(username=username, is_active=True).first()
    
    @classmethod
    def check_username_exists(cls, username):
        """检查用户名是否存在（无论是否活跃）"""
        return cls.query.filter_by(username=username).first() is not None
        
    @classmethod
    def get_or_404(cls, user_id):
        """根据ID获取用户，不存在则抛出404"""
        user = cls.query.filter_by(id=user_id, is_active=True).first()
        if not user:
            from flask import abort
            abort(404)
        return user
    
    def set_password(self, password):
        """设置密码"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """验证密码"""
        return check_password_hash(self.password_hash, password)
    
    def is_super_admin(self):
        """是否为超级管理员"""
        return self.role == 'super_admin'
    
    def is_admin(self):
        """是否为管理员"""
        return self.role in ['super_admin', 'admin']
    
    def get_manageable_users(self):
        """获取当前用户可管理的用户列表"""
        if self.is_super_admin():
            # 超级管理员可以管理所有用户
            return User.query.filter_by(is_active=True).all()
        elif self.is_admin() and self.admin_group:
            # 管理员可以管理其管理员组关联的用户组中的用户
            manageable_users = []
            for user_group in self.admin_group.user_groups:
                manageable_users.extend(user_group.members)
            return manageable_users
        else:
            # 普通用户只能管理自己
            return [self]
    
    def get_manageable_user_groups(self):
        """获取当前用户可管理的用户组列表"""
        if self.is_super_admin():
            # 超级管理员可以管理所有用户组
            from src.models.user_group import UserGroup
            return UserGroup.query.filter_by(is_active=True).all()
        elif self.is_admin() and self.admin_group:
            # 管理员可以管理其管理员组关联的用户组
            return list(self.admin_group.user_groups)
        else:
            # 普通用户不能管理用户组
            return []
    
    def to_dict(self, include_sensitive=False):
        """转换为字典"""
        data = {
            'id': self.id,
            'username': self.username,
            'display_name': self.display_name,
            'role': self.role,
            'is_active': self.is_active,
            'admin_group_id': self.admin_group_id,
            'user_group_id': self.user_group_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None,
            'admin_group_name': self.admin_group.name if self.admin_group else None,
            'user_group_name': self.user_group.name if self.user_group else None
        }
        
        if include_sensitive:
            data.update({
                'admin_group': self.admin_group.to_dict() if self.admin_group else None,
                'user_group': self.user_group.to_dict() if self.user_group else None
            })
        
        return data

