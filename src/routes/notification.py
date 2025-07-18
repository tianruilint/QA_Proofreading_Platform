from flask import Blueprint, request, jsonify, current_app
from src.models.notification import Notification, TaskStatusReminder
from src.models.collaboration_task import CollaborationTask, CollaborationTaskAssignment
from src.models.user import User
from src.models import db
from src.utils.auth import login_required, create_response
from datetime import datetime, timedelta

notification_bp = Blueprint('notification', __name__)

@notification_bp.route('/notifications', methods=['GET'])
@login_required
def get_notifications(current_user):
    """获取用户通知列表"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        unread_only = request.args.get('unread_only', 'false').lower() == 'true'
        
        query = Notification.query.filter_by(user_id=current_user.id)
        
        if unread_only:
            query = query.filter_by(is_read=False)
        
        query = query.order_by(Notification.created_at.desc())
        
        # 分页
        pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        notifications = [notification.to_dict() for notification in pagination.items]
        
        # 获取未读通知数量
        unread_count = Notification.query.filter_by(
            user_id=current_user.id,
            is_read=False
        ).count()
        
        return jsonify(create_response(
            success=True,
            data={
                'notifications': notifications,
                'unread_count': unread_count,
                'pagination': {
                    'page': pagination.page,
                    'per_page': pagination.per_page,
                    'total': pagination.total,
                    'pages': pagination.pages,
                    'has_prev': pagination.has_prev,
                    'has_next': pagination.has_next
                }
            }
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取通知列表失败: {str(e)}'}
        )), 500

@notification_bp.route('/notifications/<int:notification_id>/read', methods=['PUT'])
@login_required
def mark_notification_as_read(current_user, notification_id):
    """标记通知为已读"""
    try:
        notification = Notification.query.get_or_404(notification_id)
        
        # 权限检查
        if notification.user_id != current_user.id:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        notification.mark_as_read()
        
        return jsonify(create_response(
            success=True,
            data=notification.to_dict(),
            message='通知已标记为已读'
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'标记通知失败: {str(e)}'}
        )), 500

@notification_bp.route('/notifications/mark-all-read', methods=['PUT'])
@login_required
def mark_all_notifications_as_read(current_user):
    """标记所有通知为已读"""
    try:
        Notification.query.filter_by(
            user_id=current_user.id,
            is_read=False
        ).update({'is_read': True})
        
        db.session.commit()
        
        return jsonify(create_response(
            success=True,
            message='所有通知已标记为已读'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'标记通知失败: {str(e)}'}
        )), 500

@notification_bp.route('/notifications/unread-count', methods=['GET'])
@login_required
def get_unread_notification_count(current_user):
    """获取未读通知数量"""
    try:
        unread_count = Notification.query.filter_by(
            user_id=current_user.id,
            is_read=False
        ).count()
        
        return jsonify(create_response(
            success=True,
            data={'unread_count': unread_count}
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取未读通知数量失败: {str(e)}'}
        )), 500

@notification_bp.route('/notifications/task-status', methods=['GET'])
@login_required
def get_task_status_notifications(current_user):
    """获取任务状态提醒"""
    try:
        # 获取用户相关的任务状态
        task_statuses = []
        
        # 获取用户创建的任务
        created_tasks = CollaborationTask.query.filter_by(created_by=current_user.id).all()
        for task in created_tasks:
            progress = task.get_progress()
            task_statuses.append({
                'task_id': task.id,
                'task_title': task.title,
                'role': 'creator',
                'status': task.status,
                'progress': progress,
                'deadline': task.deadline.isoformat() if task.deadline else None,
                'created_at': task.created_at.isoformat() if task.created_at else None
            })
        
        # 获取用户被分配的任务
        assignments = CollaborationTaskAssignment.query.filter_by(assigned_to=current_user.id).all()
        for assignment in assignments:
            task = assignment.task
            task_statuses.append({
                'task_id': task.id,
                'task_title': task.title,
                'role': 'assignee',
                'status': task.status,
                'assignment_status': assignment.status,
                'assignment_info': assignment.to_dict(),
                'deadline': task.deadline.isoformat() if task.deadline else None,
                'assigned_at': assignment.assigned_at.isoformat() if assignment.assigned_at else None
            })
        
        return jsonify(create_response(
            success=True,
            data={'task_statuses': task_statuses}
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取任务状态失败: {str(e)}'}
        )), 500

# 通知发送工具函数
def send_task_assignment_notifications(task, assignments):
    """发送任务分配通知"""
    try:
        for assignment in assignments:
            user = assignment.assignee
            if user and user.is_active:
                Notification.create_task_assignment_notification(
                    user_id=user.id,
                    task=task,
                    assignment=assignment
                )
                current_app.logger.info(f"任务分配通知已发送给用户 {user.id}")
    except Exception as e:
        current_app.logger.error(f"发送任务分配通知失败: {str(e)}")

def send_task_completion_notification(task):
    """发送任务完成通知"""
    try:
        creator = task.creator
        if creator and creator.is_active:
            Notification.create_task_completion_notification(
                user_id=creator.id,
                task=task
            )
            current_app.logger.info(f"任务完成通知已发送给创建者 {creator.id}")
    except Exception as e:
        current_app.logger.error(f"发送任务完成通知失败: {str(e)}")

def send_task_reminder_notifications():
    """发送任务提醒通知（定时任务）"""
    try:
        # 查找即将到期的任务
        deadline_threshold = datetime.utcnow() + timedelta(hours=24)  # 24小时内到期
        
        overdue_assignments = CollaborationTaskAssignment.query.join(
            CollaborationTask
        ).filter(
            CollaborationTaskAssignment.status.in_(['pending', 'in_progress']),
            CollaborationTask.deadline <= deadline_threshold,
            CollaborationTask.status == 'in_progress'
        ).all()
        
        for assignment in overdue_assignments:
            # 检查是否已经发送过提醒
            existing_reminder = TaskStatusReminder.query.filter_by(
                task_id=assignment.task_id,
                user_id=assignment.assigned_to,
                reminder_type='assignment_overdue',
                is_sent=True
            ).first()
            
            if not existing_reminder:
                # 发送提醒通知
                Notification.create_task_reminder_notification(
                    user_id=assignment.assigned_to,
                    task=assignment.task,
                    assignment=assignment
                )
                
                # 记录提醒已发送
                reminder = TaskStatusReminder.create_reminder(
                    task_id=assignment.task_id,
                    user_id=assignment.assigned_to,
                    reminder_type='assignment_overdue'
                )
                reminder.mark_as_sent()
                
                current_app.logger.info(f"任务提醒通知已发送给用户 {assignment.assigned_to}")
        
    except Exception as e:
        current_app.logger.error(f"发送任务提醒通知失败: {str(e)}")

@notification_bp.route('/notifications/send-reminders', methods=['POST'])
@login_required
def trigger_reminder_notifications(current_user):
    """手动触发提醒通知（仅供管理员使用）"""
    try:
        if not current_user.is_admin():
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        send_task_reminder_notifications()
        
        return jsonify(create_response(
            success=True,
            message='提醒通知发送完成'
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'发送提醒通知失败: {str(e)}'}
        )), 500

