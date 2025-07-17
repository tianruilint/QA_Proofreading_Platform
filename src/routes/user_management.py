from flask import Blueprint, request, jsonify
from src.models.user import User
from src.models.admin_group import AdminGroup
from src.models.user_group import UserGroup
from src.models import db
from src.utils.auth import login_required, super_admin_required, admin_required, create_response, paginate_query, validate_password

user_management_bp = Blueprint('user_management', __name__)

@user_management_bp.route('/users', methods=['GET'])
@login_required
def get_users(current_user):
    """获取用户列表"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        role = request.args.get('role')
        group_id = request.args.get('group_id', type=int)
        
        query = User.query.filter_by(is_active=True)
        
        # 权限过滤
        if current_user.is_super_admin():
            # 超级管理员可以查看所有用户
            pass
        elif current_user.is_admin():
            # 管理员只能查看自己可管理的用户
            manageable_users = current_user.get_manageable_users()
            user_ids = [user.id for user in manageable_users]
            query = query.filter(User.id.in_(user_ids))
        else:
            # 普通用户只能查看自己
            query = query.filter_by(id=current_user.id)
        
        # 角色过滤
        if role:
            query = query.filter_by(role=role)
        
        # 组过滤
        if group_id:
            if role == 'admin':
                query = query.filter_by(admin_group_id=group_id)
            else:
                query = query.filter_by(user_group_id=group_id)
        
        result = paginate_query(query, page, per_page)
        
        return jsonify(create_response(
            success=True,
            data=result
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取用户列表失败: {str(e)}'}
        )), 500

@user_management_bp.route('/users', methods=['POST'])
@admin_required
def create_user(current_user):
    """创建用户"""
    try:
        data = request.get_json()
        if not data:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_REQUEST', 'message': '请求数据格式错误'}
            )), 400
        
        username = data.get('username')
        password = data.get('password', '1111')  # 默认密码
        display_name = data.get('display_name')
        role = data.get('role', 'user')
        admin_group_id = data.get('admin_group_id')
        user_group_id = data.get('user_group_id')
        
        # 验证必需字段
        if not username or not display_name:
            return jsonify(create_response(
                success=False,
                error={'code': 'MISSING_FIELDS', 'message': '用户名和显示名称不能为空'}
            )), 400
        
        # 根据当前用户角色限制可创建的角色
        if current_user.role == 'admin':
            # 管理员只能创建普通用户
            if role != 'user':
                return jsonify(create_response(
                    success=False,
                    error={'code': 'FORBIDDEN', 'message': '管理员只能创建普通用户'}
                )), 403
        elif current_user.role == 'super_admin':
            # 超级管理员可以创建任何角色
            if role not in ['super_admin', 'admin', 'user']:
                return jsonify(create_response(
                    success=False,
                    error={'code': 'INVALID_ROLE', 'message': '无效的角色'}
                )), 400
        else:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 检查用户名是否已存在
        existing_user = User.get_by_username(username)
        if existing_user:
            return jsonify(create_response(
                success=False,
                error={'code': 'USERNAME_EXISTS', 'message': '用户名已存在'}
            )), 400
        
        # 验证密码
        is_valid, message = validate_password(password)
        if not is_valid:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_PASSWORD', 'message': message}
            )), 400
        
        # 验证组关联
        if role == 'admin' and admin_group_id:
            # 只有超级管理员可以分配管理员组
            if current_user.role != 'super_admin':
                return jsonify(create_response(
                    success=False,
                    error={'code': 'FORBIDDEN', 'message': '管理员无权分配管理员组'}
                )), 403
                
            admin_group = AdminGroup.get_by_id(admin_group_id)
            if not admin_group or not admin_group.is_active:
                return jsonify(create_response(
                    success=False,
                    error={'code': 'INVALID_GROUP', 'message': '无效的管理员组'}
                )), 400
        
        if role == 'user' and user_group_id:
            user_group = UserGroup.get_by_id(user_group_id)
            if not user_group or not user_group.is_active:
                return jsonify(create_response(
                    success=False,
                    error={'code': 'INVALID_GROUP', 'message': '无效的用户组'}
                )), 400
            
            # 管理员只能分配自己可管理的用户组
            if current_user.role == 'admin':
                manageable_groups = current_user.get_manageable_user_groups()
                manageable_group_ids = [group.id for group in manageable_groups]
                if user_group_id not in manageable_group_ids:
                    return jsonify(create_response(
                        success=False,
                        error={'code': 'FORBIDDEN', 'message': '无权分配该用户组'}
                    )), 403
        
        # 创建用户
        user = User.create_user(
            username=username,
            password=password,
            display_name=display_name,
            role=role,
            admin_group_id=admin_group_id if role == 'admin' else None,
            user_group_id=user_group_id if role == 'user' else None
        )
        
        return jsonify(create_response(
            success=True,
            data=user.to_dict(),
            message='用户创建成功'
        )), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'创建用户失败: {str(e)}'}
        )), 500

@user_management_bp.route('/users/<int:user_id>', methods=['GET'])
@login_required
def get_user(current_user, user_id):
    """获取用户详情"""
    try:
        user = User.get_or_404(user_id)
        
        # 权限检查
        if not current_user.is_super_admin():
            if current_user.id != user_id:
                if current_user.is_admin():
                    # 管理员只能查看自己可管理的用户
                    manageable_users = current_user.get_manageable_users()
                    if user not in manageable_users:
                        return jsonify(create_response(
                            success=False,
                            error={'code': 'FORBIDDEN', 'message': '权限不足'}
                        )), 403
                else:
                    return jsonify(create_response(
                        success=False,
                        error={'code': 'FORBIDDEN', 'message': '权限不足'}
                    )), 403
        
        return jsonify(create_response(
            success=True,
            data=user.to_dict()
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取用户详情失败: {str(e)}'}
        )), 500

@user_management_bp.route('/users/<int:user_id>', methods=['PUT'])
@login_required
def update_user(current_user, user_id):
    """更新用户信息"""
    try:
        user = User.get_or_404(user_id)
        
        # 权限检查
        can_update = False
        if current_user.is_super_admin():
            can_update = True
        elif current_user.id == user_id:
            can_update = True
        elif current_user.is_admin():
            manageable_users = current_user.get_manageable_users()
            if user in manageable_users:
                can_update = True
        
        if not can_update:
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        data = request.get_json()
        if not data:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_REQUEST', 'message': '请求数据格式错误'}
            )), 400
        
        # 更新允许的字段
        updatable_fields = ['display_name', 'avatar_url']
        
        # 超级管理员可以更新更多字段
        if current_user.is_super_admin():
            updatable_fields.extend(['role', 'admin_group_id', 'user_group_id', 'is_active'])
        
        for field in updatable_fields:
            if field in data:
                setattr(user, field, data[field])
        
        db.session.commit()
        
        return jsonify(create_response(
            success=True,
            data=user.to_dict(),
            message='用户信息更新成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'更新用户信息失败: {str(e)}'}
        )), 500

@user_management_bp.route('/users/<int:user_id>', methods=['DELETE'])
@super_admin_required
def delete_user(current_user, user_id):
    """删除用户（软删除）"""
    try:
        user = User.get_or_404(user_id)
        
        # 不能删除自己
        if user.id == current_user.id:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_OPERATION', 'message': '不能删除自己'}
            )), 400
        
        # 软删除
        user.is_active = False
        db.session.commit()
        
        return jsonify(create_response(
            success=True,
            message='用户删除成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'删除用户失败: {str(e)}'}
        )), 500

@user_management_bp.route('/users/<int:user_id>/reset-password', methods=['POST'])
@login_required
def reset_user_password(current_user, user_id):
    """重置用户密码"""
    try:
        user = User.get_or_404(user_id)

        # 权限检查
        if not current_user.is_super_admin():
            if current_user.id != user_id: # 用户可以重置自己的密码
                if current_user.is_admin():
                    # 管理员只能重置其管理的用户组中的用户密码
                    manageable_users = current_user.get_manageable_users()
                    if user not in manageable_users:
                        return jsonify(create_response(
                            success=False,
                            error={'code': 'FORBIDDEN', 'message': '权限不足，无法重置该用户密码'}
                        )), 403
                else:
                    return jsonify(create_response(
                        success=False,
                        error={'code': 'FORBIDDEN', 'message': '权限不足，无法重置该用户密码'}
                    )), 403

        # 不能重置超级管理员的密码，除非是超级管理员自己
        if user.is_super_admin() and not current_user.is_super_admin():
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '无权重置超级管理员密码'}
            )), 403

        # 不能重置管理员的密码，除非是超级管理员
        if user.is_admin() and not current_user.is_super_admin():
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '无权重置管理员密码'}
            )), 403

        data = request.get_json(silent=True) or {}
        new_password = data.get("new_password", "1111")
        # 验证密码
        is_valid, message = validate_password(new_password)
        if not is_valid:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_PASSWORD', 'message': message}
            )), 400
        
        user.set_password(new_password)
        db.session.commit()
        
        return jsonify(create_response(
            success=True,
            message='密码重置成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'重置密码失败: {str(e)}'}
        )), 500

