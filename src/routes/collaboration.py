import os
import json
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from src.models import db
from src.models.task import Task, TaskAssignment
from src.models.qa_pair import QAPair
from src.models.user import User
from src.routes.auth import login_required
from src.config import Config

# 创建蓝图
collaboration_bp = Blueprint('collaboration', __name__)

@collaboration_bp.route('/collaboration/tasks', methods=['POST'])
@login_required
def create_task():
    """创建协作任务"""
    if 'file' not in request.files:
        return jsonify({
            'success': False,
            'error': {
                'code': 'NO_FILE',
                'message': '没有文件被上传'
            }
        }), 400
    
    file = request.files['file']
    title = request.form.get('title')
    description = request.form.get('description', '')
    proofreaders = request.form.getlist('proofreaders')
    reviewers = request.form.getlist('reviewers')
    
    if not title:
        return jsonify({
            'success': False,
            'error': {
                'code': 'MISSING_TITLE',
                'message': '任务标题不能为空'
            }
        }), 400
    
    if file.filename == '' or not file.filename.endswith('.jsonl'):
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_FILE',
                'message': '请上传有效的JSONL文件'
            }
        }), 400
    
    try:
        # 保存文件
        filename = secure_filename(file.filename)
        task_id = str(uuid.uuid4())
        file_path = os.path.join(Config.UPLOAD_FOLDER, f"task_{task_id}_{filename}")
        file.save(file_path)
        
        # 解析JSONL文件
        qa_pairs = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    data = json.loads(line)
                    if 'question' not in data or 'answer' not in data:
                        return jsonify({
                            'success': False,
                            'error': {
                                'code': 'INVALID_FORMAT',
                                'message': f'第{line_num}行格式错误'
                            }
                        }), 400
                    
                    qa_pairs.append({
                        'original_question': data['question'],
                        'original_answer': data['answer']
                    })
                    
                except json.JSONDecodeError:
                    return jsonify({
                        'success': False,
                        'error': {
                            'code': 'INVALID_JSON',
                            'message': f'第{line_num}行JSON格式错误'
                        }
                    }), 400
        
        # 创建任务
        task = Task(
            id=task_id,
            title=title,
            description=description,
            file_path=file_path,
            created_by=request.current_user.id
        )
        db.session.add(task)
        
        # 创建任务分配
        for user_id in proofreaders:
            assignment = TaskAssignment(
                id=str(uuid.uuid4()),
                task_id=task_id,
                user_id=user_id,
                role='proofreader'
            )
            db.session.add(assignment)
        
        for user_id in reviewers:
            assignment = TaskAssignment(
                id=str(uuid.uuid4()),
                task_id=task_id,
                user_id=user_id,
                role='reviewer'
            )
            db.session.add(assignment)
        
        # 创建QA对记录
        for qa_data in qa_pairs:
            qa_pair = QAPair(
                id=str(uuid.uuid4()),
                task_id=task_id,
                original_question=qa_data['original_question'],
                original_answer=qa_data['original_answer']
            )
            db.session.add(qa_pair)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {
                'task': task.to_dict()
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': {
                'code': 'CREATE_ERROR',
                'message': f'创建任务失败：{str(e)}'
            }
        }), 500

@collaboration_bp.route('/collaboration/tasks', methods=['GET'])
@login_required
def get_tasks():
    """获取任务列表"""
    # 获取用户参与的任务
    user_assignments = TaskAssignment.query.filter_by(user_id=request.current_user.id).all()
    task_ids = [assignment.task_id for assignment in user_assignments]
    
    # 如果是管理员，也包括自己创建的任务
    if request.current_user.is_admin:
        created_tasks = Task.query.filter_by(created_by=request.current_user.id).all()
        task_ids.extend([task.id for task in created_tasks])
    
    tasks = Task.query.filter(Task.id.in_(task_ids)).all() if task_ids else []
    
    return jsonify({
        'success': True,
        'data': {
            'tasks': [task.to_dict() for task in tasks]
        }
    })

@collaboration_bp.route('/collaboration/tasks/<task_id>', methods=['GET'])
@login_required
def get_task(task_id):
    """获取任务详情"""
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
        user_id=request.current_user.id
    ).first()
    
    if not assignment and task.created_by != request.current_user.id:
        return jsonify({
            'success': False,
            'error': {
                'code': 'ACCESS_DENIED',
                'message': '没有访问权限'
            }
        }), 403
    
    # 获取任务分配信息
    assignments = TaskAssignment.query.filter_by(task_id=task_id).all()
    
    return jsonify({
        'success': True,
        'data': {
            'task': task.to_dict(),
            'assignments': [assignment.to_dict() for assignment in assignments],
            'user_role': assignment.role if assignment else 'creator'
        }
    })

@collaboration_bp.route('/collaboration/tasks/<task_id>/qa-pairs', methods=['GET'])
@login_required
def get_task_qa_pairs(task_id):
    """获取任务的QA对列表"""
    # 检查权限
    task = Task.query.get(task_id)
    if not task:
        return jsonify({
            'success': False,
            'error': {
                'code': 'TASK_NOT_FOUND',
                'message': '任务不存在'
            }
        }), 404
    
    assignment = TaskAssignment.query.filter_by(
        task_id=task_id, 
        user_id=request.current_user.id
    ).first()
    
    if not assignment and task.created_by != request.current_user.id:
        return jsonify({
            'success': False,
            'error': {
                'code': 'ACCESS_DENIED',
                'message': '没有访问权限'
            }
        }), 403
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    
    qa_pairs = QAPair.query.filter_by(task_id=task_id).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'success': True,
        'data': {
            'qa_pairs': [qa.to_dict() for qa in qa_pairs.items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': qa_pairs.total,
                'pages': qa_pairs.pages
            }
        }
    })

@collaboration_bp.route('/collaboration/tasks/<task_id>/qa-pairs/<qa_id>', methods=['PUT'])
@login_required
def update_task_qa_pair(task_id, qa_id):
    """更新任务中的QA对"""
    qa_pair = QAPair.query.filter_by(id=qa_id, task_id=task_id).first()
    if not qa_pair:
        return jsonify({
            'success': False,
            'error': {
                'code': 'QA_PAIR_NOT_FOUND',
                'message': 'QA对不存在'
            }
        }), 404
    
    # 检查权限
    assignment = TaskAssignment.query.filter_by(
        task_id=task_id, 
        user_id=request.current_user.id
    ).first()
    
    if not assignment:
        return jsonify({
            'success': False,
            'error': {
                'code': 'ACCESS_DENIED',
                'message': '没有访问权限'
            }
        }), 403
    
    data = request.get_json()
    if not data:
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_REQUEST',
                'message': '请求数据无效'
            }
        }), 400
    
    # 根据用户角色更新不同字段
    if assignment.role == 'proofreader':
        if 'corrected_question' in data:
            qa_pair.corrected_question = data['corrected_question']
        if 'corrected_answer' in data:
            qa_pair.corrected_answer = data['corrected_answer']
        
        qa_pair.status = 'corrected'
        qa_pair.corrected_by = request.current_user.id
        qa_pair.corrected_at = datetime.utcnow()
        
    elif assignment.role == 'reviewer':
        if qa_pair.status != 'corrected':
            return jsonify({
                'success': False,
                'error': {
                    'code': 'INVALID_STATUS',
                    'message': '只能审核已校对的QA对'
                }
            }), 400
        
        qa_pair.status = 'approved'
        qa_pair.reviewed_by = request.current_user.id
        qa_pair.reviewed_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': {
            'qa_pair': qa_pair.to_dict()
        }
    })

