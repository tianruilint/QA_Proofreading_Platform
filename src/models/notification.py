from . import db, BaseModel
from datetime import datetime

class Notification(BaseModel):
    """通知模型"""
    __tablename__ = 'notifications'
    
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    type = db.Column(db.Enum('task_assignment', 'task_completion', 'task_reminder', 'system', name='notification_type'), 
                    nullable=False, default='system')
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    related_task_id = db.Column(db.Integer, db.ForeignKey('collaboration_tasks.id'), nullable=True)
    
    # 关系定义
    user = db.relationship('User', backref='notifications')
    related_task = db.relationship('CollaborationTask', backref='notifications')
    
    @classmethod
    def create_notification(cls, user_id, title, content, notification_type='system', related_task_id=None):
        """创建通知"""
        notification = cls(
            user_id=user_id,
            title=title,
            content=content,
            type=notification_type,
            related_task_id=related_task_id
        )
        db.session.add(notification)
        db.session.commit()
        return notification
    
    @classmethod
    def create_task_assignment_notification(cls, user_id, task, assignment):
        """创建任务分配通知"""
        title = f"新的协作任务分配：{task.name}"
        content = f"您被分配了协作任务'{task.name}'，需要处理 {assignment.get_qa_count()} 个QA对"
        if task.deadline:
            content += f"，截止时间：{task.deadline.strftime('%Y-%m-%d %H:%M')}"
        content += "。请及时完成任务。"
        
        return cls.create_notification(
            user_id=user_id,
            title=title,
            content=content,
            notification_type='task_assignment',
            related_task_id=task.id
        )
    
    @classmethod
    def create_task_completion_notification(cls, user_id, task):
        """创建任务完成通知"""
        title = f"协作任务已完成：{task.name}"
        content = f"协作任务'{task.name}'的所有分配已完成，您可以进行最终审核和导出。"
        
        return cls.create_notification(
            user_id=user_id,
            title=title,
            content=content,
            notification_type='task_completion',
            related_task_id=task.id
        )
    
    @classmethod
    def create_task_reminder_notification(cls, user_id, task, assignment):
        """创建任务提醒通知"""
        title = f"任务提醒：{task.name}"
        content = f"您的协作任务'{task.name}'尚未完成，还有 {assignment.get_qa_count()} 个QA对待处理"
        if task.deadline:
            content += f"，截止时间：{task.deadline.strftime('%Y-%m-%d %H:%M')}"
        content += "。请尽快完成。"
        
        return cls.create_notification(
            user_id=user_id,
            title=title,
            content=content,
            notification_type='task_reminder',
            related_task_id=task.id
        )
    
    def mark_as_read(self):
        """标记为已读"""
        self.is_read = True
        db.session.commit()
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'content': self.content,
            'type': self.type,
            'is_read': self.is_read,
            'related_task_id': self.related_task_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'related_task_title': self.related_task.title if self.related_task else None
        }


class TaskStatusReminder(BaseModel):
    """任务状态提醒模型"""
    __tablename__ = 'task_status_reminders'
    
    task_id = db.Column(db.Integer, db.ForeignKey('collaboration_tasks.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    reminder_type = db.Column(db.Enum('assignment_pending', 'assignment_overdue', 'task_completion', name='reminder_type'), 
                             nullable=False)
    is_sent = db.Column(db.Boolean, nullable=False, default=False)
    sent_at = db.Column(db.DateTime, nullable=True)
    
    # 关系定义
    task = db.relationship('CollaborationTask', backref='status_reminders')
    user = db.relationship('User', backref='task_status_reminders')
    
    @classmethod
    def create_reminder(cls, task_id, user_id, reminder_type):
        """创建提醒记录"""
        reminder = cls(
            task_id=task_id,
            user_id=user_id,
            reminder_type=reminder_type
        )
        db.session.add(reminder)
        db.session.commit()
        return reminder
    
    def mark_as_sent(self):
        """标记为已发送"""
        self.is_sent = True
        self.sent_at = datetime.utcnow()
        db.session.commit()
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'task_id': self.task_id,
            'user_id': self.user_id,
            'reminder_type': self.reminder_type,
            'is_sent': self.is_sent,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

