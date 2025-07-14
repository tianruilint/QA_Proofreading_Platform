import json
from datetime import datetime
from . import db

class SingleFileSession(db.Model):
    __tablename__ = 'single_file_sessions'
    
    id = db.Column(db.String(36), primary_key=True)
    file_path = db.Column(db.String(500), nullable=True)
    filename = db.Column(db.String(200), nullable=False)
    file_data = db.Column(db.Text, nullable=False)
    is_guest_session = db.Column(db.Boolean, default=False)
    total_pairs = db.Column(db.Integer, default=0)
    processed_pairs = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='active')  # active, completed, expired
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    @property
    def session_id(self):
        """为了兼容性，提供session_id属性"""
        return self.id
    
    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'filename': self.filename,
            'file_data': json.loads(self.file_data) if self.file_data else [],
            'is_guest_session': self.is_guest_session,
            'total_pairs': self.total_pairs,
            'processed_pairs': self.processed_pairs,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }



    @classmethod
    def create_session(cls, session_id, filename, file_data, is_guest_session=True):
        session = cls(
            id=session_id,
            filename=filename,
            file_data=file_data,
            is_guest_session=is_guest_session,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.session.add(session)
        db.session.commit()
        return session

    def is_expired(self):
        # 访客会话有效期为1小时
        if self.is_guest_session:
            return (datetime.utcnow() - self.updated_at).total_seconds() > 3600
        return False

    def update_access_time(self):
        self.updated_at = datetime.utcnow()
        db.session.commit()

    def delete(self):
        db.session.delete(self)
        db.session.commit()


