from flask import Blueprint, request, jsonify, current_app
from src.models.collaboration_task_draft import CollaborationTaskDraft, CollaborationTaskSession
from src.models.collaboration_task import CollaborationTask, CollaborationTaskAssignment
from src.models.qa_pair import QAPair
from src.models import db
from src.utils.auth import login_required, create_response
from datetime import datetime, timedelta

collaboration_task_draft_bp = Blueprint('collaboration_task_draft', __name__)

@collaboration_task_draft_bp.route('/collaboration-tasks/<int:task_id>/drafts', methods=['POST'])
@login_required
def save_draft(current_user, task_id):
    """保存草稿"""
    try:
        data = request.get_json()
        qa_pair_id = data.get('qa_pair_id')
        prompt = data.get('prompt')
        completion = data.get('completion')
        is_auto_saved = data.get('is_auto_saved', False)
        
        if not qa_pair_id:
            return jsonify(create_response(
                success=False,
                error={'code': 'MISSING_PARAMETER', 'message': 'qa_pair_id是必需的'}
            )), 400
        
        # 验证用户权限
        assignment = CollaborationTaskAssignment.query.filter_by(
            task_id=task_id,
            assigned_to=current_user.id
        ).first()
        
        if not assignment:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 验证QA对是否在用户的分配范围内
        qa_pair = QAPair.query.get_or_404(qa_pair_id)
        if not (assignment.start_index <= qa_pair.index <= assignment.end_index):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': 'QA对不在您的分配范围内'}
            )), 403
        
        # 保存草稿
        draft = CollaborationTaskDraft.save_draft(
            task_id=task_id,
            user_id=current_user.id,
            qa_pair_id=qa_pair_id,
            prompt=prompt,
            completion=completion,
            is_auto_saved=is_auto_saved
        )
        
        # 更新用户活动
        CollaborationTaskSession.update_activity(task_id, current_user.id)
        
        return jsonify(create_response(
            success=True,
            data=draft.to_dict(),
            message='草稿保存成功' if not is_auto_saved else '自动暂存成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'保存草稿失败: {str(e)}'}
        )), 500

@collaboration_task_draft_bp.route('/collaboration-tasks/<int:task_id>/drafts', methods=['GET'])
@login_required
def get_drafts(current_user, task_id):
    """获取用户的草稿列表"""
    try:
        # 验证用户权限
        assignment = CollaborationTaskAssignment.query.filter_by(
            task_id=task_id,
            assigned_to=current_user.id
        ).first()
        
        if not assignment:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 获取草稿列表
        drafts = CollaborationTaskDraft.get_user_drafts(task_id, current_user.id)
        
        return jsonify(create_response(
            success=True,
            data={
                'drafts': [draft.to_dict() for draft in drafts],
                'count': len(drafts)
            }
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取草稿失败: {str(e)}'}
        )), 500

@collaboration_task_draft_bp.route('/collaboration-tasks/<int:task_id>/drafts/<int:qa_pair_id>', methods=['GET'])
@login_required
def get_draft(current_user, task_id, qa_pair_id):
    """获取特定QA对的草稿"""
    try:
        # 验证用户权限
        assignment = CollaborationTaskAssignment.query.filter_by(
            task_id=task_id,
            assigned_to=current_user.id
        ).first()
        
        if not assignment:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 获取草稿
        draft = CollaborationTaskDraft.get_draft(task_id, current_user.id, qa_pair_id)
        
        if draft:
            return jsonify(create_response(
                success=True,
                data=draft.to_dict()
            ))
        else:
            return jsonify(create_response(
                success=True,
                data=None,
                message='未找到草稿'
            ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取草稿失败: {str(e)}'}
        )), 500

@collaboration_task_draft_bp.route('/collaboration-tasks/<int:task_id>/drafts/<int:qa_pair_id>', methods=['DELETE'])
@login_required
def clear_draft(current_user, task_id, qa_pair_id):
    """清除草稿"""
    try:
        # 验证用户权限
        assignment = CollaborationTaskAssignment.query.filter_by(
            task_id=task_id,
            assigned_to=current_user.id
        ).first()
        
        if not assignment:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 清除草稿
        CollaborationTaskDraft.clear_draft(task_id, current_user.id, qa_pair_id)
        
        return jsonify(create_response(
            success=True,
            message='草稿清除成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'清除草稿失败: {str(e)}'}
        )), 500

