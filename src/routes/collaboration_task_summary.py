from flask import Blueprint, request, jsonify, current_app
from src.models.collaboration_task_summary import CollaborationTaskSummary, CollaborationTaskQualityCheck
from src.models.collaboration_task import CollaborationTask, CollaborationTaskAssignment
from src.models.qa_pair import QAPair
from src.models.user import User
from src.models import db
from src.utils.auth import login_required, admin_required, create_response
from datetime import datetime

collaboration_task_summary_bp = Blueprint('collaboration_task_summary', __name__)

@collaboration_task_summary_bp.route('/collaboration-tasks/<int:task_id>/summary', methods=['GET'])
@login_required
def get_collaboration_task_summary(current_user, task_id):
    """获取协作任务汇总"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        # 权限检查：只有任务创建者可以查看汇总
        if task.created_by != current_user.id:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 获取分页参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # 获取汇总数据
        pagination = CollaborationTaskSummary.get_task_summary(task_id, page, per_page)
        
        summary_items = [item.to_dict() for item in pagination.items]
        
        return jsonify(create_response(
            success=True,
            data={
                'summary_items': summary_items,
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
            error={'code': 'INTERNAL_ERROR', 'message': f'获取汇总失败: {str(e)}'}
        )), 500

@collaboration_task_summary_bp.route('/collaboration-tasks/<int:task_id>/progress', methods=['GET'])
@login_required
def get_collaboration_task_progress(current_user, task_id):
    """获取协作任务进度"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        # 权限检查：只有任务创建者可以查看进度
        if task.created_by != current_user.id:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 获取进度统计
        progress_stats = CollaborationTaskSummary.get_task_progress(task_id)
        
        # 获取参与人员列表及状态
        assignments = CollaborationTaskAssignment.query.filter_by(task_id=task_id).all()
        participants = []
        
        for assignment in assignments:
            user = User.query.get(assignment.assigned_to)
            participants.append({
                'user_id': assignment.assigned_to,
                'user_name': user.display_name if user else '未知用户',
                'assignment_id': assignment.id,
                'start_index': assignment.start_index,
                'end_index': assignment.end_index,
                'qa_count': assignment.get_qa_count(),
                'status': assignment.status,
                'started_at': assignment.started_at.isoformat() if assignment.started_at else None,
                'completed_at': assignment.completed_at.isoformat() if assignment.completed_at else None
            })
        
        return jsonify(create_response(
            success=True,
            data={
                'task_info': task.to_dict(),
                'progress_stats': progress_stats,
                'participants': participants
            }
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取进度失败: {str(e)}'}
        )), 500

