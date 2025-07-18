from flask import Blueprint, request, jsonify, send_file, current_app
import os
import json
from datetime import datetime
from src.models.collaboration_task import CollaborationTask, CollaborationTaskAssignment
from src.models.file import File
from src.models.qa_pair import QAPair
from src.models.user import User
from src.models.user_group import UserGroup
from src.models import db
from src.utils.auth import login_required, create_response, admin_required
from src.utils.file_handler import (
    save_uploaded_file, parse_jsonl_file, export_to_jsonl, 
    export_to_excel, create_export_filename
)

collaboration_task_bp = Blueprint('collaboration_task', __name__)

@collaboration_task_bp.route('/collaboration-tasks', methods=['GET'])
@login_required
def get_collaboration_tasks(current_user):
    """获取协作任务列表"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        task_type = request.args.get('type')  # 'created' or 'assigned'
        
        if task_type == 'created':
            # 获取用户创建的任务
            query = CollaborationTask.query.filter_by(created_by=current_user.id)
        elif task_type == 'assigned':
            # 获取分配给用户的任务
            assignment_query = CollaborationTaskAssignment.query.filter_by(assigned_to=current_user.id)
            task_ids = [assignment.task_id for assignment in assignment_query]
            if task_ids:
                query = CollaborationTask.query.filter(CollaborationTask.id.in_(task_ids))
            else:
                query = CollaborationTask.query.filter(CollaborationTask.id == -1)  # 返回空结果
        else:
            # 获取所有相关任务
            created_query = CollaborationTask.query.filter_by(created_by=current_user.id)
            assignment_query = CollaborationTaskAssignment.query.filter_by(assigned_to=current_user.id)
            assigned_task_ids = [assignment.task_id for assignment in assignment_query]
            
            if assigned_task_ids:
                query = created_query.union(
                    CollaborationTask.query.filter(CollaborationTask.id.in_(assigned_task_ids))
                )
            else:
                query = created_query
        
        # 状态过滤
        if status:
            query = query.filter_by(status=status)
        
        query = query.order_by(CollaborationTask.created_at.desc())
        
        # 分页
        pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        tasks = []
        for task in pagination.items:
            task_data = task.to_dict(include_progress=True)
            
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
            
            tasks.append(task_data)
        
        return jsonify(create_response(
            success=True,
            data={
                'tasks': tasks,
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
            error={'code': 'INTERNAL_ERROR', 'message': f'获取协作任务列表失败: {str(e)}'}
        )), 500

@collaboration_task_bp.route('/collaboration-tasks', methods=['POST'])
@admin_required
def create_collaboration_task(current_user):
    """创建协作任务"""
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
        deadline_str = request.form.get('deadline')
        
        if not title:
            return jsonify(create_response(
                success=False,
                error={'code': 'MISSING_FIELDS', 'message': '任务标题不能为空'}
            )), 400
        
        # 解析截止时间
        deadline = None
        if deadline_str:
            try:
                deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
            except ValueError:
                return jsonify(create_response(
                    success=False,
                    error={'code': 'INVALID_DEADLINE', 'message': '截止时间格式错误'}
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
        
        # 创建协作任务
        task = CollaborationTask.create_task(
            title=title,
            description=description,
            original_filename=file_info['original_filename'],
            created_by=current_user.id,
            total_qa_pairs=len(qa_pairs),
            deadline=deadline
        )
        
        # 创建文件记录
        file_record = File.create_file(
            filename=file_info['filename'],
            original_filename=file_info['original_filename'],
            file_path=file_info['file_path'],
            file_size=file_info['file_size'],
            file_type=file_info['file_type'],
            uploaded_by=current_user.id
        )
        
        # 关联文件到任务
        task.file_id = file_record.id
        db.session.commit()
        
        # 创建QA对记录
        QAPair.create_from_jsonl_data(file_record.id, qa_pairs)
        
        current_app.logger.info(f"协作任务 {title} 创建成功，任务ID: {task.id}, QA对数量: {len(qa_pairs)}")
        return jsonify(create_response(
            success=True,
            data=task.to_dict(include_assignments=True),
            message='协作任务创建成功'
        )), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'创建协作任务失败: {str(e)}'}
        )), 500

@collaboration_task_bp.route('/collaboration-tasks/<int:task_id>', methods=['GET'])
@login_required
def get_collaboration_task(current_user, task_id):
    """获取协作任务详情"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        # 权限检查
        if not task.can_be_accessed_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        task_data = task.to_dict(include_assignments=True, include_progress=True)
        
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
            error={'code': 'INTERNAL_ERROR', 'message': f'获取协作任务详情失败: {str(e)}'}
        )), 500

