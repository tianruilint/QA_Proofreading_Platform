from src.models import db
from datetime import datetime
import uuid

class QAPair(db.Model):
    __tablename__ = 'qa_pairs'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_assignment_id = db.Column(db.String(36), db.ForeignKey('task_assignments.id'), nullable=True)
    single_file_session_id = db.Column(db.String(36), db.ForeignKey('single_file_sessions.id'), nullable=True)
    original_index = db.Column(db.Integer, nullable=False)
    prompt = db.Column(db.Text, nullable=False)
    completion = db.Column(db.Text, nullable=False)
    is_deleted = db.Column(db.Boolean, default=False)
    edited_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    last_edited_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 检查约束：QA对要么属于协作任务，要么属于单文件会话，但不能同时属于两者
    __table_args__ = (
        db.CheckConstraint(
            '(task_assignment_id IS NOT NULL AND single_file_session_id IS NULL) OR '
            '(task_assignment_id IS NULL AND single_file_session_id IS NOT NULL)',
            name='qa_pairs_assignment_xor_session'
        ),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'task_assignment_id': self.task_assignment_id,
            'single_file_session_id': self.single_file_session_id,
            'original_index': self.original_index,
            'prompt': self.prompt,
            'completion': self.completion,
            'is_deleted': self.is_deleted,
            'edited_by': self.edited_by,
            'editor_name': self.editor.name if self.editor else None,
            'last_edited_at': self.last_edited_at.isoformat() if self.last_edited_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<QAPair {self.id}>'

