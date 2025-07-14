from src.models import db
from datetime import datetime
import uuid

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False, unique=True)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login_at = db.Column(db.DateTime)
    
    # 关系
    created_tasks = db.relationship('Task', backref='creator', lazy=True, cascade='all, delete-orphan')
    task_assignments = db.relationship('TaskAssignment', backref='user', lazy=True, cascade='all, delete-orphan')
    single_file_sessions = db.relationship('SingleFileSession', backref='user', lazy=True, cascade='all, delete-orphan')
    edited_qa_pairs = db.relationship('QAPair', backref='editor', lazy=True, foreign_keys='QAPair.edited_by')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'is_admin': self.is_admin,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None
        }
    
    def __repr__(self):
        return f'<User {self.name}>'

