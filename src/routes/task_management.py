from flask import Blueprint, request, jsonify, current_app
import os
from src.models.task import Task, TaskAssignment
from src.models.file import File
from src.models.qa_pair import QAPair
from src.models.user import User
from src.models import db
from src.utils.auth import login_required, create_response, paginate_query
from src.utils.file_handler import (
    save_uploaded_file, parse_jsonl_file, split_qa_pairs_for_assignment,
    merge_qa_pairs_from_assignments, export_to_jsonl, export_to_excel,
    create_export_filename
)

task_management_bp = Blueprint('task_management', __name__)

@task_management_bp.route('/tasks', methods=['GET'])
@login_required
def get_tasks(current_user):
    """获取任务列表"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        task_type = request.args.get('type')  # 'created' or 'assigned'
        
        if task_type == 'created':
            # 获取用户创建的任务
            query = Task.query.filter_by(created_by=current_user.id)
        elif task_type == 'assigned':
            # 获取分配给用户的任务
            assignment_query = TaskAssignment.query.filter_by(assigned_to=current_user.id)
            task_ids = [assignment.task_id for assignment in assignment_query]
            query = Task.query.filter(Task.id.in_(task_ids))
        else:
            # 获取所有相关任务
            created_query = Task.query.filter_by(created_by=current_user.id)
            assignment_query = TaskAssignment.query.filter_by(assigned_to=current_user.id)
            assigned_task_ids = [assignment.task_id for assignment in assignment_query]
            
            if assigned_task_ids:
                query = created_query.union(
                    Task.query.filter(Task.id.in_(assigned_task_ids))
                )
            else:
                query = created_query
        
        # 状态过滤
        if status:
            query = query.filter_by(status=status)
        
        query = query.order_by(Task.created_at.desc())
        
        result = paginate_query(query, page, per_page)
        
        # 添加任务详细信息
        for item in result['items']:
            task = Task.get_by_id(item['id'])
            item.update(task.to_dict(include_assignments=True))
            
            # 添加用户在该任务中的角色
            if task.created_by == current_user.id:
                item['user_role'] = 'creator'
            else:
                assignment = task.get_assignment_for_user(current_user.id)
                if assignment:
                    item['user_role'] = 'assignee'
                    item['assignment'] = assignment.to_dict()
                else:
                    item['user_role'] = 'viewer'
        
        return jsonify(create_response(
            success=True,
            data=result
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取任务列表失败: {str(e)}'}
        )), 500

@task_management_bp.route('/tasks', methods=['POST'])
@login_required
def create_task(current_user):
    """创建任务"""
    try:
        # 检查是否有文件上传
        if 'file' not in request.files:
            return jsonify(create_response(
                success=False,
                error={'code': 'NO_FILE', 'message': '没有选择文件'}
            )), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify(create_response(
                success=False,
                error={'code': 'NO_FILE', 'message': '没有选择文件'}
            )), 400
        
        # 获取表单数据
        title = request.form.get('title')
        description = request.form.get('description', '')
        is_collaborative = request.form.get('is_collaborative', 'false').lower() == 'true'
        
        if not title:
            return jsonify(create_response(
                success=False,
                error={'code': 'MISSING_FIELDS', 'message': '任务标题不能为空'}
            )), 400
        
        # 保存文件
        file_info, error = save_uploaded_file(file, current_app.config['UPLOAD_FOLDER'])
        if error:
            return jsonify(create_response(
                success=False,
                error={'code': 'UPLOAD_ERROR', 'message': error}
            )), 400
        
        # 解析JSONL文件
        qa_pairs, parse_error = parse_jsonl_file(file_info['file_path'])
        if parse_error:
            # 删除已上传的文件
            os.remove(file_info['file_path'])
            return jsonify(create_response(
                success=False,
                error={'code': 'PARSE_ERROR', 'message': parse_error}
            )), 400
        
        # 创建任务
        task = Task.create_task(
            title=title,
            description=description,
            original_filename=file_info['original_filename'],
            created_by=current_user.id,
            total_qa_pairs=len(qa_pairs),
            is_collaborative=is_collaborative
        )
        
        # 创建文件记录
        file_record = File.create_file(
            filename=file_info['filename'],
            original_filename=file_info['original_filename'],
            file_path=file_info['file_path'],
            file_size=file_info['file_size'],
            file_type=file_info['file_type'],
            uploaded_by=current_user.id,
            task_id=task.id
        )
        
        # 创建QA对记录
        QAPair.create_from_jsonl_data(file_record.id, qa_pairs, task.id)
        
        return jsonify(create_response(
            success=True,
            data=task.to_dict(include_assignments=True),
            message='任务创建成功'
        )), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'创建任务失败: {str(e)}'}
        )), 500

@task_management_bp.route('/tasks/<int:task_id>', methods=['GET'])
@login_required
def get_task(current_user, task_id):
    """获取任务详情"""
    try:
        task = Task.get_or_404(task_id)
        
        # 权限检查
        if not task.can_be_accessed_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        task_data = task.to_dict(include_assignments=True)
        
        # 添加用户在该任务中的角色
        if task.created_by == current_user.id:
            task_data['user_role'] = 'creator'
        else:
            assignment = task.get_assignment_for_user(current_user.id)
            if assignment:
                task_data['user_role'] = 'assignee'
                task_data['assignment'] = assignment.to_dict()
            else:
                task_data['user_role'] = 'viewer'
        
        return jsonify(create_response(
            success=True,
            data=task_data
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取任务详情失败: {str(e)}'}
        )), 500

@task_management_bp.route('/tasks/<int:task_id>/assign', methods=['POST'])
@login_required
def assign_task(current_user, task_id):
    """分配任务"""
    try:
        task = Task.get_or_404(task_id)
        
        # 权限检查
        if not task.can_be_managed_by(current_user):
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
        
        assignments = data.get('assignments', [])
        if not assignments:
            return jsonify(create_response(
                success=False,
                error={'code': 'MISSING_FIELDS', 'message': '分配信息不能为空'}
            )), 400
        
        # 验证分配信息
        total_assigned = 0
        for assignment in assignments:
            user_id = assignment.get('user_id')
            count = assignment.get('count', 0)
            
            if not user_id or count <= 0:
                return jsonify(create_response(
                    success=False,
                    error={'code': 'INVALID_ASSIGNMENT', 'message': '分配信息格式错误'}
                )), 400
            
            # 检查用户是否存在且可被管理
            user = User.get_by_id(user_id)
            if not user or not user.is_active:
                return jsonify(create_response(
                    success=False,
                    error={'code': 'INVALID_USER', 'message': f'用户ID {user_id} 不存在或已被禁用'}
                )), 400
            
            # 检查管理员是否可以管理该用户
            if not current_user.is_super_admin():
                manageable_users = current_user.get_manageable_users()
                if user not in manageable_users:
                    return jsonify(create_response(
                        success=False,
                        error={'code': 'FORBIDDEN', 'message': f'无权限分配任务给用户 {user.display_name}'}
                    )), 403
            
            total_assigned += count
        
        if total_assigned > task.total_qa_pairs:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_ASSIGNMENT', 'message': '分配的QA对数量超过了总数量'}
            )), 400
        
        # 删除现有分配
        TaskAssignment.query.filter_by(task_id=task_id).delete()
        
        # 创建新分配
        start_index = 0
        for assignment in assignments:
            user_id = assignment['user_id']
            count = assignment['count']
            end_index = start_index + count - 1
            
            TaskAssignment.create_assignment(
                task_id=task_id,
                assigned_to=user_id,
                start_index=start_index,
                end_index=end_index
            )
            
            start_index += count
        
        # 更新任务状态
        task.status = 'in_progress'
        task.is_collaborative = True
        db.session.commit()
        
        return jsonify(create_response(
            success=True,
            data=task.to_dict(include_assignments=True),
            message='任务分配成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'分配任务失败: {str(e)}'}
        )), 500

@task_management_bp.route('/tasks/<int:task_id>/submit', methods=['POST'])
@login_required
def submit_task_assignment(current_user, task_id):
    """提交任务分配"""
    try:
        task = Task.get_or_404(task_id)
        
        # 获取用户的任务分配
        assignment = task.get_assignment_for_user(current_user.id)
        if not assignment:
            return jsonify(create_response(
                success=False,
                error={'code': 'NO_ASSIGNMENT', 'message': '您没有被分配此任务'}
            )), 400
        
        if assignment.status == 'completed':
            return jsonify(create_response(
                success=False,
                error={'code': 'ALREADY_SUBMITTED', 'message': '任务已经提交过了'}
            )), 400
        
        # 提交任务分配
        assignment.submit()
        
        return jsonify(create_response(
            success=True,
            data=assignment.to_dict(),
            message='任务提交成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'提交任务失败: {str(e)}'}
        )), 500

@task_management_bp.route('/tasks/<int:task_id>/qa-pairs', methods=['GET'])
@login_required
def get_task_qa_pairs(current_user, task_id):
    """获取任务的QA对"""
    try:
        task = Task.get_or_404(task_id)
        
        # 权限检查
        if not task.can_be_accessed_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # 获取任务的文件
        file_record = task.files.first()
        if not file_record:
            return jsonify(create_response(
                success=False,
                error={'code': 'NO_FILE', 'message': '任务没有关联文件'}
            )), 400
        
        # 根据用户角色获取QA对
        if task.created_by == current_user.id:
            # 创建者可以查看所有QA对
            query = QAPair.query.filter_by(file_id=file_record.id, is_deleted=False)
        else:
            # 被分配用户只能查看自己负责的部分
            assignment = task.get_assignment_for_user(current_user.id)
            if assignment:
                query = QAPair.query.filter(
                    QAPair.file_id == file_record.id,
                    QAPair.index_in_file >= assignment.start_index,
                    QAPair.index_in_file <= assignment.end_index,
                    QAPair.is_deleted == False
                )
            else:
                query = QAPair.query.filter(QAPair.id == -1)  # 返回空结果
        
        query = query.order_by(QAPair.index_in_file)
        
        # 分页
        pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        qa_pairs = [qa.to_dict(include_edit_history=True) for qa in pagination.items]
        
        return jsonify(create_response(
            success=True,
            data={
                'qa_pairs': qa_pairs,
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
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取任务QA对失败: {str(e)}'}
        )), 500

@task_management_bp.route('/tasks/<int:task_id>/export', methods=['POST'])
@login_required
def export_task(current_user, task_id):
    """导出任务结果"""
    try:
        task = Task.get_or_404(task_id)
        
        # 权限检查（只有创建者可以导出完整任务）
        if not task.can_be_managed_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        data = request.get_json()
        export_type = data.get('type', 'jsonl') if data else 'jsonl'
        
        # 获取任务的文件
        file_record = task.files.first()
        if not file_record:
            return jsonify(create_response(
                success=False,
                error={'code': 'NO_FILE', 'message': '任务没有关联文件'}
            )), 400
        
        # 获取所有QA对（按索引排序）
        qa_pairs = QAPair.query.filter_by(
            file_id=file_record.id,
            is_deleted=False
        ).order_by(QAPair.index_in_file).all()
        
        if not qa_pairs:
            return jsonify(create_response(
                success=False,
                error={'code': 'NO_DATA', 'message': '没有可导出的数据'}
            )), 400
        
        # 准备导出数据（包含溯源信息）
        export_data = []
        for qa in qa_pairs:
            qa_data = {
                'prompt': qa.prompt,
                'completion': qa.completion
            }
            
            # 如果是协作任务，添加编辑者信息作为注释
            if task.is_collaborative and qa.edited_by:
                qa_data['_editor'] = qa.editor.display_name
                qa_data['_edited_at'] = qa.edited_at.isoformat() if qa.edited_at else None
            
            export_data.append(qa_data)
        
        # 创建导出文件
        export_filename = create_export_filename(
            task.original_filename,
            export_type,
            'completed'
        )
        export_path = os.path.join(current_app.config['EXPORT_FOLDER'], export_filename)
        
        if export_type == 'excel':
            # Excel格式需要特殊处理溯源信息
            excel_data = []
            for qa_data in export_data:
                row = {
                    'prompt': qa_data['prompt'],
                    'completion': qa_data['completion']
                }
                if '_editor' in qa_data:
                    row['editor'] = qa_data['_editor']
                    row['edited_at'] = qa_data['_edited_at']
                excel_data.append(row)
            
            success, error = export_to_excel(excel_data, export_path)
        else:
            success, error = export_to_jsonl(export_data, export_path)
        
        if not success:
            return jsonify(create_response(
                success=False,
                error={'code': 'EXPORT_ERROR', 'message': error}
            )), 500
        
        from flask import send_file
        return send_file(
            export_path,
            as_attachment=True,
            download_name=export_filename
        )
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'导出任务失败: {str(e)}'}
        )), 500

@task_management_bp.route('/tasks/<int:task_id>', methods=['DELETE'])
@login_required
def delete_task(current_user, task_id):
    """删除任务"""
    try:
        task = Task.get_or_404(task_id)
        
        # 权限检查
        if not task.can_be_managed_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 删除关联的文件
        for file_record in task.files:
            file_record.delete_physical_file()
        
        # 删除任务（级联删除相关记录）
        task.delete()
        
        return jsonify(create_response(
            success=True,
            message='任务删除成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'删除任务失败: {str(e)}'}
        )), 500

