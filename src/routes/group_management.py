from flask import Blueprint, request, jsonify
from src.models.admin_group import AdminGroup
from src.models.user_group import UserGroup
from src.models import db
from src.utils.auth import login_required, super_admin_required, create_response, paginate_query

group_management_bp = Blueprint('group_management', __name__)

# 管理员组管理
@group_management_bp.route('/admin-groups', methods=['GET'])
@login_required
def get_admin_groups(current_user):
    """获取管理员组列表"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        query = AdminGroup.query.filter_by(is_active=True)
        
        # 权限过滤
        if not current_user.is_super_admin():
            # 非超级管理员只能查看自己的组
            if current_user.is_admin():
                query = query.filter_by(id=current_user.admin_group_id)
            else:
                query = query.filter(AdminGroup.id == -1)  # 返回空结果
        
        result = paginate_query(query, page, per_page)
        
        # 包含关联信息
        for item in result['items']:
            group = AdminGroup.get_by_id(item['id'])
            item.update(group.to_dict(include_associations=True))
        
        return jsonify(create_response(
            success=True,
            data=result
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取管理员组列表失败: {str(e)}'}
        )), 500

@group_management_bp.route('/admin-groups', methods=['POST'])
@super_admin_required
def create_admin_group(current_user):
    """创建管理员组"""
    try:
        data = request.get_json()
        if not data:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_REQUEST', 'message': '请求数据格式错误'}
            )), 400
        
        name = data.get('name')
        description = data.get('description', '')
        
        if not name:
            return jsonify(create_response(
                success=False,
                error={'code': 'MISSING_FIELDS', 'message': '组名不能为空'}
            )), 400
        
        # 检查组名是否已存在
        existing_group = AdminGroup.query.filter_by(name=name, is_active=True).first()
        if existing_group:
            return jsonify(create_response(
                success=False,
                error={'code': 'GROUP_EXISTS', 'message': '管理员组名已存在'}
            )), 400
        
        # 创建管理员组
        group = AdminGroup.create_group(
            name=name,
            description=description,
            created_by=current_user.id
        )
        
        return jsonify(create_response(
            success=True,
            data=group.to_dict(include_associations=True),
            message='管理员组创建成功'
        )), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'创建管理员组失败: {str(e)}'}
        )), 500

@group_management_bp.route('/admin-groups/<int:group_id>', methods=['PUT'])
@super_admin_required
def update_admin_group(current_user, group_id):
    """更新管理员组"""
    try:
        group = AdminGroup.get_or_404(group_id)
        
        data = request.get_json()
        if not data:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_REQUEST', 'message': '请求数据格式错误'}
            )), 400
        
        # 更新字段
        if 'name' in data:
            # 检查组名是否已存在
            existing_group = AdminGroup.query.filter(
                AdminGroup.name == data['name'],
                AdminGroup.id != group_id,
                AdminGroup.is_active == True
            ).first()
            if existing_group:
                return jsonify(create_response(
                    success=False,
                    error={'code': 'GROUP_EXISTS', 'message': '管理员组名已存在'}
                )), 400
            group.name = data['name']
        
        if 'description' in data:
            group.description = data['description']
        
        db.session.commit()
        
        return jsonify(create_response(
            success=True,
            data=group.to_dict(include_associations=True),
            message='管理员组更新成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'更新管理员组失败: {str(e)}'}
        )), 500

@group_management_bp.route('/admin-groups/<int:group_id>', methods=['DELETE'])
@super_admin_required
def delete_admin_group(current_user, group_id):
    """删除管理员组"""
    try:
        group = AdminGroup.get_or_404(group_id)
        
        # 检查是否有关联的管理员
        if group.members:
            return jsonify(create_response(
                success=False,
                error={'code': 'GROUP_HAS_MEMBERS', 'message': '该管理员组下还有成员，无法删除'}
            )), 400
        
        # 软删除
        group.is_active = False
        db.session.commit()
        
        return jsonify(create_response(
            success=True,
            message='管理员组删除成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'删除管理员组失败: {str(e)}'}
        )), 500

# 用户组管理
@group_management_bp.route('/user-groups', methods=['GET'])
@login_required
def get_user_groups(current_user):
    """获取用户组列表"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        query = UserGroup.query.filter_by(is_active=True)
        
        # 权限过滤
        if not current_user.is_super_admin():
            if current_user.is_admin():
                # 管理员只能查看自己可管理的用户组
                manageable_groups = current_user.get_manageable_user_groups()
                group_ids = [group.id for group in manageable_groups]
                query = query.filter(UserGroup.id.in_(group_ids))
            else:
                # 普通用户只能查看自己的组
                query = query.filter_by(id=current_user.user_group_id)
        
        result = paginate_query(query, page, per_page)
        
        # 包含成员信息
        for item in result['items']:
            group = UserGroup.get_by_id(item['id'])
            item.update(group.to_dict(include_members=True))
        
        return jsonify(create_response(
            success=True,
            data=result
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取用户组列表失败: {str(e)}'}
        )), 500

@group_management_bp.route('/user-groups', methods=['POST'])
@super_admin_required
def create_user_group(current_user):
    """创建用户组"""
    try:
        data = request.get_json()
        if not data:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_REQUEST', 'message': '请求数据格式错误'}
            )), 400
        
        name = data.get('name')
        description = data.get('description', '')
        
        if not name:
            return jsonify(create_response(
                success=False,
                error={'code': 'MISSING_FIELDS', 'message': '组名不能为空'}
            )), 400
        
        # 检查组名是否已存在
        existing_group = UserGroup.query.filter_by(name=name, is_active=True).first()
        if existing_group:
            return jsonify(create_response(
                success=False,
                error={'code': 'GROUP_EXISTS', 'message': '用户组名已存在'}
            )), 400
        
        # 创建用户组
        group = UserGroup.create_group(
            name=name,
            description=description,
            created_by=current_user.id
        )
        
        return jsonify(create_response(
            success=True,
            data=group.to_dict(include_members=True),
            message='用户组创建成功'
        )), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'创建用户组失败: {str(e)}'}
        )), 500

@group_management_bp.route('/user-groups/<int:group_id>', methods=['PUT'])
@super_admin_required
def update_user_group(current_user, group_id):
    """更新用户组"""
    try:
        group = UserGroup.get_or_404(group_id)
        
        data = request.get_json()
        if not data:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_REQUEST', 'message': '请求数据格式错误'}
            )), 400
        
        # 更新字段
        if 'name' in data:
            # 检查组名是否已存在
            existing_group = UserGroup.query.filter(
                UserGroup.name == data['name'],
                UserGroup.id != group_id,
                UserGroup.is_active == True
            ).first()
            if existing_group:
                return jsonify(create_response(
                    success=False,
                    error={'code': 'GROUP_EXISTS', 'message': '用户组名已存在'}
                )), 400
            group.name = data['name']
        
        if 'description' in data:
            group.description = data['description']
        
        db.session.commit()
        
        return jsonify(create_response(
            success=True,
            data=group.to_dict(include_members=True),
            message='用户组更新成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'更新用户组失败: {str(e)}'}
        )), 500

@group_management_bp.route('/user-groups/<int:group_id>', methods=['DELETE'])
@super_admin_required
def delete_user_group(current_user, group_id):
    """删除用户组"""
    try:
        group = UserGroup.get_or_404(group_id)
        
        # 检查是否有关联的用户
        if group.members:
            return jsonify(create_response(
                success=False,
                error={'code': 'GROUP_HAS_MEMBERS', 'message': '该用户组下还有成员，无法删除'}
            )), 400
        
        # 软删除
        group.is_active = False
        db.session.commit()
        
        return jsonify(create_response(
            success=True,
            message='用户组删除成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'删除用户组失败: {str(e)}'}
        )), 500

# 管理员组-用户组关联管理
@group_management_bp.route('/admin-groups/<int:admin_group_id>/user-groups', methods=['POST'])
@super_admin_required
def link_user_groups(current_user, admin_group_id):
    """关联用户组到管理员组"""
    try:
        admin_group = AdminGroup.get_or_404(admin_group_id)
        
        data = request.get_json()
        if not data:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_REQUEST', 'message': '请求数据格式错误'}
            )), 400
        
        user_group_ids = data.get('user_group_ids', [])
        if not user_group_ids:
            return jsonify(create_response(
                success=False,
                error={'code': 'MISSING_FIELDS', 'message': '用户组ID列表不能为空'}
            )), 400
        
        # 验证用户组是否存在
        user_groups = UserGroup.query.filter(
            UserGroup.id.in_(user_group_ids),
            UserGroup.is_active == True
        ).all()
        
        if len(user_groups) != len(user_group_ids):
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_GROUP', 'message': '部分用户组不存在或已被删除'}
            )), 400
        
        # 添加关联
        for user_group in user_groups:
            admin_group.add_user_group(user_group)
        
        return jsonify(create_response(
            success=True,
            data=admin_group.to_dict(include_associations=True),
            message='用户组关联成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'关联用户组失败: {str(e)}'}
        )), 500

@group_management_bp.route('/admin-groups/<int:admin_group_id>/user-groups/<int:user_group_id>', methods=['DELETE'])
@super_admin_required
def unlink_user_group(current_user, admin_group_id, user_group_id):
    """取消用户组关联"""
    try:
        admin_group = AdminGroup.get_or_404(admin_group_id)
        user_group = UserGroup.get_or_404(user_group_id)
        
        admin_group.remove_user_group(user_group)
        
        return jsonify(create_response(
            success=True,
            message='用户组关联已取消'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'取消用户组关联失败: {str(e)}'}
        )), 500