@collaboration_task_bp.route('/collaboration-tasks/<int:task_id>/assign', methods=['POST'])
@admin_required
def assign_collaboration_task(current_user, task_id):
    """分配协作任务"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
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
        
        assignment_strategy = data.get('strategy', 'manual')  # 'average' or 'manual'
        selected_users = data.get('selected_users', [])
        selected_groups = data.get('selected_groups', [])
        include_admin = data.get('include_admin', False)
        admin_qa_count = data.get('admin_qa_count', 0)
        manual_assignments = data.get('manual_assignments', [])
        
        # 收集所有要分配的用户
        all_users = set()
        
        # 添加选中的单个用户
        for user_id in selected_users:
            user = User.query.get(user_id)
            if user and user.is_active:
                # 检查管理员是否可以管理该用户
                if current_user.is_super_admin() or user in current_user.get_manageable_users():
                    all_users.add(user)
        
        # 添加选中用户组的用户
        for group_id in selected_groups:
            group = UserGroup.query.get(group_id)
            if group:
                # 检查管理员是否可以管理该用户组
                if current_user.is_super_admin() or group in current_user.get_manageable_user_groups():
                    for user in group.users:
                        if user.is_active:
                            all_users.add(user)
        
        # 添加管理员自己（如果选择参与）
        if include_admin:
            all_users.add(current_user)
        
        all_users = list(all_users)
        
        if not all_users:
            return jsonify(create_response(
                success=False,
                error={'code': 'NO_USERS', 'message': '没有选择有效的用户'}
            )), 400
        
        # 删除现有分配
        CollaborationTaskAssignment.query.filter_by(task_id=task_id).delete()
        
        # 根据分配策略创建分配
        if assignment_strategy == 'average':
            # 平均分配
            total_qa_pairs = task.total_qa_pairs
            
            # 如果管理员参与，先分配给管理员
            if include_admin and admin_qa_count > 0:
                total_qa_pairs -= admin_qa_count
                all_users.remove(current_user)
                
                # 为管理员创建分配
                CollaborationTaskAssignment.create_assignment(
                    task_id=task_id,
                    assigned_to=current_user.id,
                    start_index=0,
                    end_index=admin_qa_count - 1
                )
                start_index = admin_qa_count
            else:
                start_index = 0
            
            # 为其他用户平均分配
            if all_users and total_qa_pairs > 0:
                base_count = total_qa_pairs // len(all_users)
                remainder = total_qa_pairs % len(all_users)
                
                for i, user in enumerate(all_users):
                    count = base_count + (1 if i < remainder else 0)
                    if count > 0:
                        CollaborationTaskAssignment.create_assignment(
                            task_id=task_id,
                            assigned_to=user.id,
                            start_index=start_index,
                            end_index=start_index + count - 1
                        )
                        start_index += count
        
        elif assignment_strategy == 'manual':
            # 手动分配
            total_assigned = 0
            
            for assignment_data in manual_assignments:
                user_id = assignment_data.get('user_id')
                start_idx = assignment_data.get('start_index')
                end_idx = assignment_data.get('end_index')
                
                if not all([user_id, start_idx is not None, end_idx is not None]):
                    return jsonify(create_response(
                        success=False,
                        error={'code': 'INVALID_ASSIGNMENT', 'message': '手动分配信息不完整'}
                    )), 400
                
                if start_idx < 0 or end_idx >= task.total_qa_pairs or start_idx > end_idx:
                    return jsonify(create_response(
                        success=False,
                        error={'code': 'INVALID_RANGE', 'message': f'分配范围无效: {start_idx}-{end_idx}'}
                    )), 400
                
                # 检查用户是否在允许的用户列表中
                user = User.query.get(user_id)
                if not user or user not in all_users:
                    return jsonify(create_response(
                        success=False,
                        error={'code': 'INVALID_USER', 'message': f'用户ID {user_id} 不在允许的分配列表中'}
                    )), 400
                
                CollaborationTaskAssignment.create_assignment(
                    task_id=task_id,
                    assigned_to=user_id,
                    start_index=start_idx,
                    end_index=end_idx
                )
                
                total_assigned += (end_idx - start_idx + 1)
            
            if total_assigned > task.total_qa_pairs:
                db.session.rollback()
                return jsonify(create_response(
                    success=False,
                    error={'code': 'OVER_ASSIGNMENT', 'message': '分配的QA对数量超过了总数量'}
                )), 400
        
        # 更新任务状态
        task.status = 'in_progress'
        db.session.commit()
        
        # 发送任务分配通知
        from src.routes.notification import send_task_assignment_notifications
        assignments = CollaborationTaskAssignment.query.filter_by(task_id=task_id).all()
        send_task_assignment_notifications(task, assignments)
        
        current_app.logger.info(f"协作任务 {task_id} 分配成功，分配给 {len(all_users)} 个用户")
        return jsonify(create_response(
            success=True,
            data=task.to_dict(include_assignments=True, include_progress=True),
            message='协作任务分配成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'分配协作任务失败: {str(e)}'}
        )), 500

@collaboration_task_bp.route('/collaboration-tasks/<int:task_id>/manageable-users', methods=['GET'])
@admin_required
def get_manageable_users_for_task(current_user, task_id):
    """获取可分配的用户和用户组"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        # 权限检查
        if not task.can_be_managed_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 获取可管理的用户和用户组
        if current_user.is_super_admin():
            # 超级管理员可以看到所有活跃用户和用户组
            users = User.query.filter_by(is_active=True, role='user').all()
            user_groups = UserGroup.query.filter_by(is_active=True).all()
        else:
            # 普通管理员只能看到关联的用户和用户组
            users = current_user.get_manageable_users()
            user_groups = current_user.get_manageable_user_groups()
        
        users_data = [
            {
                'id': user.id,
                'username': user.username,
                'display_name': user.display_name,
                'user_group_id': user.user_group_id,
                'user_group_name': user.user_group.name if user.user_group else None
            }
            for user in users
        ]
        
        groups_data = [
            {
                'id': group.id,
                'name': group.name,
                'description': group.description,
                'user_count': len(group.users)
            }
            for group in user_groups
        ]
        
        return jsonify(create_response(
            success=True,
            data={
                'users': users_data,
                'user_groups': groups_data
            }
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取可分配用户失败: {str(e)}'}
        )), 500