@collaboration_task_summary_bp.route('/collaboration-tasks/<int:task_id>/participants', methods=['GET'])
@login_required
def get_collaboration_task_participants(current_user, task_id):
    """获取协作任务参与者详情"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        # 权限检查：只有任务创建者可以查看参与者
        if task.created_by != current_user.id:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 获取参与者详细信息
        assignments = CollaborationTaskAssignment.query.filter_by(task_id=task_id).all()
        participants_detail = []
        
        for assignment in assignments:
            user = User.query.get(assignment.assigned_to)
            
            # 获取用户的工作统计
            from src.models.collaboration_task_draft import CollaborationTaskSession
            sessions = CollaborationTaskSession.query.filter_by(
                task_id=task_id,
                user_id=assignment.assigned_to
            ).all()
            
            total_work_time = sum(session.get_session_duration() for session in sessions)
            active_sessions = len([s for s in sessions if s.is_active])
            
            participants_detail.append({
                'user_id': assignment.assigned_to,
                'user_name': user.display_name if user else '未知用户',
                'user_email': user.email if user else None,
                'assignment': assignment.to_dict(),
                'work_stats': {
                    'total_work_time': total_work_time,
                    'session_count': len(sessions),
                    'active_sessions': active_sessions,
                    'last_activity': max([s.last_activity for s in sessions]).isoformat() if sessions else None
                }
            })
        
        return jsonify(create_response(
            success=True,
            data={
                'participants': participants_detail,
                'total_participants': len(participants_detail)
            }
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取参与者信息失败: {str(e)}'}
        )), 500

@collaboration_task_summary_bp.route('/collaboration-tasks/<int:task_id>/summary/<int:qa_pair_id>', methods=['PUT'])
@admin_required
def update_summary_item(current_user, task_id, qa_pair_id):
    """更新汇总项（管理员二次校对）"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        # 权限检查：只有任务创建者可以更新汇总
        if task.created_by != current_user.id:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        data = request.get_json()
        edited_prompt = data.get('edited_prompt')
        edited_completion = data.get('edited_completion')
        
        if not edited_prompt or not edited_completion:
            return jsonify(create_response(
                success=False,
                error={'code': 'MISSING_PARAMETER', 'message': '问题和答案不能为空'}
            )), 400
        
        # 获取汇总项
        summary_item = CollaborationTaskSummary.query.filter_by(
            task_id=task_id,
            qa_pair_id=qa_pair_id
        ).first()
        
        if not summary_item:
            return jsonify(create_response(
                success=False,
                error={'code': 'NOT_FOUND', 'message': '未找到汇总项'}
            )), 404
        
        # 更新汇总项
        summary_item.edited_prompt = edited_prompt.strip()
        summary_item.edited_completion = edited_completion.strip()
        summary_item.is_modified = (
            summary_item.original_prompt != edited_prompt.strip() or 
            summary_item.original_completion != edited_completion.strip()
        )
        
        # 同时更新原始QA对
        qa_pair = QAPair.query.get(qa_pair_id)
        if qa_pair:
            qa_pair.prompt = edited_prompt.strip()
            qa_pair.completion = edited_completion.strip()
            qa_pair.edited_by = current_user.id
            qa_pair.edited_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify(create_response(
            success=True,
            data=summary_item.to_dict(),
            message='汇总项更新成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'更新汇总项失败: {str(e)}'}
        )), 500

@collaboration_task_summary_bp.route('/collaboration-tasks/<int:task_id>/quality-check', methods=['POST'])
@admin_required
def create_quality_check(current_user, task_id):
    """创建质量检查记录"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        # 权限检查：只有任务创建者可以进行质量检查
        if task.created_by != current_user.id:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        data = request.get_json()
        qa_pair_id = data.get('qa_pair_id')
        check_status = data.get('check_status', 'approved')
        check_comment = data.get('check_comment')
        original_editor_id = data.get('original_editor_id')
        
        if not qa_pair_id:
            return jsonify(create_response(
                success=False,
                error={'code': 'MISSING_PARAMETER', 'message': 'qa_pair_id是必需的'}
            )), 400
        
        # 创建质量检查记录
        quality_check = CollaborationTaskQualityCheck.create_check(
            task_id=task_id,
            qa_pair_id=qa_pair_id,
            checker_id=current_user.id,
            original_editor_id=original_editor_id,
            check_status=check_status,
            check_comment=check_comment
        )
        
        return jsonify(create_response(
            success=True,
            data=quality_check.to_dict(),
            message='质量检查记录创建成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'创建质量检查记录失败: {str(e)}'}
        )), 500

@collaboration_task_summary_bp.route('/collaboration-tasks/<int:task_id>/quality-summary', methods=['GET'])
@admin_required
def get_quality_summary(current_user, task_id):
    """获取质量检查汇总"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        # 权限检查：只有任务创建者可以查看质量汇总
        if task.created_by != current_user.id:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 获取质量检查汇总
        quality_summary = CollaborationTaskQualityCheck.get_task_quality_summary(task_id)
        
        return jsonify(create_response(
            success=True,
            data=quality_summary
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取质量汇总失败: {str(e)}'}
        )), 500

