from flask import Blueprint, request, jsonify
from src.models import db
from src.models.qa_pair import QAPair
from src.models.task import Task, TaskAssignment
from src.models.single_file import SingleFileSession
from src.models.user import User
from src.routes.auth import login_required

traceability_bp = Blueprint('traceability', __name__)

@traceability_bp.route('/tasks/<task_id>/traceability', methods=['GET'])
@login_required
def get_task_traceability(current_user, task_id):
    """获取任务的完整溯源信息"""
    if not current_user.is_admin:
        return jsonify({
            'success': False,
            'error': {
                'code': 'PERMISSION_DENIED',
                'message': '只有管理员可以查看溯源信息'
            }
        }), 403
    
    task = Task.query.get(task_id)
    if not task:
        return jsonify({
            'success': False,
            'error': {
                'code': 'TASK_NOT_FOUND',
                'message': '任务不存在'
            }
        }), 404
    
    # 检查是否是任务创建者
    if task.created_by != current_user.id:
        return jsonify({
            'success': False,
            'error': {
                'code': 'ACCESS_DENIED',
                'message': '只有任务创建者可以查看溯源信息'
            }
        }), 403
    
    # 获取任务相关的QA对
    qa_pairs = QAPair.query.filter_by(task_id=task_id).all()
    
    # 获取任务分配信息
    assignments = TaskAssignment.query.filter_by(task_id=task_id).all()
    
    # 构建溯源数据
    traceability_data = {
        'task_info': task.to_dict(),
        'assignments': [],
        'qa_pairs_summary': {
            'total': len(qa_pairs),
            'pending': len([qa for qa in qa_pairs if qa.status == 'pending']),
            'corrected': len([qa for qa in qa_pairs if qa.status == 'corrected']),
            'reviewed': len([qa for qa in qa_pairs if qa.status == 'reviewed']),
            'approved': len([qa for qa in qa_pairs if qa.status == 'approved'])
        },
        'qa_pairs_detail': []
    }
    
    # 添加分配信息
    for assignment in assignments:
        user = User.query.get(assignment.user_id)
        assignment_data = assignment.to_dict()
        assignment_data['user_info'] = user.to_dict() if user else None
        traceability_data['assignments'].append(assignment_data)
    
    # 添加QA对详细信息
    for qa_pair in qa_pairs:
        qa_data = qa_pair.to_dict(include_user_info=True)
        qa_data['correction_history'] = qa_pair.get_correction_history()
        traceability_data['qa_pairs_detail'].append(qa_data)
    
    return jsonify({
        'success': True,
        'data': traceability_data
    })

@traceability_bp.route('/sessions/<session_id>/traceability', methods=['GET'])
@login_required
def get_session_traceability(current_user, session_id):
    """获取单文件会话的溯源信息"""
    session = SingleFileSession.query.get(session_id)
    if not session:
        return jsonify({
            'success': False,
            'error': {
                'code': 'SESSION_NOT_FOUND',
                'message': '会话不存在'
            }
        }), 404
    
    # 获取会话相关的QA对
    qa_pairs = QAPair.query.filter_by(session_id=session_id).all()
    
    # 构建溯源数据
    traceability_data = {
        'session_info': session.to_dict(),
        'qa_pairs_summary': {
            'total': len(qa_pairs),
            'pending': len([qa for qa in qa_pairs if qa.status == 'pending']),
            'corrected': len([qa for qa in qa_pairs if qa.status == 'corrected']),
            'reviewed': len([qa for qa in qa_pairs if qa.status == 'reviewed']),
            'approved': len([qa for qa in qa_pairs if qa.status == 'approved'])
        },
        'qa_pairs_detail': []
    }
    
    # 添加QA对详细信息
    for qa_pair in qa_pairs:
        qa_data = qa_pair.to_dict(include_user_info=True)
        qa_data['correction_history'] = qa_pair.get_correction_history()
        traceability_data['qa_pairs_detail'].append(qa_data)
    
    return jsonify({
        'success': True,
        'data': traceability_data
    })

@traceability_bp.route('/qa-pairs/<qa_id>/history', methods=['GET'])
@login_required
def get_qa_pair_history(current_user, qa_id):
    """获取单个QA对的校对历史"""
    qa_pair = QAPair.query.get(qa_id)
    if not qa_pair:
        return jsonify({
            'success': False,
            'error': {
                'code': 'QA_PAIR_NOT_FOUND',
                'message': 'QA对不存在'
            }
        }), 404
    
    # 检查访问权限
    has_access = False
    
    # 管理员有权限
    if current_user.is_admin:
        has_access = True
    
    # 校对者有权限
    if qa_pair.corrected_by == current_user.id:
        has_access = True
    
    # 审核者有权限
    if qa_pair.reviewed_by == current_user.id:
        has_access = True
    
    # 如果是任务相关的QA对，检查任务权限
    if qa_pair.task_id:
        task = Task.query.get(qa_pair.task_id)
        if task and task.created_by == current_user.id:
            has_access = True
        
        # 检查是否是任务分配的用户
        assignment = TaskAssignment.query.filter_by(
            task_id=qa_pair.task_id,
            user_id=current_user.id
        ).first()
        if assignment:
            has_access = True
    
    if not has_access:
        return jsonify({
            'success': False,
            'error': {
                'code': 'ACCESS_DENIED',
                'message': '没有访问权限'
            }
        }), 403
    
    qa_data = qa_pair.to_dict(include_user_info=True)
    qa_data['correction_history'] = qa_pair.get_correction_history()
    
    return jsonify({
        'success': True,
        'data': {
            'qa_pair': qa_data
        }
    })

@traceability_bp.route('/users/<user_id>/work-summary', methods=['GET'])
@login_required
def get_user_work_summary(current_user, user_id):
    """获取用户工作总结（管理员功能）"""
    if not current_user.is_admin:
        return jsonify({
            'success': False,
            'error': {
                'code': 'PERMISSION_DENIED',
                'message': '只有管理员可以查看用户工作总结'
            }
        }), 403
    
    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({
            'success': False,
            'error': {
                'code': 'USER_NOT_FOUND',
                'message': '用户不存在'
            }
        }), 404
    
    # 获取用户校对的QA对
    corrected_qa_pairs = QAPair.query.filter_by(corrected_by=user_id).all()
    
    # 获取用户审核的QA对
    reviewed_qa_pairs = QAPair.query.filter_by(reviewed_by=user_id).all()
    
    # 获取用户参与的任务
    assignments = TaskAssignment.query.filter_by(user_id=user_id).all()
    
    work_summary = {
        'user_info': target_user.to_dict(),
        'correction_stats': {
            'total_corrected': len(corrected_qa_pairs),
            'pending': len([qa for qa in corrected_qa_pairs if qa.status == 'corrected']),
            'reviewed': len([qa for qa in corrected_qa_pairs if qa.status == 'reviewed']),
            'approved': len([qa for qa in corrected_qa_pairs if qa.status == 'approved'])
        },
        'review_stats': {
            'total_reviewed': len(reviewed_qa_pairs),
            'approved': len([qa for qa in reviewed_qa_pairs if qa.status == 'approved'])
        },
        'task_participation': {
            'total_tasks': len(assignments),
            'completed_tasks': len([a for a in assignments if a.status == 'completed']),
            'in_progress_tasks': len([a for a in assignments if a.status == 'in_progress']),
            'assigned_tasks': len([a for a in assignments if a.status == 'assigned'])
        }
    }
    
    return jsonify({
        'success': True,
        'data': work_summary
    })

