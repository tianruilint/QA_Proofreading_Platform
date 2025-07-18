from flask import Blueprint, request, jsonify, current_app
from src.models.collaboration_task import CollaborationTask, CollaborationTaskAssignment
from src.models.collaboration_task_summary import CollaborationTaskSummary, CollaborationTaskQualityCheck
from src.models.qa_pair import QAPair
from src.models.user import User
from src.models import db
from src.utils.auth import login_required, admin_required, create_response
from datetime import datetime
import json
import io

collaboration_task_final_bp = Blueprint('collaboration_task_final', __name__)

@collaboration_task_final_bp.route('/collaboration-tasks/<int:task_id>/reject-assignment', methods=['POST'])
@admin_required
def reject_assignment(current_user, task_id):
    """打回质量差的分配任务"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        # 权限检查：只有任务创建者可以打回任务
        if task.created_by != current_user.id:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        data = request.get_json()
        assignment_id = data.get('assignment_id')
        reject_reason = data.get('reject_reason', '')
        
        if not assignment_id:
            return jsonify(create_response(
                success=False,
                error={'code': 'MISSING_PARAMETER', 'message': 'assignment_id是必需的'}
            )), 400
        
        # 查找分配
        assignment = CollaborationTaskAssignment.query.get(assignment_id)
        if not assignment or assignment.task_id != task_id:
            return jsonify(create_response(
                success=False,
                error={'code': 'NOT_FOUND', 'message': '未找到分配记录'}
            )), 404
        
        if assignment.status != 'completed':
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_STATUS', 'message': '只能打回已完成的任务'}
            )), 400
        
        # 打回任务
        assignment.status = 'rejected'
        assignment.reject_reason = reject_reason
        assignment.rejected_at = datetime.utcnow()
        assignment.rejected_by = current_user.id
        
        # 更新任务状态
        task.status = 'in_progress'
        task.completed_at = None
        
        # 发送打回通知
        from src.models.notification import Notification
        user = User.query.get(assignment.assigned_to)
        Notification.create_notification(
            user_id=assignment.assigned_to,
            notification_type='task_rejected',
            title='任务被打回',
            content=f'您的协作任务"{task.name}"被管理员打回，请重新处理。原因：{reject_reason}',
            related_task_id=task_id
        )
        
        db.session.commit()
        
        return jsonify(create_response(
            success=True,
            data=assignment.to_dict(),
            message='任务打回成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'打回任务失败: {str(e)}'}
        )), 500

@collaboration_task_final_bp.route('/collaboration-tasks/<int:task_id>/final-confirm', methods=['POST'])
@admin_required
def final_confirm_task(current_user, task_id):
    """最终确认协作任务"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        # 权限检查：只有任务创建者可以最终确认
        if task.created_by != current_user.id:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        if task.status != 'completed':
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_STATUS', 'message': '只能确认已完成的任务'}
            )), 400
        
        # 检查是否有被打回的分配
        rejected_assignments = CollaborationTaskAssignment.query.filter_by(
            task_id=task_id,
            status='rejected'
        ).count()
        
        if rejected_assignments > 0:
            return jsonify(create_response(
                success=False,
                error={'code': 'HAS_REJECTED', 'message': '存在被打回的分配，无法最终确认'}
            )), 400
        
        # 最终确认
        task.status = 'finalized'
        task.finalized_at = datetime.utcnow()
        task.finalized_by = current_user.id
        
        # 创建最终质量检查记录
        summary_items = CollaborationTaskSummary.query.filter_by(task_id=task_id).all()
        for item in summary_items:
            CollaborationTaskQualityCheck.create_check(
                task_id=task_id,
                qa_pair_id=item.qa_pair_id,
                checker_id=current_user.id,
                original_editor_id=item.editor_id,
                check_status='approved',
                check_comment='最终确认通过'
            )
        
        db.session.commit()
        
        return jsonify(create_response(
            success=True,
            data=task.to_dict(),
            message='任务最终确认成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'最终确认失败: {str(e)}'}
        )), 500

