from . import db, BaseModel
from datetime import datetime

class QAPair(BaseModel):
    __tablename__ = 'qa_pairs'
    
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'), nullable=False)
    index_in_file = db.Column(db.Integer, nullable=False)
    prompt = db.Column(db.Text, nullable=False)
    completion = db.Column(db.Text, nullable=False)
    
    # 编辑信息
    edited_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    edited_at = db.Column(db.DateTime, nullable=True)
    
    # 状态信息
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    
    # 关系定义
    editor = db.relationship('User', foreign_keys=[edited_by], backref='edited_qa_pairs')
    
    @classmethod
    def create_from_jsonl_data(cls, file_id, qa_pairs_data):
        """从JSONL数据创建QA对记录"""
        qa_pairs = []
        for index, qa_data in enumerate(qa_pairs_data):
            qa_pair = cls(
                file_id=file_id,
                index_in_file=index,
                prompt=qa_data['prompt'],
                completion=qa_data['completion']
            )
            qa_pairs.append(qa_pair)
            db.session.add(qa_pair)
        
        db.session.commit()
        return qa_pairs
    
    @classmethod
    def get_or_404(cls, qa_id):
        """根据ID获取QA对，不存在则抛出404"""
        qa_pair = cls.query.filter_by(id=qa_id, is_deleted=False).first()
        if not qa_pair:
            from flask import abort
            abort(404)
        return qa_pair
    
    @classmethod
    def get_by_file_and_range(cls, file_id, start_index=None, end_index=None, include_deleted=False):
        """根据文件ID和索引范围获取QA对"""
        query = cls.query.filter_by(file_id=file_id)
        
        if not include_deleted:
            query = query.filter_by(is_deleted=False)
        
        if start_index is not None:
            query = query.filter(cls.index_in_file >= start_index)
        
        if end_index is not None:
            query = query.filter(cls.index_in_file <= end_index)
        
        return query.order_by(cls.index_in_file).all()
    
    def can_be_edited_by(self, user):
        """检查用户是否可以编辑此QA对"""
        # 通过文件的权限检查
        from .file import File
        file_record = File.query.get(self.file_id)
        if file_record:
            return file_record.can_be_accessed_by(user)
        return False
    
    def edit(self, prompt, completion, editor_id):
        """编辑QA对"""
        self.prompt = prompt
        self.completion = completion
        self.edited_by = editor_id
        self.edited_at = datetime.utcnow()
        db.session.commit()
    
    def soft_delete(self, deleted_by):
        """软删除QA对"""
        self.is_deleted = True
        self.edited_by = deleted_by
        self.edited_at = datetime.utcnow()
        db.session.commit()
    
    def to_dict(self, include_edit_history=False):
        """转换为字典"""
        data = {
            'id': self.id,
            'file_id': self.file_id,
            'index_in_file': self.index_in_file,
            'prompt': self.prompt,
            'completion': self.completion,
            'is_deleted': self.is_deleted,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_edit_history:
            data.update({
                'edited_by': self.edited_by,
                'edited_at': self.edited_at.isoformat() if self.edited_at else None,
                'editor_name': self.editor.display_name if self.editor else None
            })
        
        return data

