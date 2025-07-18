from . import db, BaseModel
from datetime import datetime

class CollaborationTaskDraft(BaseModel):
    """协作任务草稿模型 - 用于暂存用户的编辑进度"""
    __tablename__ = 'collaboration_task_drafts'
    
    task_id = db.Column(db.Integer, db.ForeignKey('collaboration_tasks.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    qa_pair_id = db.Column(db.Integer, db.ForeignKey('qa_pairs.id'), nullable=False)
    draft_prompt = db.Column(db.Text, nullable=True)
    draft_completion = db.Column(db.Text, nullable=True)
    is_auto_saved = db.Column(db.Boolean, nullable=False, default=False)
    last_saved_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    # 关系定义
    task = db.relationship('CollaborationTask', backref='drafts')
    user = db.relationship('User', backref='collaboration_drafts')
    qa_pair = db.relationship('QAPair', backref='drafts')
    
    # 唯一约束：每个用户对每个QA对只能有一个草稿
    __table_args__ = (
        db.UniqueConstraint('task_id', 'user_id', 'qa_pair_id', name='unique_task_user_qa_draft'),
    )
    
    @classmethod
    def save_draft(cls, task_id, user_id, qa_pair_id, prompt=None, completion=None, is_auto_saved=False):
        """保存或更新草稿"""
        draft = cls.query.filter_by(
            task_id=task_id,
            user_id=user_id,
            qa_pair_id=qa_pair_id
        ).first()
        
        if draft:
            # 更新现有草稿
            if prompt is not None:
                draft.draft_prompt = prompt
            if completion is not None:
                draft.draft_completion = completion
            draft.is_auto_saved = is_auto_saved
            draft.last_saved_at = datetime.utcnow()
        else:
            # 创建新草稿
            draft = cls(
                task_id=task_id,
                user_id=user_id,
                qa_pair_id=qa_pair_id,
                draft_prompt=prompt,
                draft_completion=completion,
                is_auto_saved=is_auto_saved,
                last_saved_at=datetime.utcnow()
            )
            db.session.add(draft)
        
        db.session.commit()
        return draft
    
    @classmethod
    def get_draft(cls, task_id, user_id, qa_pair_id):
        """获取草稿"""
        return cls.query.filter_by(
            task_id=task_id,
            user_id=user_id,
            qa_pair_id=qa_pair_id
        ).first()
    
    @classmethod
    def get_user_drafts(cls, task_id, user_id):
        """获取用户在某个任务中的所有草稿"""
        return cls.query.filter_by(
            task_id=task_id,
            user_id=user_id
        ).all()
    
    @classmethod
    def clear_draft(cls, task_id, user_id, qa_pair_id):
        """清除草稿（当正式保存QA对时）"""
        draft = cls.query.filter_by(
            task_id=task_id,
            user_id=user_id,
            qa_pair_id=qa_pair_id
        ).first()
        
        if draft:
            db.session.delete(draft)
            db.session.commit()
    
    @classmethod
    def clear_user_drafts(cls, task_id, user_id):
        """清除用户在某个任务中的所有草稿"""
        cls.query.filter_by(
            task_id=task_id,
            user_id=user_id
        ).delete()
        db.session.commit()
    
    def has_changes(self, current_prompt, current_completion):
        """检查当前内容是否与草稿有变化"""
        return (
            self.draft_prompt != current_prompt or 
            self.draft_completion != current_completion
        )
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'task_id': self.task_id,
            'user_id': self.user_id,
            'qa_pair_id': self.qa_pair_id,
            'draft_prompt': self.draft_prompt,
            'draft_completion': self.draft_completion,
            'is_auto_saved': self.is_auto_saved,
            'last_saved_at': self.last_saved_at.isoformat() if self.last_saved_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class CollaborationTaskSession(BaseModel):
    """协作任务会话模型 - 记录用户的工作会话"""
    __tablename__ = 'collaboration_task_sessions'
    
    task_id = db.Column(db.Integer, db.ForeignKey('collaboration_tasks.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    session_start = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    session_end = db.Column(db.DateTime, nullable=True)
    last_activity = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    activity_count = db.Column(db.Integer, nullable=False, default=0)
    
    # 关系定义
    task = db.relationship('CollaborationTask', backref='sessions')
    user = db.relationship('User', backref='collaboration_sessions')
    
    @classmethod
    def start_session(cls, task_id, user_id):
        """开始新会话或恢复现有会话"""
        # 结束之前的活跃会话
        cls.query.filter_by(
            task_id=task_id,
            user_id=user_id,
            is_active=True
        ).update({
            'is_active': False,
            'session_end': datetime.utcnow()
        })
        
        # 创建新会话
        session = cls(
            task_id=task_id,
            user_id=user_id,
            session_start=datetime.utcnow(),
            last_activity=datetime.utcnow(),
            is_active=True,
            activity_count=1
        )
        db.session.add(session)
        db.session.commit()
        return session
    
    @classmethod
    def update_activity(cls, task_id, user_id):
        """更新用户活动"""
        session = cls.query.filter_by(
            task_id=task_id,
            user_id=user_id,
            is_active=True
        ).first()
        
        if session:
            session.last_activity = datetime.utcnow()
            session.activity_count += 1
            db.session.commit()
        
        return session
    
    @classmethod
    def end_session(cls, task_id, user_id):
        """结束会话"""
        session = cls.query.filter_by(
            task_id=task_id,
            user_id=user_id,
            is_active=True
        ).first()
        
        if session:
            session.is_active = False
            session.session_end = datetime.utcnow()
            db.session.commit()
        
        return session
    
    @classmethod
    def get_active_session(cls, task_id, user_id):
        """获取活跃会话"""
        return cls.query.filter_by(
            task_id=task_id,
            user_id=user_id,
            is_active=True
        ).first()
    
    def get_session_duration(self):
        """获取会话持续时间（分钟）"""
        end_time = self.session_end or datetime.utcnow()
        duration = end_time - self.session_start
        return duration.total_seconds() / 60
    
    def get_idle_time(self):
        """获取空闲时间（分钟）"""
        idle_duration = datetime.utcnow() - self.last_activity
        return idle_duration.total_seconds() / 60
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'task_id': self.task_id,
            'user_id': self.user_id,
            'session_start': self.session_start.isoformat() if self.session_start else None,
            'session_end': self.session_end.isoformat() if self.session_end else None,
            'last_activity': self.last_activity.isoformat() if self.last_activity else None,
            'is_active': self.is_active,
            'activity_count': self.activity_count,
            'session_duration': self.get_session_duration(),
            'idle_time': self.get_idle_time() if self.is_active else 0
        }