@collaboration_task_final_bp.route('/collaboration-tasks/<int:task_id>/export-final', methods=['GET'])
@admin_required
def export_final_result(current_user, task_id):
    """导出最终结果"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        # 权限检查：只有任务创建者可以导出
        if task.created_by != current_user.id:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 获取汇总数据
        summary_items = CollaborationTaskSummary.query.filter_by(
            task_id=task_id
        ).order_by(CollaborationTaskSummary.qa_pair_index).all()
        
        if not summary_items:
            return jsonify(create_response(
                success=False,
                error={'code': 'NO_DATA', 'message': '没有可导出的数据'}
            )), 400
        
        # 构建JSONL数据
        jsonl_lines = []
        for item in summary_items:
            qa_data = {
                'prompt': item.edited_prompt,
                'completion': item.edited_completion,
                'metadata': {
                    'original_index': item.qa_pair_index,
                    'editor': item.editor_name,
                    'is_modified': item.is_modified,
                    'task_id': task_id,
                    'task_name': task.name
                }
            }
            jsonl_lines.append(json.dumps(qa_data, ensure_ascii=False))
        
        jsonl_content = '\n'.join(jsonl_lines)
        
        return jsonify(create_response(
            success=True,
            data={
                'content': jsonl_content,
                'filename': f'{task.name}_final_result.jsonl',
                'total_items': len(summary_items),
                'export_time': datetime.utcnow().isoformat()
            },
            message='导出成功'
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'导出失败: {str(e)}'}
        )), 500

@collaboration_task_final_bp.route('/collaboration-tasks/<int:task_id>/batch-quality-check', methods=['POST'])
@admin_required
def batch_quality_check(current_user, task_id):
    """批量质量检查"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        # 权限检查：只有任务创建者可以进行质量检查
        if task.created_by != current_user.id:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        data = request.get_json()
        checks = data.get('checks', [])
        
        if not checks:
            return jsonify(create_response(
                success=False,
                error={'code': 'MISSING_PARAMETER', 'message': 'checks是必需的'}
            )), 400
        
        created_checks = []
        for check_data in checks:
            qa_pair_id = check_data.get('qa_pair_id')
            check_status = check_data.get('check_status', 'approved')
            check_comment = check_data.get('check_comment')
            original_editor_id = check_data.get('original_editor_id')
            
            if qa_pair_id:
                quality_check = CollaborationTaskQualityCheck.create_check(
                    task_id=task_id,
                    qa_pair_id=qa_pair_id,
                    checker_id=current_user.id,
                    original_editor_id=original_editor_id,
                    check_status=check_status,
                    check_comment=check_comment
                )
                created_checks.append(quality_check.to_dict())
        
        return jsonify(create_response(
            success=True,
            data={
                'created_checks': created_checks,
                'total_created': len(created_checks)
            },
            message='批量质量检查完成'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'批量质量检查失败: {str(e)}'}
        )), 500

@collaboration_task_final_bp.route('/collaboration-tasks/<int:task_id>/reopen', methods=['POST'])
@admin_required
def reopen_task(current_user, task_id):
    """重新开放任务"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        # 权限检查：只有任务创建者可以重新开放
        if task.created_by != current_user.id:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        if task.status not in ['completed', 'finalized']:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_STATUS', 'message': '只能重新开放已完成或已确认的任务'}
            )), 400
        
        data = request.get_json()
        reopen_reason = data.get('reopen_reason', '')
        
        # 重新开放任务
        task.status = 'in_progress'
        task.completed_at = None
        task.finalized_at = None
        task.finalized_by = None
        
        # 重置所有分配状态为进行中
        assignments = CollaborationTaskAssignment.query.filter_by(task_id=task_id).all()
        for assignment in assignments:
            if assignment.status in ['completed', 'rejected']:
                assignment.status = 'in_progress'
                assignment.completed_at = None
                assignment.reject_reason = None
                assignment.rejected_at = None
                assignment.rejected_by = None
                
                # 发送重新开放通知
                Notification.create_notification(
                    user_id=assignment.assigned_to,
                    notification_type='task_reopened',
                    title='任务重新开放',
                    content=f'协作任务"{task.name}"已重新开放，请继续处理。原因：{reopen_reason}',
                    related_task_id=task_id
                )
        
        db.session.commit()
        
        return jsonify(create_response(
            success=True,
            data=task.to_dict(),
            message='任务重新开放成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'重新开放任务失败: {str(e)}'}
        )), 500

