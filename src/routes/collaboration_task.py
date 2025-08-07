from flask import Blueprint, request, jsonify, send_file, current_app
import os
import json
from sqlalchemy import or_, func
from sqlalchemy.orm import joinedload
from datetime import datetime
from src.models.collaboration_task import CollaborationTask, CollaborationTaskAssignment
from src.models.collaboration_task_draft import CollaborationTaskDraft
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
from src.models.notification import Notification
from src.routes.notification import (
    send_task_assignment_notifications,
    send_task_completion_notification
)
from src.routes.notification import send_task_assignment_notifications, send_task_completion_notification

collaboration_task_bp = Blueprint('collaboration_task', __name__)

@collaboration_task_bp.route('/collaboration-tasks', methods=['GET'])
@login_required
def get_collaboration_tasks(current_user):
    """获取协作任务列表"""
    try:
        query = CollaborationTask.query.join(
            CollaborationTaskAssignment, 
            CollaborationTask.id == CollaborationTaskAssignment.task_id,
            isouter=True
        ).filter(
            or_(
                CollaborationTask.created_by == current_user.id,
                CollaborationTaskAssignment.assigned_to == current_user.id
            )
        ).distinct()
        
        query = query.order_by(CollaborationTask.created_at.desc())
        
        tasks_list = []
        for task in query.all():
            task_data = task.to_dict(include_progress=True)
            if task.created_by == current_user.id:
                task_data['user_role'] = 'creator'
            else:
                assignment = task.get_assignment_for_user(current_user.id)
                if assignment:
                    task_data['user_role'] = 'assignee'
                    task_data['assignment'] = assignment.to_dict()
                    task_data['user_assignment_status'] = assignment.status
            tasks_list.append(task_data)

        return jsonify(create_response(success=True, data={'tasks': tasks_list}))
    except Exception as e:
        current_app.logger.error(f"Error getting collaboration tasks: {e}")
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取协作任务列表失败: {str(e)}'}
        )), 500

# ... 其他路由保持不变 ...
@collaboration_task_bp.route('/collaboration-tasks', methods=['POST'])
@admin_required
def create_collaboration_task(current_user):
    if 'file' not in request.files:
        return jsonify(create_response(success=False, error={'code': 'NO_FILE', 'message': '没有选择文件'})), 400
    
    file = request.files['file']
    title = request.form.get('title')
    if not title or file.filename == '':
        return jsonify(create_response(success=False, error={'code': 'MISSING_FIELDS', 'message': '任务标题和文件不能为空'})), 400

    try:
        file_info, error = save_uploaded_file(file, current_app.config['UPLOAD_FOLDER'])
        if error:
            return jsonify(create_response(success=False, error={'code': 'UPLOAD_ERROR', 'message': error})), 400
        
        qa_pairs, parse_error = parse_jsonl_file(file_info['file_path'])
        if parse_error:
            os.remove(file_info['file_path'])
            return jsonify(create_response(success=False, error={'code': 'PARSE_ERROR', 'message': parse_error})), 400

        deadline_str = request.form.get('deadline')
        deadline_obj = None
        if deadline_str:
            try:
                deadline_obj = datetime.fromisoformat(deadline_str)
            except (ValueError, TypeError):
                return jsonify(create_response(success=False, error={'code': 'INVALID_DATE_FORMAT', 'message': '截止日期格式无效'})), 400

        task = CollaborationTask.create_task(
            title=title,
            description=request.form.get('description', ''),
            original_filename=file_info['original_filename'],
            created_by=current_user.id,
            total_qa_pairs=len(qa_pairs),
            deadline=deadline_obj
        )
        
        file_record = File.create_file(
            filename=file_info['filename'],
            original_filename=file_info['original_filename'],
            file_path=file_info['file_path'],
            file_size=file_info['file_size'],
            file_type=file_info['file_type'],
            uploaded_by=current_user.id
        )
        
        task.file_id = file_record.id
        db.session.commit()
        
        QAPair.create_from_jsonl_data(file_record.id, qa_pairs)
        
        return jsonify(create_response(success=True, data=task.to_dict(), message='协作任务创建成功')), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating collaboration task: {e}")
        return jsonify(create_response(success=False, error={'code': 'INTERNAL_ERROR', 'message': f'创建协作任务失败: {str(e)}'})), 500


