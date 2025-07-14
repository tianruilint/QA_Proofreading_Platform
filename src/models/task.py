from . import db, BaseModel
from datetime import datetime

class Task(BaseModel):
    __tablename__ = 'tasks'
    
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.Enum('draft', 'active', 'completed', 'cancelled', name='task_status'), 
                      nullable=False, default='draft')
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'), nullable=True)
    
    # 关系定义
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_tasks')
    file = db.relationship('File', foreign_keys=[file_id], backref='tasks')
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'created_by': self.created_by,
            'file_id': self.file_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class TaskAssignment(BaseModel):
    __tablename__ = 'task_assignments'
    
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), primary_key=True)
    assignee_id = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系定义
    task = db.relationship('Task', backref='assignments')
    assignee = db.relationship('User', backref='task_assignments')

