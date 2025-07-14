from src.models import db
from datetime import datetime, timedelta
import uuid
from enum import Enum

class TaskStatus(Enum):
    PENDING = 'pending'
    IN_PROGRESS = 'in_progress'
    COMPLETED = 'completed'

class AssignmentStatus(Enum):
    NOT_STARTED = 'not_started'
    IN_PROGRESS = 'in_progress'
    COMPLETED = 'completed'

class Task(db.Model):
    __tablename__ = 'tasks'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    creator_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    original_file_path = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.Enum(TaskStatus), default=TaskStatus.PENDING)
    total_qa_pairs = db.Column(db.Integer, nullable=False, default=0)
    completed_assignments = db.Column(db.Integer, default=0)
    total_assignments = db.Column(db.Integer, default=0)
    merged_file_path = db.Column(db.String(500))
    expires_at = db.Column(db.DateTime, default=lambda: datetime.utcnow() + timedelta(hours=24))
    
    # 关系
    assignments = db.relationship('TaskAssignment', backref='task', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'creator_id': self.creator_id,
            'creator_name': self.creator.name if self.creator else None,
            'original_filename': self.original_filename,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'status': self.status.value if self.status else None,
            'total_qa_pairs': self.total_qa_pairs,
            'completed_assignments': self.completed_assignments,
            'total_assignments': self.total_assignments,
            'progress_percentage': (self.completed_assignments / self.total_assignments * 100) if self.total_assignments > 0 else 0,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None
        }
    
    def __repr__(self):
        return f'<Task {self.original_filename}>'

class TaskAssignment(db.Model):
    __tablename__ = 'task_assignments'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = db.Column(db.String(36), db.ForeignKey('tasks.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    start_index = db.Column(db.Integer, nullable=False)
    end_index = db.Column(db.Integer, nullable=False)
    assigned_qa_pairs = db.Column(db.Integer, nullable=False)
    status = db.Column(db.Enum(AssignmentStatus), default=AssignmentStatus.NOT_STARTED)
    last_submitted_at = db.Column(db.DateTime)
    submitted_file_path = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    qa_pairs = db.relationship('QAPair', backref='task_assignment', lazy=True, cascade='all, delete-orphan')
    
    # 唯一约束
    __table_args__ = (db.UniqueConstraint('task_id', 'user_id', name='unique_task_user'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else None,
            'start_index': self.start_index,
            'end_index': self.end_index,
            'assigned_qa_pairs': self.assigned_qa_pairs,
            'status': self.status.value if self.status else None,
            'last_submitted_at': self.last_submitted_at.isoformat() if self.last_submitted_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<TaskAssignment {self.task_id}-{self.user_id}>'