@collaboration_task_bp.route('/collaboration-tasks/<int:task_id>/qa-pairs', methods=['GET'])
@login_required
def get_collaboration_task_qa_pairs(current_user, task_id):
    """获取协作任务的QA对"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        # 权限检查
        if not task.can_be_accessed_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # 获取任务的文件
        if not task.file:
            return jsonify(create_response(
                success=False,
                error={'code': 'NO_FILE', 'message': '任务没有关联文件'}
            )), 400
        
        # 根据用户角色获取QA对
        if task.created_by == current_user.id:
            # 创建者可以查看所有QA对
            query = QAPair.query.filter_by(file_id=task.file.id, is_deleted=False)
        else:
            # 被分配用户只能查看自己负责的部分
            assignment = task.get_assignment_for_user(current_user.id)
            if assignment:
                query = QAPair.query.filter(
                    QAPair.file_id == task.file.id,
                    QAPair.index_in_file >= assignment.start_index,
                    QAPair.index_in_file <= assignment.end_index,
                    QAPair.is_deleted == False
                )
                
                # 如果用户开始查看任务，更新状态
                if assignment.status == 'pending':
                    assignment.start_work()
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
        
        # 添加分配信息
        assignment_info = None
        if task.created_by != current_user.id:
            assignment = task.get_assignment_for_user(current_user.id)
            if assignment:
                assignment_info = {
                    'start_index': assignment.start_index,
                    'end_index': assignment.end_index,
                    'qa_count': assignment.get_qa_count(),
                    'status': assignment.status
                }
        
        return jsonify(create_response(
            success=True,
            data={
                'qa_pairs': qa_pairs,
                'assignment_info': assignment_info,
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
            error={'code': 'INTERNAL_ERROR', 'message': f'获取协作任务QA对失败: {str(e)}'}
        )), 500

@collaboration_task_bp.route('/collaboration-tasks/<int:task_id>/submit', methods=['POST'])
@login_required
def submit_collaboration_task_assignment(current_user, task_id):
    """提交协作任务分配"""
    try:
        # 查找用户的任务分配
        assignment = CollaborationTaskAssignment.query.filter_by(
            task_id=task_id,
            assigned_to=current_user.id
        ).first()
        
        if not assignment:
            return jsonify(create_response(
                success=False,
                error={'code': 'NOT_FOUND', 'message': '未找到任务分配'}
            )), 404
        
        if assignment.status == 'completed':
            return jsonify(create_response(
                success=False,
                error={'code': 'ALREADY_COMPLETED', 'message': '任务已经提交'}
            )), 400
        
        # 提交任务
        assignment.submit()
        
        # 创建汇总记录
        from src.models.collaboration_task_summary import CollaborationTaskSummary
        summary_items = CollaborationTaskSummary.create_summary_from_assignment(assignment)
        
        return jsonify(create_response(
            success=True,
            data={
                'assignment': assignment.to_dict(),
                'summary_items_count': len(summary_items)
            },
            message='任务提交成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'任务提交失败: {str(e)}'}
        )), 500

@collaboration_task_bp.route('/collaboration-tasks/<int:task_id>/export', methods=['POST'])
@admin_required
def export_collaboration_task(current_user, task_id):
    """导出协作任务结果"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        # 权限检查（只有创建者可以导出完整任务）
        if not task.can_be_managed_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        data = request.get_json()
        export_type = data.get('type', 'jsonl') if data else 'jsonl'
        
        # 获取任务的文件
        if not task.file:
            return jsonify(create_response(
                success=False,
                error={'code': 'NO_FILE', 'message': '任务没有关联文件'}
            )), 400
        
        # 获取所有QA对（按索引排序）
        qa_pairs = QAPair.query.filter_by(
            file_id=task.file.id,
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
            
            # 添加编辑者信息作为注释
            if qa.edited_by:
                qa_data['_editor'] = qa.editor.display_name
                qa_data['_edited_at'] = qa.edited_at.isoformat() if qa.edited_at else None
            
            export_data.append(qa_data)
        
        # 创建导出文件
        export_filename = create_export_filename(
            task.original_filename,
            export_type,
            'collaboration_completed'
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
        
        return send_file(
            export_path,
            as_attachment=True,
            download_name=export_filename
        )
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'导出协作任务失败: {str(e)}'}
        )), 500

@collaboration_task_bp.route('/collaboration-tasks/<int:task_id>', methods=['DELETE'])
@admin_required
def delete_collaboration_task(current_user, task_id):
    """删除协作任务"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        # 权限检查
        if not task.can_be_managed_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 删除关联的文件
        if task.file:
            task.file.delete()
        
        # 删除任务（级联删除相关记录）
        db.session.delete(task)
        db.session.commit()
        
        current_app.logger.info(f"协作任务 {task_id} 删除成功")
        return jsonify(create_response(
            success=True,
            message='协作任务删除成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'删除协作任务失败: {str(e)}'}
        )), 500

