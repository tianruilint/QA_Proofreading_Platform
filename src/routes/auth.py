from flask import Blueprint, request, jsonify
from src.models.user import User
from src.models.admin_group import AdminGroup
from src.models.user_group import UserGroup
from src.models import db
from src.utils.auth import login_required, create_response, generate_token
from datetime import datetime, timezone, timedelta

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/login", methods=["POST"])
def login():
    """用户登录"""
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify(create_response(
            success=False,
            error={"code": "MISSING_CREDENTIALS", "message": "用户名和密码不能为空"}
        )), 400

    user = User.get_by_username(username)
    if not user or not user.check_password(password):
        return jsonify(create_response(
            success=False,
            error={"code": "INVALID_CREDENTIALS", "message": "用户名或密码错误"}
        )), 401

    if not user.is_active:
        return jsonify(create_response(
            success=False,
            error={"code": "ACCOUNT_INACTIVE", "message": "账户已被禁用，请联系管理员"}
        )), 403

    beijing_tz = timezone(timedelta(hours=8))
    user.last_login_at = datetime.now(beijing_tz)
    db.session.commit()
    access_token = generate_token(user.id, user.role)
    return jsonify(create_response(
        success=True,
        data={
            "user": user.to_dict(),
            "access_token": access_token
        },
        message="登录成功"
    ))

@auth_bp.route("/change-password", methods=["POST"])
@login_required
def change_password(current_user):
    data = request.get_json()
    old_password = data.get("old_password")
    new_password = data.get("new_password")

    if not old_password or not new_password:
        return jsonify(create_response(
            success=False,
            error={"code": "MISSING_FIELDS", "message": "旧密码和新密码不能为空"}
        )), 400

    if not current_user.check_password(old_password):
        return jsonify(create_response(
            success=False,
            error={"code": "INVALID_OLD_PASSWORD", "message": "旧密码不正确"}
        )), 400

    # 验证新密码强度（这里可以添加更复杂的验证逻辑）
    if len(new_password) < 6:
        return jsonify(create_response(
            success=False,
            error={"code": "WEAK_PASSWORD", "message": "新密码长度不能少于6位"}
        )), 400

    current_user.set_password(new_password)
    db.session.commit()

    return jsonify(create_response(
        success=True,
        message="密码修改成功"
    ))

@auth_bp.route("/users/tree", methods=["GET"])
def get_users_tree():
    try:
        tree_data = []

        # 获取所有管理员组
        admin_groups = AdminGroup.query.filter_by(is_active=True).all()
        for ag in admin_groups:
            admin_group_node = {
                "id": f"admin_group_{ag.id}",
                "label": ag.name,
                "value": f"admin_group_{ag.id}",
                "children": []
            }
            # 获取该管理员组下的管理员
            admins = User.query.filter_by(admin_group_id=ag.id, role="admin", is_active=True).all()
            for admin in admins:
                admin_node = {
                    "id": f"user_{admin.id}",
                    "label": admin.display_name,
                    "value": admin.username, # 返回username用于登录
                    "isLeaf": True
                }
                admin_group_node["children"].append(admin_node)
            tree_data.append(admin_group_node)

        # 获取所有用户组
        user_groups = UserGroup.query.filter_by(is_active=True).all()
        for ug in user_groups:
            user_group_node = {
                "id": f"user_group_{ug.id}",
                "label": ug.name,
                "value": f"user_group_{ug.id}",
                "children": []
            }
            # 获取该用户组下的用户
            users = User.query.filter_by(user_group_id=ug.id, role="user", is_active=True).all()
            for user in users:
                user_node = {
                    "id": f"user_{user.id}",
                    "label": user.display_name,
                    "value": user.username, # 返回username用于登录
                    "isLeaf": True
                }
                user_group_node["children"].append(user_node)
            tree_data.append(user_group_node)

        # 添加超级管理员（如果存在）
        super_admin = User.query.filter_by(role="super_admin", is_active=True).first()
        if super_admin:
            tree_data.insert(0, {
                "id": f"user_{super_admin.id}",
                "label": super_admin.display_name,
                "value": super_admin.username, # 返回username用于登录
                "isLeaf": True
            })

        return jsonify(create_response(
            success=True,
            data=tree_data
        ))

    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={"code": "INTERNAL_ERROR", "message": f"获取用户列表失败: {str(e)}"}
        )), 500


@auth_bp.route("/guest-login", methods=["POST"])
def guest_login():
    """访客登录"""
    # 访客模式不需要实际的用户认证，直接返回一个访客token
    # 这里可以生成一个特殊的token，或者直接返回一个标识符
    # 为了简化，我们直接返回一个成功的响应
    return jsonify(create_response(
        success=True,
        data={
            "user": {"id": "guest", "display_name": "访客", "role": "guest"},
            "access_token": "guest_token_example"
        },
        message="访客登录成功"
    ))