@collaboration_task_bp.route('/collaboration-tasks/<int:task_id>/manageable-users', methods=['GET'])
@admin_required
def get_manageable_users_for_task(current_user, task_id):
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        
        if not task.can_be_managed_by(current_user):
            return jsonify(create_response(success=False, error={'code': 'FORBIDDEN', 'message': '权限不足'})), 403
        
        if current_user.is_super_admin():
            users = User.query.filter_by(is_active=True, role='user').all()
            user_groups = UserGroup.query.filter_by(is_active=True).all()
        else:
            users = current_user.get_manageable_users()
            user_groups = current_user.get_manageable_user_groups()
        
        users_data = [{'id': user.id, 'username': user.username, 'display_name': user.display_name, 'user_group_id': user.user_group_id} for user in users]
        
        groups_data = [{'id': group.id, 'name': group.name, 'user_count': len(group.members)} for group in user_groups]
        
        return jsonify(create_response(success=True, data={'users': users_data, 'user_groups': groups_data}))
    
    except Exception as e:
        current_app.logger.error(f"Error getting manageable users for task {task_id}: {e}")
        return jsonify(create_response(success=False, error={'code': 'INTERNAL_ERROR', 'message': f'获取可分配用户失败: {str(e)}'})), 500


@collaboration_task_bp.route('/collaboration-tasks/<int:task_id>/assign', methods=['POST'])
@admin_required
def assign_collaboration_task(current_user, task_id):
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        if not task.can_be_managed_by(current_user):
            return jsonify(create_response(success=False, error={'code': 'FORBIDDEN', 'message': '权限不足'})), 403
        if task.status != 'draft':
                 return jsonify(create_response(success=False, error={'code': 'TASK_NOT_DRAFT', 'message': '任务已被分配，无法重复操作'})), 400

        data = request.get_json()
        if not data:
            return jsonify(create_response(success=False, error={'code': 'INVALID_REQUEST', 'message': '请求数据格式错误'})), 400

        strategy = data.get('strategy')
        selected_user_ids = data.get('selected_users', [])
        
        CollaborationTaskAssignment.query.filter_by(task_id=task_id).delete()

        assignments = []
        current_index = 0
        total_qa = task.total_qa_pairs

        if strategy == 'average':
            user_ids_to_assign = list(set(selected_user_ids))
           

            remaining_qa = total_qa
            num_users = len(user_ids_to_assign)

            if num_users > 0:
                base_count = remaining_qa // num_users
                remainder = remaining_qa % num_users
                
                for i, user_id in enumerate(user_ids_to_assign):
                    count = base_count + (1 if i < remainder else 0)
                    if count > 0:
                        assignments.append({'user_id': user_id, 'start': current_index, 'end': current_index + count - 1})
                        current_index += count

        elif strategy == 'manual':
            manual_assignments = data.get('manual_assignments', [])
            if not manual_assignments:
                 return jsonify(create_response(success=False, error={'code': 'INVALID_INPUT', 'message': '自定义分配模式下需要提供分配详情'})), 400

            for assign_info in manual_assignments:
                user_id = assign_info.get('user_id')
                start_index = assign_info.get('start_index')
                end_index = assign_info.get('end_index')
                
                if user_id is None or start_index is None or end_index is None:
                    continue
                
                assignments.append({'user_id': user_id, 'start': start_index, 'end': end_index})
        
        else:
            return jsonify(create_response(success=False, error={'code': 'INVALID_STRATEGY', 'message': '无效的分配策略'})), 400

        for assign in assignments:
            assignment = CollaborationTaskAssignment(
                task_id=task_id,
                assigned_to=assign['user_id'],
                start_index=assign['start'],
                end_index=assign['end'],
                status='in_progress'
            )
            db.session.add(assignment)
        
        task.status = 'in_progress'
        db.session.commit()
        
        send_task_assignment_notifications(task, task.assignments)
        
        return jsonify(create_response(success=True, data=task.to_dict(include_assignments=True), message='任务分配成功'))

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error assigning task {task_id}: {e}")
        return jsonify(create_response(success=False, error={'code': 'INTERNAL_ERROR', 'message': f'分配任务失败: {str(e)}'})), 500


