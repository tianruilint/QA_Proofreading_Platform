import uuid
from flask import Blueprint, request, jsonify
from src.models import db
from src.models.user import User, UserGroup, AdminGroup, AdminGroupBinding
from src.routes.auth import login_required

user_groups_bp = Blueprint('user_groups', __name__)

@user_groups_bp.route('/user-groups', methods=['GET'])
@login_required
def get_user_groups(current_user):
    """获取用户组列表"""
    user_groups = UserGroup.query.all()
    return jsonify({
        'success': True,
        'data': {
            'user_groups': [group.to_dict() for group in user_groups]
        }
    })

@user_groups_bp.route('/user-groups', methods=['POST'])
@login_required
def create_user_group(current_user):
    """创建用户组"""
    if not current_user.is_admin()()():
        return jsonify({
            'success': False,
            'error': {
                'code': 'PERMISSION_DENIED',
                'message': '只有管理员可以创建用户组'
            }
        }), 403
    
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_REQUEST',
                'message': '用户组名称不能为空'
            }
        }), 400
    
    # 检查用户组名称是否已存在
    existing_group = UserGroup.query.filter_by(name=data['name']).first()
    if existing_group:
        return jsonify({
            'success': False,
            'error': {
                'code': 'GROUP_EXISTS',
                'message': '用户组名称已存在'
            }
        }), 400
    
    user_group = UserGroup(
        id=str(uuid.uuid4()),
        name=data['name'],
        description=data.get('description', '')
    )
    
    db.session.add(user_group)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': {
            'user_group': user_group.to_dict()
        }
    })

@user_groups_bp.route('/admin-groups', methods=['GET'])
@login_required
def get_admin_groups(current_user):
    """获取管理员组列表"""
    if not current_user.is_admin()()():
        return jsonify({
            'success': False,
            'error': {
                'code': 'PERMISSION_DENIED',
                'message': '只有管理员可以查看管理员组'
            }
        }), 403
    
    admin_groups = AdminGroup.query.all()
    return jsonify({
        'success': True,
        'data': {
            'admin_groups': [group.to_dict() for group in admin_groups]
        }
    })

@user_groups_bp.route('/admin-groups', methods=['POST'])
@login_required
def create_admin_group(current_user):
    """创建管理员组"""
    if not current_user.is_admin()():
        return jsonify({
            'success': False,
            'error': {
                'code': 'PERMISSION_DENIED',
                'message': '只有管理员可以创建管理员组'
            }
        }), 403
    
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_REQUEST',
                'message': '管理员组名称不能为空'
            }
        }), 400
    
    # 检查管理员组名称是否已存在
    existing_group = AdminGroup.query.filter_by(name=data['name']).first()
    if existing_group:
        return jsonify({
            'success': False,
            'error': {
                'code': 'GROUP_EXISTS',
                'message': '管理员组名称已存在'
            }
        }), 400
    
    admin_group = AdminGroup(
        id=str(uuid.uuid4()),
        name=data['name'],
        description=data.get('description', '')
    )
    
    db.session.add(admin_group)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': {
            'admin_group': admin_group.to_dict()
        }
    })

@user_groups_bp.route('/admin-groups/<admin_group_id>/bind-user-group', methods=['POST'])
@login_required
def bind_user_group(current_user, admin_group_id):
    """绑定管理员组和用户组"""
    if not current_user.is_admin()():
        return jsonify({
            'success': False,
            'error': {
                'code': 'PERMISSION_DENIED',
                'message': '只有管理员可以绑定用户组'
            }
        }), 403
    
    data = request.get_json()
    if not data or 'user_group_id' not in data:
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_REQUEST',
                'message': '用户组ID不能为空'
            }
        }), 400
    
    user_group_id = data['user_group_id']
    
    # 检查管理员组和用户组是否存在
    admin_group = AdminGroup.query.get(admin_group_id)
    user_group = UserGroup.query.get(user_group_id)
    
    if not admin_group:
        return jsonify({
            'success': False,
            'error': {
                'code': 'ADMIN_GROUP_NOT_FOUND',
                'message': '管理员组不存在'
            }
        }), 404
    
    if not user_group:
        return jsonify({
            'success': False,
            'error': {
                'code': 'USER_GROUP_NOT_FOUND',
                'message': '用户组不存在'
            }
        }), 404
    
    # 检查绑定关系是否已存在
    existing_binding = AdminGroupBinding.query.filter_by(
        admin_group_id=admin_group_id,
        user_group_id=user_group_id
    ).first()
    
    if existing_binding:
        return jsonify({
            'success': False,
            'error': {
                'code': 'BINDING_EXISTS',
                'message': '绑定关系已存在'
            }
        }), 400
    
    binding = AdminGroupBinding(
        id=str(uuid.uuid4()),
        admin_group_id=admin_group_id,
        user_group_id=user_group_id
    )
    
    db.session.add(binding)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': {
            'binding': binding.to_dict()
        }
    })

@user_groups_bp.route('/users/<user_id>/assign-group', methods=['POST'])
@login_required
def assign_user_to_group(current_user, user_id):
    """将用户分配到用户组或管理员组"""
    if not current_user.is_admin()():
        return jsonify({
            'success': False,
            'error': {
                'code': 'PERMISSION_DENIED',
                'message': '只有管理员可以分配用户组'
            }
        }), 403
    
    data = request.get_json()
    if not data:
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_REQUEST',
                'message': '请求数据不能为空'
            }
        }), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({
            'success': False,
            'error': {
                'code': 'USER_NOT_FOUND',
                'message': '用户不存在'
            }
        }), 404
    
    # 分配用户组
    if 'user_group_id' in data:
        user_group_id = data['user_group_id']
        if user_group_id:
            user_group = UserGroup.query.get(user_group_id)
            if not user_group:
                return jsonify({
                    'success': False,
                    'error': {
                        'code': 'USER_GROUP_NOT_FOUND',
                        'message': '用户组不存在'
                    }
                }), 404
        user.user_group_id = user_group_id
    
    # 分配管理员组（仅限管理员）
    if 'admin_group_id' in data and user.is_admin():
        admin_group_id = data['admin_group_id']
        if admin_group_id:
            admin_group = AdminGroup.query.get(admin_group_id)
            if not admin_group:
                return jsonify({
                    'success': False,
                    'error': {
                        'code': 'ADMIN_GROUP_NOT_FOUND',
                        'message': '管理员组不存在'
                    }
                }), 404
        user.admin_group_id = admin_group_id
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': {
            'user': user.to_dict()
        }
    })

@user_groups_bp.route('/users/assignable', methods=['GET'])
@login_required
def get_assignable_users(current_user):
    """获取当前管理员可以分配任务的用户列表"""
    if not current_user.is_admin()():
        return jsonify({
            'success': False,
            'error': {
                'code': 'PERMISSION_DENIED',
                'message': '只有管理员可以查看可分配用户'
            }
        }), 403
    
    assignable_users = current_user.get_assignable_users()
    
    return jsonify({
        'success': True,
        'data': {
            'users': [user.to_dict() for user in assignable_users]
        }
    })

