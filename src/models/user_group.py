from . import db, BaseModel

class UserGroup(BaseModel):
    __tablename__ = 'user_groups'
    
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # 关系定义
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_user_groups')
    
    @classmethod
    def create_group(cls, name, description='', created_by=None):
        """创建用户组"""
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
        """根据ID获取用户组"""
        return cls.query.filter_by(id=group_id, is_active=True).first()
    
    def to_dict(self, include_members=False):
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
        
        if include_members:
            data.update({
                'members_count': len(self.members),
                'admin_groups_count': len(self.admin_groups),
                'creator_name': self.creator.display_name if self.creator else None
            })
        
        return data