@collaboration_task_draft_bp.route('/collaboration-tasks/<int:task_id>/sessions', methods=['POST'])
@login_required
def start_session(current_user, task_id):
    """开始工作会话"""
    try:
        # 验证用户权限
        assignment = CollaborationTaskAssignment.query.filter_by(
            task_id=task_id,
            assigned_to=current_user.id
        ).first()
        
        if not assignment:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 开始会话
        session = CollaborationTaskSession.start_session(task_id, current_user.id)
        
        return jsonify(create_response(
            success=True,
            data=session.to_dict(),
            message='工作会话已开始'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'开始会话失败: {str(e)}'}
        )), 500

@collaboration_task_draft_bp.route('/collaboration-tasks/<int:task_id>/sessions', methods=['PUT'])
@login_required
def update_session_activity(current_user, task_id):
    """更新会话活动"""
    try:
        # 验证用户权限
        assignment = CollaborationTaskAssignment.query.filter_by(
            task_id=task_id,
            assigned_to=current_user.id
        ).first()
        
        if not assignment:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 更新活动
        session = CollaborationTaskSession.update_activity(task_id, current_user.id)
        
        if session:
            return jsonify(create_response(
                success=True,
                data=session.to_dict()
            ))
        else:
            return jsonify(create_response(
                success=False,
                error={'code': 'NOT_FOUND', 'message': '未找到活跃会话'}
            )), 404
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'更新会话失败: {str(e)}'}
        )), 500

@collaboration_task_draft_bp.route('/collaboration-tasks/<int:task_id>/sessions', methods=['DELETE'])
@login_required
def end_session(current_user, task_id):
    """结束工作会话"""
    try:
        # 验证用户权限
        assignment = CollaborationTaskAssignment.query.filter_by(
            task_id=task_id,
            assigned_to=current_user.id
        ).first()
        
        if not assignment:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 结束会话
        session = CollaborationTaskSession.end_session(task_id, current_user.id)
        
        if session:
            return jsonify(create_response(
                success=True,
                data=session.to_dict(),
                message='工作会话已结束'
            ))
        else:
            return jsonify(create_response(
                success=False,
                error={'code': 'NOT_FOUND', 'message': '未找到活跃会话'}
            )), 404
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'结束会话失败: {str(e)}'}
        )), 500

@collaboration_task_draft_bp.route('/collaboration-tasks/<int:task_id>/sessions/current', methods=['GET'])
@login_required
def get_current_session(current_user, task_id):
    """获取当前活跃会话"""
    try:
        # 验证用户权限
        assignment = CollaborationTaskAssignment.query.filter_by(
            task_id=task_id,
            assigned_to=current_user.id
        ).first()
        
        if not assignment:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 获取活跃会话
        session = CollaborationTaskSession.get_active_session(task_id, current_user.id)
        
        if session:
            return jsonify(create_response(
                success=True,
                data=session.to_dict()
            ))
        else:
            return jsonify(create_response(
                success=True,
                data=None,
                message='无活跃会话'
            ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取会话失败: {str(e)}'}
        )), 500

@collaboration_task_draft_bp.route('/collaboration-tasks/<int:task_id>/idle-check', methods=['GET'])
@login_required
def check_idle_status(current_user, task_id):
    """检查用户空闲状态"""
    try:
        # 验证用户权限
        assignment = CollaborationTaskAssignment.query.filter_by(
            task_id=task_id,
            assigned_to=current_user.id
        ).first()
        
        if not assignment:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 获取活跃会话
        session = CollaborationTaskSession.get_active_session(task_id, current_user.id)
        
        if session:
            idle_time = session.get_idle_time()
            is_idle = idle_time > 15  # 15分钟无活动视为空闲
            should_remind = idle_time > 10  # 10分钟后开始提醒
            
            return jsonify(create_response(
                success=True,
                data={
                    'is_idle': is_idle,
                    'should_remind': should_remind,
                    'idle_time': idle_time,
                    'session': session.to_dict()
                }
            ))
        else:
            return jsonify(create_response(
                success=True,
                data={
                    'is_idle': False,
                    'should_remind': False,
                    'idle_time': 0,
                    'session': None
                }
            ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'检查空闲状态失败: {str(e)}'}
        )), 500

