import os
from . import db, BaseModel
from datetime import datetime, timezone, timedelta # 1. 导入 timezone 和 timedelta

class File(BaseModel):
    __tablename__ = 'files'
    
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    file_type = db.Column(db.String(50), nullable=False)
    
    # 上传信息
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # 状态信息
    is_hidden = db.Column(db.Boolean, default=False, nullable=False)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    
    # 关系定义
    uploader = db.relationship('User', foreign_keys=[uploaded_by], backref='uploaded_files')
    qa_pairs = db.relationship('QAPair', backref='file', lazy='dynamic', cascade="all, delete-orphan")

    
    @classmethod
    def create_file(cls, filename, original_filename, file_path, file_size, file_type, uploaded_by):
        """创建文件记录"""
        file_record = cls(
            filename=filename,
            original_filename=original_filename,
            file_path=file_path,
            file_size=file_size,
            file_type=file_type,
            uploaded_by=uploaded_by
        )
        db.session.add(file_record)
        db.session.commit()
        return file_record
    
    @classmethod
    def get_or_404(cls, file_id):
        """根据ID获取文件，不存在则抛出404"""
        file_record = cls.query.filter_by(id=file_id, is_deleted=False).first()
        if not file_record:
            from flask import abort
            abort(404)
        return file_record
    
    def can_be_accessed_by(self, user):
        """检查用户是否可以访问此文件"""
        if user.is_super_admin():
            return True
        if self.uploaded_by == user.id:
            return True
        if user.is_admin():
            manageable_users = user.get_manageable_users()
            return self.uploader in manageable_users
        return False
    
    def can_be_deleted_by(self, user):
        """检查用户是否可以删除此文件"""
        if user.is_super_admin():
            return True
        if self.uploaded_by == user.id:
            return True
        return False
    
    def delete_physical_file(self):
        """删除物理文件"""
        try:
            if os.path.exists(self.file_path):
                os.remove(self.file_path)
        except Exception:
            pass
    
    def delete(self):
        """软删除文件记录"""
        self.is_deleted = True
        for qa_pair in self.qa_pairs:
            qa_pair.is_deleted = True
        db.session.commit()
    
    def to_dict(self, include_qa_pairs=False):
        """转换为字典"""
        
        # 2. 定义北京时区
        beijing_tz = timezone(timedelta(hours=8))

        # 3. 将UTC时间转换为北京时间
        local_created_at = self.created_at.replace(tzinfo=timezone.utc).astimezone(beijing_tz) if self.created_at else None
        local_updated_at = self.updated_at.replace(tzinfo=timezone.utc).astimezone(beijing_tz) if self.updated_at else None

        data = {
            'id': self.id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_path': self.file_path,
            'file_size': self.file_size,
            'file_type': self.file_type,
            'uploaded_by': self.uploaded_by,
            'is_hidden': self.is_hidden,
            'is_deleted': self.is_deleted,
            # 4. 使用转换后的北京时间
            'created_at': local_created_at.isoformat() if local_created_at else None,
            'updated_at': local_updated_at.isoformat() if local_updated_at else None
        }
        
        if include_qa_pairs:
            data['qa_pairs'] = [qa.to_dict() for qa in self.qa_pairs.filter_by(is_deleted=False)]
        
        return data


