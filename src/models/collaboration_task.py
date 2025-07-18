from . import db, BaseModel
from datetime import datetime
from sqlalchemy import and_, or_

class CollaborationTask(BaseModel):
    """协作任务模型"""
    __tablename__ = 'collaboration_tasks'
    
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    status = db.Column(db.Enum('draft', 'in_progress', 'completed', 'cancelled', name='collaboration_task_status'), 
                      nullable=False, default='draft')
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'), nullable=True)
    original_filename = db.Column(db.String(255), nullable=False)
    total_qa_pairs = db.Column(db.Integer, nullable=False, default=0)
    deadline = db.Column(db.DateTime, nullable=True)
    
    # 关系定义
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_collaboration_tasks')
    file = db.relationship('File', foreign_keys=[file_id], backref='collaboration_tasks')
    
    @classmethod
    def create_task(cls, title, description, original_filename, created_by, total_qa_pairs, deadline=None):
        """创建协作任务"""
        task = cls(
            title=title,
            description=description,
            original_filename=original_filename,
            created_by=created_by,
            total_qa_pairs=total_qa_pairs,
            deadline=deadline
        )
        db.session.add(task)
        db.session.commit()
        return task
    
    def can_be_accessed_by(self, user):
        """检查用户是否可以访问此任务"""
        # 创建者可以访问
        if self.created_by == user.id:
            return True
        
        # 被分配的用户可以访问
        assignment = self.get_assignment_for_user(user.id)
        if assignment:
            return True
        
        # 超级管理员可以访问所有任务
        if user.is_super_admin():
            return True
        
        return False
    
    def can_be_managed_by(self, user):
        """检查用户是否可以管理此任务"""
        # 创建者可以管理
        if self.created_by == user.id:
            return True
        
        # 超级管理员可以管理所有任务
        if user.is_super_admin():
            return True
        
        return False
    
    def get_assignment_for_user(self, user_id):
        """获取用户在此任务中的分配"""
        return CollaborationTaskAssignment.query.filter_by(
            task_id=self.id,
            assigned_to=user_id
        ).first()
    
    def get_progress(self):
        """获取任务进度"""
        assignments = CollaborationTaskAssignment.query.filter_by(task_id=self.id).all()
        if not assignments:
            return {
                'total_assignments': 0,
                'completed_assignments': 0,
                'completion_rate': 0.0
            }
        
        completed_count = sum(1 for assignment in assignments if assignment.status == 'completed')
        
        return {
            'total_assignments': len(assignments),
            'completed_assignments': completed_count,
            'completion_rate': completed_count / len(assignments) if assignments else 0.0
        }
    
    def is_completed(self):
        """检查任务是否完成"""
        progress = self.get_progress()
        return progress['completion_rate'] == 1.0
    
    def to_dict(self, include_assignments=False, include_progress=False):
        """转换为字典"""
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'created_by': self.created_by,
            'file_id': self.file_id,
            'original_filename': self.original_filename,
            'total_qa_pairs': self.total_qa_pairs,
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'creator_name': self.creator.display_name if self.creator else None
        }
        
        if include_assignments:
            assignments = CollaborationTaskAssignment.query.filter_by(task_id=self.id).all()
            data['assignments'] = [assignment.to_dict() for assignment in assignments]
        
        if include_progress:
            data['progress'] = self.get_progress()
        
        return data


class CollaborationTaskAssignment(BaseModel):
    """协作任务分配模型"""
    __tablename__ = 'collaboration_task_assignments'
    
    task_id = db.Column(db.Integer, db.ForeignKey('collaboration_tasks.id'), nullable=False)
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    start_index = db.Column(db.Integer, nullable=False)
    end_index = db.Column(db.Integer, nullable=False)
    status = db.Column(db.Enum('pending', 'in_progress', 'completed', name='assignment_status'), 
                      nullable=False, default='pending')
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    # 关系定义
    task = db.relationship('CollaborationTask', backref='assignments')
    assignee = db.relationship('User', backref='collaboration_task_assignments')
    
    @classmethod
    def create_assignment(cls, task_id, assigned_to, start_index, end_index):
        """创建任务分配"""
        assignment = cls(
            task_id=task_id,
            assigned_to=assigned_to,
            start_index=start_index,
            end_index=end_index
        )
        db.session.add(assignment)
        db.session.commit()
        return assignment
    
    def start_work(self):
        """开始工作"""
        if self.status == 'pending':
            self.status = 'in_progress'
            self.started_at = datetime.utcnow()
            db.session.commit()
    
    def submit(self):
        """提交任务"""
        if self.status in ['pending', 'in_progress']:
            self.status = 'completed'
            self.completed_at = datetime.utcnow()
            
            # 更新所有分配的QA对的编辑者信息
            from src.models.qa_pair import QAPair
            qa_pairs = QAPair.query.filter(
                QAPair.file_id == self.task.file_id,
                QAPair.index >= self.start_index,
                QAPair.index <= self.end_index
            ).all()
            
            # 为所有QA对设置编辑者，即使未修改的也记录为当前分配者编辑
            for qa_pair in qa_pairs:
                qa_pair.edited_by = self.assigned_to
                qa_pair.edited_at = datetime.utcnow()
            
            db.session.commit()
            
            # 清除用户的草稿数据
            from src.models.collaboration_task_draft import CollaborationTaskDraft
            CollaborationTaskDraft.clear_user_drafts(self.task_id, self.assigned_to)
            
            # 检查任务是否全部完成
            task = self.task
            if task.is_completed():
                task.status = 'completed'
                db.session.commit()
                
                # 发送任务完成通知
                try:
                    from src.routes.notification import send_task_completion_notification
                    send_task_completion_notification(task)
                except ImportError:
                    pass  # 避免循环导入
        
        # 检查任务是否全部完成
        self.check_completion_and_notify()
        
        db.session.commit()
    
    def get_qa_count(self):
        return self.end_index - self.start_index + 1
    
    def check_completion_and_notify(self):
        """检查任务是否全部完成并发送通知"""
        task = CollaborationTask.query.get(self.task_id)
        if not task:
            return False
            
        assignments = CollaborationTaskAssignment.query.filter_by(task_id=self.task_id).all()
        completed_assignments = [a for a in assignments if a.status == 'completed']
        
        if len(completed_assignments) == len(assignments) and len(assignments) > 0:
            # 所有分配都已完成，更新任务状态
            task.status = 'completed'
            task.completed_at = datetime.utcnow()
            
            # 发送完成通知给管理员
            from src.models.notification import Notification
            Notification.create_notification(
                user_id=task.created_by,
                notification_type='task_completed',
                title='协作任务已完成',
                content=f'协作任务"{task.name}"的所有分配已完成，可以查看汇总结果。',
                related_task_id=task.id
            )
            
            db.session.commit()
            return True
        
        return False
    
    def to_dict(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'assigned_to': self.assigned_to,
            'assignee_name': self.assignee.display_name if self.assignee else None,
            'start_index': self.start_index,
            'end_index': self.end_index,
            'qa_count': self.get_qa_count(),
            'status': self.status,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }

