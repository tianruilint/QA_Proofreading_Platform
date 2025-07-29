from flask import Blueprint, request, jsonify, current_app
from sqlalchemy.orm import joinedload
from src.models.collaboration_task_summary import CollaborationTaskSummary
from src.models.collaboration_task import CollaborationTask, CollaborationTaskAssignment
from src.models.collaboration_task_draft import CollaborationTaskDraft
from src.models.qa_pair import QAPair
from src.models.user import User
from src.models import db
from src.utils.auth import login_required, admin_required, create_response
from datetime import datetime

collaboration_task_summary_bp = Blueprint('collaboration_task_summary', __name__)

@collaboration_task_summary_bp.route('/collaboration-tasks/<int:task_id>/summary', methods=['GET'])
@login_required
def get_collaboration_task_summary(current_user, task_id):
    """获取协作任务汇总，如果汇总表为空则从原始QA对表回退"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        if task.created_by != current_user.id:
            return jsonify(create_response(False, error={'code': 'FORBIDDEN', 'message': '权限不足'})), 403
            
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        if not task.file_id:
             return jsonify(create_response(False, error={'code': 'NOT_FOUND', 'message': '任务未关联任何文件'})), 404

        summary_query = CollaborationTaskSummary.query.filter_by(task_id=task_id)
        
        if summary_query.first():
            pagination = summary_query.order_by(CollaborationTaskSummary.id).paginate(page=page, per_page=per_page, error_out=False)
            summary_items = [item.to_dict(include_edit_history=True) for item in pagination.items]
        else:
            qa_pair_query = QAPair.query.filter_by(file_id=task.file_id, is_deleted=False)
            pagination = qa_pair_query.order_by(QAPair.index_in_file).paginate(page=page, per_page=per_page, error_out=False)
            
            summary_items = []
            for qa in pagination.items:
                item_dict = qa.to_dict(include_edit_history=True)
                item_dict['is_modified'] = False
                summary_items.append(item_dict)

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
        current_app.logger.error(f"获取任务 {task_id} 汇总失败: {e}", exc_info=True)
        return jsonify(create_response(False, error={'code': 'INTERNAL_ERROR', 'message': f'获取汇总失败: {str(e)}'})), 500

@collaboration_task_summary_bp.route('/collaboration-tasks/<int:task_id>/progress', methods=['GET'])
@login_required
def get_collaboration_task_progress(current_user, task_id):
    """获取协作任务进度"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        if task.created_by != current_user.id:
            return jsonify(create_response(False, error={'code': 'FORBIDDEN', 'message': '权限不足'})), 403
            
        progress_stats = task.get_progress()
        
        # BUG 2 修复: 使用 joinedload 预先加载 'assignee' (User) 信息，避免N+1查询问题
        assignments = CollaborationTaskAssignment.query.options(
            joinedload(CollaborationTaskAssignment.assignee)
        ).filter_by(task_id=task_id).all()
        
        participants = []
        for a in assignments:
            participant_data = a.to_dict()
            
            # BUG 2 修复: 计算并添加每个参与者的删除数量
            deleted_count = CollaborationTaskDraft.query.filter_by(
                task_id=task_id,
                user_id=a.assigned_to,
                is_deleted=True
            ).count()
            participant_data['deleted_count'] = deleted_count
            
            participants.append(participant_data)
            
        return jsonify(create_response(
            success=True,
            data={
                'task_info': task.to_dict(),
                'progress_stats': progress_stats,
                'participants': participants
            }
        ))
    
    except Exception as e:
        current_app.logger.error(f"获取任务 {task_id} 进度失败: {e}", exc_info=True)
        return jsonify(create_response(False, error={'code': 'INTERNAL_ERROR', 'message': f'获取进度失败: {str(e)}'})), 500

@collaboration_task_summary_bp.route('/collaboration-tasks/<int:task_id>/summary/<int:qa_pair_id>', methods=['PUT'])
@admin_required
def update_summary_item(current_user, task_id, qa_pair_id):
    """更新汇总项（管理员二次校对）"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        if task.created_by != current_user.id:
            return jsonify(create_response(False, error={'code': 'FORBIDDEN', 'message': '权限不足'})), 403
            
        data = request.get_json()
        edited_prompt = data.get('edited_prompt')
        edited_completion = data.get('edited_completion')
        
        if not edited_prompt or not edited_completion:
            return jsonify(create_response(False, error={'code': 'MISSING_PARAMETER', 'message': '问题和答案不能为空'})), 400
            
        qa_pair = QAPair.query.get_or_404(qa_pair_id)
        
        if qa_pair.file_id != task.file_id:
            return jsonify(create_response(False, error={'code': 'FORBIDDEN', 'message': 'QA对不属于此任务'})), 403

        qa_pair.prompt = edited_prompt.strip()
        qa_pair.completion = edited_completion.strip()
        qa_pair.edited_by = current_user.id
        qa_pair.edited_at = datetime.utcnow()

        db.session.commit()
        
        return jsonify(create_response(
            success=True,
            data=qa_pair.to_dict(include_edit_history=True),
            message='汇总项更新成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"更新汇总项失败 (任务 {task_id}, QA {qa_pair_id}): {e}", exc_info=True)
        return jsonify(create_response(False, error={'code': 'INTERNAL_ERROR', 'message': f'更新汇总项失败: {str(e)}'})), 500

