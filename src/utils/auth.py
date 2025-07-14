import jwt
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, current_app

def generate_token(user_id, role, expires_in=24):
    """生成JWT令牌"""
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.utcnow() + timedelta(hours=expires_in),
        'iat': datetime.utcnow()
    }
    
    token = jwt.encode(
        payload,
        current_app.config['JWT_SECRET_KEY'],
        algorithm='HS256'
    )
    
    return token

def verify_token(token):
    """验证JWT令牌"""
    try:
        payload = jwt.decode(
            token,
            current_app.config['JWT_SECRET_KEY'],
            algorithms=['HS256']
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_current_user():
    """获取当前用户"""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    
    try:
        token = auth_header.split(' ')[1]  # Bearer <token>
        payload = verify_token(token)
        if not payload:
            return None
        
        # 导入User模型
        from src.models.user import User
        user = User.query.filter_by(id=payload['user_id'], is_active=True).first()
        if not user:
            return None
        
        return user
    except (IndexError, KeyError):
        return None

def login_required(f):
    """登录验证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'UNAUTHORIZED',
                    'message': '请先登录'
                }
            }), 401
        
        # 将用户对象传递给视图函数
        return f(user, *args, **kwargs)
    
    return decorated_function

def role_required(*allowed_roles):
    """角色验证装饰器"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({
                    'success': False,
                    'error': {
                        'code': 'UNAUTHORIZED',
                        'message': '请先登录'
                    }
                }), 401
            
            if user.role not in allowed_roles:
                return jsonify({
                    'success': False,
                    'error': {
                        'code': 'FORBIDDEN',
                        'message': '权限不足'
                    }
                }), 403
            
            return f(user, *args, **kwargs)
        
        return decorated_function
    return decorator

def admin_required(f):
    """管理员权限验证装饰器"""
    return role_required('admin', 'super_admin')(f)

def super_admin_required(f):
    """超级管理员权限验证装饰器"""
    return role_required('super_admin')(f)

def validate_password(password):
    """验证密码强度"""
    if len(password) < 4:
        return False, "密码长度至少4位"
    
    return True, "密码有效"

def create_response(success=True, data=None, error=None, message=None):
    """创建标准API响应"""
    response = {
        'success': success,
        'timestamp': datetime.utcnow().isoformat()
    }
    
    if success:
        if data is not None:
            response['data'] = data
        if message:
            response['message'] = message
    else:
        if error:
            response['error'] = error
        elif message:
            response['error'] = {
                'code': 'GENERAL_ERROR',
                'message': message
            }
    
    return response

def paginate_query(query, page=1, per_page=20, max_per_page=100):
    """分页查询"""
    if per_page > max_per_page:
        per_page = max_per_page
    
    pagination = query.paginate(
        page=page,
        per_page=per_page,
        error_out=False
    )
    
    return {
        'items': [item.to_dict() for item in pagination.items],
        'pagination': {
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'pages': pagination.pages,
            'has_prev': pagination.has_prev,
            'has_next': pagination.has_next,
            'prev_num': pagination.prev_num,
            'next_num': pagination.next_num
        }
    }

