from . import db, BaseModel
from datetime import datetime
from src.models.qa_pair import QAPair # 关键修复：导入QAPair模型

class CollaborationTaskSummary(BaseModel):
    """协作任务汇总模型 - 用于管理员查看汇总结果"""
    __tablename__ = 'collaboration_task_summaries'
    
    task_id = db.Column(db.Integer, db.ForeignKey('collaboration_tasks.id'), nullable=False)
    qa_pair_id = db.Column(db.Integer, db.ForeignKey('qa_pairs.id'), nullable=False)
    original_prompt = db.Column(db.Text, nullable=True)
    original_completion = db.Column(db.Text, nullable=True)
    edited_prompt = db.Column(db.Text, nullable=True)
    edited_completion = db.Column(db.Text, nullable=True)
    editor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey('collaboration_task_assignments.id'), nullable=True)
    is_modified = db.Column(db.Boolean, nullable=False, default=False)
    submitted_at = db.Column(db.DateTime, nullable=True)
    
    # 关系定义
    task = db.relationship('CollaborationTask', backref='summary_items')
    qa_pair = db.relationship('QAPair', backref='summary_items')
    editor = db.relationship('User', backref='edited_summaries')
    assignment = db.relationship('CollaborationTaskAssignment', backref='summary_items')
    
    __table_args__ = (
        db.UniqueConstraint('task_id', 'qa_pair_id', name='unique_task_qa_summary'),
    )
    
    @classmethod
    def create_summary_from_assignment(cls, assignment):
        """从任务分配创建汇总记录"""
        qa_pairs = QAPair.query.filter(
            QAPair.file_id == assignment.task.file_id,
            QAPair.index_in_file >= assignment.start_index,
            QAPair.index_in_file <= assignment.end_index
        ).all()
        
        summary_items = []
        for qa_pair in qa_pairs:
            existing_summary = cls.query.filter_by(
                task_id=assignment.task_id,
                qa_pair_id=qa_pair.id
            ).first()
            
            if not existing_summary:
                summary_item = cls(
                    task_id=assignment.task_id,
                    qa_pair_id=qa_pair.id,
                    original_prompt=qa_pair.prompt,
                    original_completion=qa_pair.completion,
                    edited_prompt=qa_pair.prompt,
                    edited_completion=qa_pair.completion,
                    editor_id=assignment.assigned_to,
                    assignment_id=assignment.id,
                    is_modified=qa_pair.edited_by is not None,
                    submitted_at=datetime.utcnow()
                )
                db.session.add(summary_item)
                summary_items.append(summary_item)
        
        db.session.commit()
        return summary_items
    
    @classmethod
    def get_task_summary(cls, task_id, page=1, per_page=20):
        """获取任务汇总"""
        # 关键修复：正确地 join QAPair 表并按其 index_in_file 字段排序
        query = cls.query.join(QAPair, cls.qa_pair_id == QAPair.id).filter(
            cls.task_id == task_id
        ).order_by(QAPair.index_in_file)
        
        pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        return pagination
    
    @classmethod
    def get_task_progress(cls, task_id):
        """获取任务进度统计"""
        from src.models.collaboration_task import CollaborationTaskAssignment
        
        assignments = CollaborationTaskAssignment.query.filter_by(task_id=task_id).all()
        
        total_assignments = len(assignments)
        completed_assignments = len([a for a in assignments if a.status == 'completed'])
        
        total_qa_pairs = cls.query.filter_by(task_id=task_id).count()
        modified_qa_pairs = cls.query.filter_by(task_id=task_id, is_modified=True).count()
        
        return {
            'total_assignments': total_assignments,
            'completed_assignments': completed_assignments,
            'completion_rate': (completed_assignments / total_assignments * 100) if total_assignments > 0 else 0,
            'total_qa_pairs': total_qa_pairs,
            'modified_qa_pairs': modified_qa_pairs,
            'modification_rate': (modified_qa_pairs / total_qa_pairs * 100) if total_qa_pairs > 0 else 0
        }
    
    def update_from_qa_pair(self, qa_pair):
        """从QA对更新汇总记录"""
        self.edited_prompt = qa_pair.prompt
        self.edited_completion = qa_pair.completion
        self.is_modified = (
            self.original_prompt != qa_pair.prompt or 
            self.original_completion != qa_pair.completion
        )
        if qa_pair.edited_by:
            self.editor_id = qa_pair.edited_by
        db.session.commit()
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'task_id': self.task_id,
            'qa_pair_id': self.qa_pair_id,
            # 关键修复：使用正确的字段名 index_in_file
            'qa_pair_index': self.qa_pair.index_in_file if self.qa_pair else None,
            'original_prompt': self.original_prompt,
            'original_completion': self.original_completion,
            'edited_prompt': self.edited_prompt,
            'edited_completion': self.edited_completion,
            'editor_id': self.editor_id,
            'editor_name': self.editor.display_name if self.editor else None,
            'assignment_id': self.assignment_id,
            'is_modified': self.is_modified,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class CollaborationTaskQualityCheck(BaseModel):
    """协作任务质量检查模型 - 管理员质量控制"""
    __tablename__ = 'collaboration_task_quality_checks'
    
    task_id = db.Column(db.Integer, db.ForeignKey('collaboration_tasks.id'), nullable=False)
    qa_pair_id = db.Column(db.Integer, db.ForeignKey('qa_pairs.id'), nullable=False)
    checker_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    original_editor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    check_status = db.Column(db.Enum('approved', 'rejected', 'modified', name='check_status'), 
                                 nullable=False, default='approved')
    check_comment = db.Column(db.Text, nullable=True)
    checked_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    
    # (The rest of this class remains unchanged)
    task = db.relationship('CollaborationTask', backref='quality_checks')
    qa_pair = db.relationship('QAPair', backref='quality_checks')
    checker = db.relationship('User', foreign_keys=[checker_id], backref='quality_checks_made')
    original_editor = db.relationship('User', foreign_keys=[original_editor_id], backref='quality_checks_received')
    
    __table_args__ = (
        db.UniqueConstraint('task_id', 'qa_pair_id', name='unique_task_qa_quality_check'),
    )
    
    @classmethod
    def create_check(cls, task_id, qa_pair_id, checker_id, original_editor_id=None, 
                     check_status='approved', check_comment=None):
        check = cls(
            task_id=task_id, qa_pair_id=qa_pair_id, checker_id=checker_id,
            original_editor_id=original_editor_id, check_status=check_status,
            check_comment=check_comment, checked_at=datetime.utcnow()
        )
        db.session.add(check)
        db.session.commit()
        return check
    
    @classmethod
    def get_task_quality_summary(cls, task_id):
        checks = cls.query.filter_by(task_id=task_id).all()
        total_checks = len(checks)
        approved_count = len([c for c in checks if c.check_status == 'approved'])
        rejected_count = len([c for c in checks if c.check_status == 'rejected'])
        modified_count = len([c for c in checks if c.check_status == 'modified'])
        return {
            'total_checks': total_checks, 'approved_count': approved_count,
            'rejected_count': rejected_count, 'modified_count': modified_count,
            'approval_rate': (approved_count / total_checks * 100) if total_checks > 0 else 0
        }
    
    def to_dict(self):
        return {
            'id': self.id, 'task_id': self.task_id, 'qa_pair_id': self.qa_pair_id,
            'checker_id': self.checker_id, 'checker_name': self.checker.display_name if self.checker else None,
            'original_editor_id': self.original_editor_id,
            'original_editor_name': self.original_editor.display_name if self.original_editor else None,
            'check_status': self.check_status, 'check_comment': self.check_comment,
            'checked_at': self.checked_at.isoformat() if self.checked_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

