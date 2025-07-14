from . import db, BaseModel

class AdminGroup(BaseModel):
    __tablename__ = 'admin_groups'
    
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # 关系定义
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_admin_groups')
    
    # 与用户组的多对多关系
    user_groups = db.relationship('UserGroup', secondary='admin_group_user_group', backref='admin_groups')
    
    @classmethod
    def create_group(cls, name, description='', created_by=None):
        """创建管理员组"""
        group = cls(
            name=name,
            description=description,
            created_by=created_by
        )
        db.session.add(group)
        db.session.commit()
        return group
    
    @classmethod
    def get_by_id(cls, group_id):
        """根据ID获取管理员组"""
        return cls.query.filter_by(id=group_id, is_active=True).first()
    
    def add_user_group(self, user_group):
        """添加用户组关联"""
        if user_group not in self.user_groups:
            self.user_groups.append(user_group)
            db.session.commit()
    
    def remove_user_group(self, user_group):
        """移除用户组关联"""
        if user_group in self.user_groups:
            self.user_groups.remove(user_group)
            db.session.commit()
    
    def to_dict(self, include_associations=False):
        """转换为字典"""
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'is_active': self.is_active,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_associations:
            data.update({
                'members_count': len(self.members) if hasattr(self, 'members') else 0,
                'user_groups_count': len(self.user_groups),
                'creator_name': self.creator.display_name if self.creator else None
            })
        
        return data

# 管理员组-用户组关联表
admin_group_user_group = db.Table('admin_group_user_group',
    db.Column('admin_group_id', db.Integer, db.ForeignKey('admin_groups.id'), primary_key=True),
    db.Column('user_group_id', db.Integer, db.ForeignKey('user_groups.id'), primary_key=True)
)