@collaboration_task_bp.route('/collaboration-tasks/<int:task_id>/editor-data', methods=['GET'])
@login_required
def get_editor_data(current_user, task_id):
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        assignment = task.get_assignment_for_user(current_user.id)

        if not assignment:
            return jsonify(create_response(success=False, error={'code': 'NOT_ASSIGNED', 'message': '您未被分配此任务'})), 403

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 5, type=int)

        deleted_drafts = CollaborationTaskDraft.query.filter_by(
            task_id=task_id,
            user_id=current_user.id,
            is_deleted=True
        ).with_entities(CollaborationTaskDraft.qa_pair_id).all()
        deleted_qa_ids = [d.qa_pair_id for d in deleted_drafts]

        paginated_qa_query = QAPair.query.filter(
            QAPair.file_id == task.file_id,
            QAPair.index_in_file.between(assignment.start_index, assignment.end_index),
            QAPair.id.notin_(deleted_qa_ids)
        ).order_by(QAPair.index_in_file)

        paginated_qa = paginated_qa_query.paginate(page=page, per_page=per_page, error_out=False)
        
        qa_ids_on_page = [qa.id for qa in paginated_qa.items]
        drafts = CollaborationTaskDraft.query.filter(
            CollaborationTaskDraft.task_id == task_id,
            CollaborationTaskDraft.user_id == current_user.id,
            CollaborationTaskDraft.qa_pair_id.in_(qa_ids_on_page),
            CollaborationTaskDraft.is_deleted == False
        ).all()
        drafts_map = {draft.qa_pair_id: draft for draft in drafts}

        qa_pairs_data = []
        for qa in paginated_qa.items:
            qa_dict = qa.to_dict()
            if qa.id in drafts_map:
                draft = drafts_map[qa.id]
                qa_dict['prompt'] = draft.draft_prompt
                qa_dict['completion'] = draft.draft_completion
                qa_dict['has_draft'] = True
            else:
                qa_dict['has_draft'] = False
            qa_pairs_data.append(qa_dict)

        assignment_info = assignment.to_dict()
        # if task.deadline and datetime.utcnow() > task.deadline and assignment.status != 'completed':
            # assignment_info['status'] = 'overdue'

        return jsonify(create_response(success=True, data={
            'qa_pairs': qa_pairs_data,
            'assignment_info': assignment_info,
            'task_info': {'deadline': task.deadline.isoformat() if task.deadline else None},
            'pagination': {
                'page': paginated_qa.page,
                'per_page': paginated_qa.per_page,
                'total': paginated_qa.total,
                'pages': paginated_qa.pages,
            }
        }))

    except AttributeError as e:
        current_app.logger.error(f"AttributeError in get_editor_data for task {task_id}: {e}")
        return jsonify(create_response(success=False, error={'code': 'INTERNAL_ERROR', 'message': f"获取QA对失败: 读取草稿属性时出错 - {str(e)}"})), 500
    except Exception as e:
        current_app.logger.error(f"Error getting editor data for task {task_id}: {e}")
        return jsonify(create_response(success=False, error={'code': 'INTERNAL_ERROR', 'message': f'获取QA对失败: {str(e)}'})), 500

