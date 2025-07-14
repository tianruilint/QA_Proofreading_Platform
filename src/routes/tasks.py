from datetime import datetime
from flask import Blueprint, request, jsonify
from src.models import db
from src.models.task import Task, TaskAssignment
from src.models.user import User
from src.routes.auth import login_required

# 创建蓝图
tasks_bp = Blueprint('tasks', __name__)

@tasks_bp.route('/tasks/my', methods=['GET'])
@login_required
def get_my_tasks(current_user):
    """获取我的任务列表"""
    # 获取用户参与的任务
    assignments = TaskAssignment.query.filter_by(user_id=current_user.id).all()
    
    tasks_data = []
    for assignment in assignments:
        task = assignment.task
        if task:
            task_dict = task.to_dict()
            task_dict['my_role'] = assignment.role
            task_dict['my_status'] = assignment.status
            tasks_data.append(task_dict)
    
    # 如果是管理员，也包括自己创建的任务
    if current_user.is_admin:
        created_tasks = Task.query.filter_by(created_by=current_user.id).all()
        for task in created_tasks:
            # 避免重复添加
            if not any(t['id'] == task.id for t in tasks_data):
                task_dict = task.to_dict()
                task_dict['my_role'] = 'creator'
                task_dict['my_status'] = 'created'
                tasks_data.append(task_dict)
    
    return jsonify({
        'success': True,
        'data': {
            'tasks': tasks_data
        }
    })

@tasks_bp.route('/tasks/<task_id>/assignments', methods=['GET'])
@login_required
def get_task_assignments(current_user, task_id):
    """获取任务分配信息"""
    task = Task.query.get(task_id)
    if not task:
        return jsonify({
            'success': False,
            'error': {
                'code': 'TASK_NOT_FOUND',
                'message': '任务不存在'
            }
        }), 404
    
    # 检查权限
    assignment = TaskAssignment.query.filter_by(
        task_id=task_id, 
        user_id=current_user.id
    ).first()
    
    if not assignment and task.created_by != current_user.id:
        return jsonify({
            'success': False,
            'error': {
                'code': 'ACCESS_DENIED',
                'message': '没有访问权限'
            }
        }), 403
    
    assignments = TaskAssignment.query.filter_by(task_id=task_id).all()
    
    assignments_data = []
    for assignment in assignments:
        user = User.query.get(assignment.user_id)
        assignment_dict = assignment.to_dict()
        assignment_dict['user'] = user.to_dict() if user else None
        assignments_data.append(assignment_dict)
    
    return jsonify({
        'success': True,
        'data': {
            'assignments': assignments_data
        }
    })

@tasks_bp.route('/tasks/<task_id>/assign', methods=['POST'])
@login_required
def assign_task(current_user, task_id):
    """分配任务给用户（仅限有权限的管理员）"""
    if not current_user.is_admin:
        return jsonify({
            'success': False,
            'error': {
                'code': 'PERMISSION_DENIED',
                'message': '只有管理员可以分配任务'
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
    
    data = request.get_json()
    if not data or 'user_id' not in data:
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_REQUEST',
                'message': '用户ID不能为空'
            }
        }), 400
    
    target_user = User.query.get(data['user_id'])
    if not target_user:
        return jsonify({
            'success': False,
            'error': {
                'code': 'USER_NOT_FOUND',
                'message': '目标用户不存在'
            }
        }), 404
    
    # 检查管理员是否有权限向该用户分配任务
    if target_user.user_group_id and not current_user.can_assign_to_user_group(target_user.user_group_id):
        return jsonify({
            'success': False,
            'error': {
                'code': 'PERMISSION_DENIED',
                'message': '您没有权限向该用户组的用户分配任务'
            }
        }), 403
    
    # 检查是否已经分配过
    existing_assignment = TaskAssignment.query.filter_by(
        task_id=task_id,
        user_id=data['user_id']
    ).first()
    
    if existing_assignment:
        return jsonify({
            'success': False,
            'error': {
                'code': 'ALREADY_ASSIGNED',
                'message': '该用户已被分配此任务'
            }
        }), 400
    
    import uuid
    assignment = TaskAssignment(
        id=str(uuid.uuid4()),
        task_id=task_id,
        user_id=data['user_id'],
        role=data.get('role', 'proofreader'),
        status='assigned'
    )
    
    db.session.add(assignment)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': {
            'assignment': assignment.to_dict()
        }
    })

@tasks_bp.route('/tasks/<task_id>/assignments/<assignment_id>/status', methods=['PUT'])
@login_required
def update_assignment_status(current_user, task_id, assignment_id):
    """更新任务分配状态"""
    assignment = TaskAssignment.query.filter_by(
        id=assignment_id,
        task_id=task_id,
        user_id=current_user.id
    ).first()
    
    if not assignment:
        return jsonify({
            'success': False,
            'error': {
                'code': 'ASSIGNMENT_NOT_FOUND',
                'message': '任务分配不存在或无权限'
            }
        }), 404
    
    data = request.get_json()
    if not data or 'status' not in data:
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_REQUEST',
                'message': '缺少状态参数'
            }
        }), 400
    
    valid_statuses = ['assigned', 'in_progress', 'completed']
    if data['status'] not in valid_statuses:
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_STATUS',
                'message': '无效的状态值'
            }
        }), 400
    
    assignment.status = data['status']
    if data['status'] == 'completed':
        assignment.completed_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': {
            'assignment': assignment.to_dict()
        }
    })