@collaboration_task_bp.route('/collaboration-tasks/<int:task_id>/submit', methods=['POST'])
@login_required
def submit_assignment(current_user, task_id):
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        assignment = task.get_assignment_for_user(current_user.id)

        if not assignment:
            return jsonify(create_response(success=False, error={'code': 'NOT_ASSIGNED', 'message': '您未被分配此任务'})), 403
        
        if assignment.status == 'completed':
            return jsonify(create_response(success=False, error={'code': 'ALREADY_COMPLETED', 'message': '任务已提交，请勿重复操作'})), 400

        drafts = CollaborationTaskDraft.query.filter_by(task_id=task_id, user_id=current_user.id).all()

        for draft in drafts:
            qa_pair = QAPair.query.get(draft.qa_pair_id)
            if qa_pair:
                if draft.is_deleted:
                    qa_pair.soft_delete(deleted_by=current_user.id)
                else:
                    qa_pair.edit(
                        prompt=draft.draft_prompt,
                        completion=draft.draft_completion,
                        editor_id=current_user.id
                    )
        
        assignment.submit()
        db.session.commit()
        
        if assignment.check_completion_and_notify():
            db.session.refresh(assignment.task) 
            send_task_completion_notification(assignment.task)
   
        
        return jsonify(create_response(success=True, message="任务提交成功"))

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error submitting assignment for task {task_id} by user {current_user.id}: {e}")
        return jsonify(create_response(success=False, error={'code': 'INTERNAL_ERROR', 'message': f'提交失败: {str(e)}'})), 500


@collaboration_task_bp.route('/collaboration-tasks/<int:task_id>/qa-pairs/<int:qa_pair_id>', methods=['DELETE'])
@login_required
def delete_qa_pair_in_task(current_user, task_id, qa_pair_id):
    try:
        assignment = CollaborationTaskAssignment.query.filter_by(
            task_id=task_id, assigned_to=current_user.id
        ).first()
        if not assignment:
            return jsonify(create_response(success=False, error={'code': 'FORBIDDEN', 'message': '权限不足'})), 403

        qa_pair = QAPair.query.get_or_404(qa_pair_id)
        if not (assignment.start_index <= qa_pair.index_in_file <= assignment.end_index):
            return jsonify(create_response(success=False, error={'code': 'FORBIDDEN', 'message': 'QA对不在您的分配范围内'})), 403

        CollaborationTaskDraft.save_draft(
            task_id=task_id,
            user_id=current_user.id,
            qa_pair_id=qa_pair_id,
            prompt=qa_pair.prompt,
            completion=qa_pair.completion,
            is_deleted=True
        )
        return jsonify(create_response(success=True, message='QA对已标记为删除'))

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error marking QA pair for deletion: {e}")
        return jsonify(create_response(success=False, error={'code': 'INTERNAL_ERROR', 'message': f'标记删除失败: {str(e)}'})), 500

@collaboration_task_bp.route('/collaboration-tasks/<int:task_id>', methods=['DELETE'])
@admin_required
def delete_collaboration_task(current_user, task_id):
    """删除协作任务"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        if not task.can_be_managed_by(current_user):
            return jsonify(create_response(success=False, error={'code': 'FORBIDDEN', 'message': '权限不足'})), 403
        
        # BUG修复: 移除手动的草稿删除，因为模型的 cascade 规则会处理
        # CollaborationTaskDraft.query.filter_by(task_id=task_id).delete()

        if task.file:
            # 物理文件删除逻辑可以根据需要添加
            # if os.path.exists(task.file.file_path):
            #     os.remove(task.file.file_path)
            db.session.delete(task.file)

        db.session.delete(task)
        db.session.commit()
        
        return jsonify(create_response(success=True, message='协作任务删除成功'))
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting task {task_id}: {e}")
        return jsonify(create_response(success=False, error={'code': 'INTERNAL_ERROR', 'message': f'删除任务失败: {str(e)}'})), 500

@collaboration_task_bp.route('/collaboration-tasks/<int:task_id>/draft', methods=['POST'])
@login_required
def save_draft(current_user, task_id):
    # This entire function is new
    data = request.get_json()
    qa_pair_id = data.get('qa_pair_id')
    prompt = data.get('prompt')
    completion = data.get('completion')
    
    draft = CollaborationTaskDraft.save_draft(
        task_id=task_id,
        user_id=current_user.id,
        qa_pair_id=qa_pair_id,
        prompt=prompt,
        completion=completion
    )
    return jsonify(create_response(True, data=draft.to_dict(), message="草稿已保存"))
    
@collaboration_task_bp.route('/collaboration-tasks/<int:task_id>/summary-data', methods=['GET'])
@admin_required
def get_summary_data(current_user, task_id):
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        if not task.can_be_managed_by(current_user):
            return jsonify(create_response(success=False, error={'code': 'FORBIDDEN', 'message': '权限不足'})), 403

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 5, type=int)

        paginated_qa_query = QAPair.query.filter(
            QAPair.file_id == task.file_id,
            QAPair.is_deleted == False
        ).options(joinedload(QAPair.editor)).order_by(QAPair.index_in_file)
        
        paginated_qa = paginated_qa_query.paginate(page=page, per_page=per_page, error_out=False)
        summary_items = [qa.to_dict(include_edit_history=True) for qa in paginated_qa.items]

        participants = []
        for p in task.assignments:
            deleted_count = CollaborationTaskDraft.query.filter_by(
                task_id=task.id,
                user_id=p.assigned_to,
                is_deleted=True
            ).count()
            
            participants.append({
                'user_id': p.assignee.id,
                'user_name': p.assignee.display_name,
                'status': p.status,
                'qa_count': p.get_qa_count(),
                'completed_at': p.completed_at.isoformat() if p.completed_at else None,
                'deleted_count': deleted_count 
            })

        return jsonify(create_response(success=True, data={
            'summary_items': summary_items,
            'participants': participants,
            'progress_stats': task.get_progress(),
            'pagination': {
                'page': paginated_qa.page,
                'per_page': paginated_qa.per_page,
                'total': paginated_qa.total,
                'pages': paginated_qa.pages,
            }
        }))

    except Exception as e:
        current_app.logger.error(f"Error getting summary data for task {task_id}: {e}")
        return jsonify(create_response(success=False, error={'code': 'INTERNAL_ERROR', 'message': f'获取汇总数据失败: {str(e)}'})), 500
        
@collaboration_task_bp.route('/collaboration-tasks/<int:task_id>/export', methods=['GET'])
@login_required
def export_collaboration_task(current_user, task_id):
    """导出协作任务结果"""
    try:
        task = CollaborationTask.query.get_or_404(task_id)
        if not task.can_be_managed_by(current_user):
            return jsonify(create_response(False, error={'code': 'FORBIDDEN', 'message': '权限不足'})), 403
            
        # if task.status != 'completed':
            # return jsonify(create_response(False, error={'code': 'TASK_NOT_COMPLETED', 'message': '任务尚未完成，无法导出'})), 400

        export_format = request.args.get('format', 'jsonl').lower()
        # 只导出未被删除的 QA 对
        qa_pairs = QAPair.query.filter_by(file_id=task.file_id, is_deleted=False).order_by(QAPair.index_in_file).all()
        
        if not qa_pairs:
            return jsonify(create_response(False, error={'code': 'NO_DATA', 'message': '没有可导出的数据'})), 400

        filename = create_export_filename(task.original_filename, export_format, 'collaboration_edited')

        if export_format == 'excel':
            mem_file, mimetype = export_to_excel(qa_pairs)
            return send_file(mem_file, as_attachment=True, download_name=filename, mimetype=mimetype)
        else:
            mem_file, mimetype = export_to_jsonl(qa_pairs)
            return send_file(mem_file, as_attachment=True, download_name=filename, mimetype=mimetype)

    except Exception as e:
        current_app.logger.error(f"导出协作任务失败 (Task ID: {task_id}): {e}", exc_info=True)
        return jsonify(create_response(False, error={'code': 'INTERNAL_ERROR', 'message': f'任务导出失败: {str(e)}'})), 500

