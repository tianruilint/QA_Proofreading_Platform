from flask import Blueprint, request, jsonify, send_file, current_app
import os
import json
import uuid
from datetime import datetime
from src.models.single_file import SingleFileSession
from src.models.qa_pair import QAPair
from src.models.file import File
from src.models import db
from src.utils.auth import login_required, create_response
from src.utils.file_handler import (
    save_uploaded_file, parse_jsonl_file, export_to_jsonl, 
    export_to_excel, create_export_filename, validate_jsonl_content
)

file_management_bp = Blueprint('file_management', __name__)

@file_management_bp.route('/files/history', methods=['GET'])
@login_required
def get_file_history(current_user):
    """获取当前用户的文件历史记录"""
    try:
        # 管理员和超级管理员可以看到所有文件，普通用户只能看到自己上传的
        if current_user.is_admin():
             files_query = File.query.filter_by(is_deleted=False)
        else:
             files_query = File.query.filter_by(uploaded_by=current_user.id, is_deleted=False)
        
        # 按创建时间降序排序，并限制最多返回50条记录
        recent_files = files_query.order_by(File.created_at.desc()).limit(50).all()
        
        history = [file.to_dict() for file in recent_files]
        
        return jsonify(create_response(
            success=True,
            data=history
        ))
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取文件历史失败: {str(e)}'}
        )), 500


@file_management_bp.route('/files/upload', methods=['POST'])
@login_required
def upload_file(current_user):
    """上传文件"""
    try:
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
        
        # 创建文件记录
        file_record = File.create_file(
            filename=file_info['filename'],
            original_filename=file_info['original_filename'],
            file_path=file_info['file_path'],
            file_size=file_info['file_size'],
            file_type=file_info['file_type'],
            uploaded_by=current_user.id
        )
        
        # 创建QA对记录
        QAPair.create_from_jsonl_data(file_record.id, qa_pairs)
        
        current_app.logger.info(f"文件 {file.filename} 上传成功，文件ID: {file_record.id}, QA对数量: {len(qa_pairs)}")
        return jsonify(create_response(
            success=True,
            data={
                'file': file_record.to_dict(),
                'qa_count': len(qa_pairs)
            },
            message='文件上传成功'
        )), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'文件上传失败: {str(e)}'}
        )), 500

@file_management_bp.route('/files/<int:file_id>', methods=['GET'])
@login_required
def get_file(current_user, file_id):
    """获取文件详情"""
    try:
        file_record = File.get_or_404(file_id)
        
        # 权限检查
        if not file_record.can_be_accessed_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        return jsonify(create_response(
            success=True,
            data=file_record.to_dict(include_qa_pairs=True)
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取文件详情失败: {str(e)}'}
        )), 500

@file_management_bp.route('/files/<int:file_id>/rename', methods=['PUT'])
@login_required
def rename_file(current_user, file_id):
    """重命名文件"""
    try:
        file_record = File.get_or_404(file_id)
        
        # 权限检查
        if not file_record.can_be_accessed_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403

        data = request.get_json()
        new_name = data.get('new_name')

        if not new_name or len(new_name.strip()) == 0:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_REQUEST', 'message': '新名称不能为空'}
            )), 400

        file_record.original_filename = new_name.strip()
        db.session.commit()

        return jsonify(create_response(
            success=True,
            data=file_record.to_dict(),
            message='文件重命名成功'
        ))

    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'文件重命名失败: {str(e)}'}
        )), 500


@file_management_bp.route('/files/<int:file_id>/qa-pairs', methods=['GET'])
@login_required
def get_file_qa_pairs(current_user, file_id):
    """获取文件的QA对列表"""
    try:
        file_record = File.get_or_404(file_id)
        
        # 权限检查
        if not file_record.can_be_accessed_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        start_index = request.args.get('start_index', type=int)
        end_index = request.args.get('end_index', type=int)
        
        # 构建查询
        query = QAPair.query.filter_by(file_id=file_id, is_deleted=False)
        
        if start_index is not None:
            query = query.filter(QAPair.index_in_file >= start_index)
        
        if end_index is not None:
            query = query.filter(QAPair.index_in_file <= end_index)
        
        query = query.order_by(QAPair.index_in_file)
        
        # 分页
        pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        qa_pairs = [qa.to_dict(include_edit_history=True) for qa in pagination.items]
        
        current_app.logger.info(f"文件 {file_id} 的QA对列表获取成功，共 {pagination.total} 条")
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
            error={'code': 'INTERNAL_ERROR', 'message': f'获取QA对列表失败: {str(e)}'}
        )), 500

@file_management_bp.route('/files/<int:file_id>/qa-pairs/<int:qa_id>', methods=['PUT'])
@login_required
def update_qa_pair(current_user, file_id, qa_id):
    """更新QA对"""
    try:
        qa_pair = QAPair.get_or_404(qa_id)
        
        if qa_pair.file_id != file_id:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_REQUEST', 'message': 'QA对不属于指定文件'}
            )), 400
        
        if not qa_pair.can_be_edited_by(current_user):
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
        
        prompt = data.get('prompt')
        completion = data.get('completion')
        
        if prompt is None or completion is None:
            return jsonify(create_response(
                success=False,
                error={'code': 'MISSING_FIELDS', 'message': 'prompt和completion不能为空'}
            )), 400
        
        qa_pair.edit(prompt, completion, current_user.id)
        
        return jsonify(create_response(
            success=True,
            data=qa_pair.to_dict(include_edit_history=True),
            message='QA对更新成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'更新QA对失败: {str(e)}'}
        )), 500

@file_management_bp.route('/files/<int:file_id>/qa-pairs/<int:qa_id>', methods=['DELETE'])
@login_required
def delete_qa_pair(current_user, file_id, qa_id):
    """删除QA对"""
    try:
        qa_pair = QAPair.get_or_404(qa_id)
        
        if qa_pair.file_id != file_id:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_REQUEST', 'message': 'QA对不属于指定文件'}
            )), 400
        
        if not qa_pair.can_be_edited_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        qa_pair.soft_delete(current_user.id)
        
        return jsonify(create_response(
            success=True,
            message='QA对删除成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'删除QA对失败: {str(e)}'}
        )), 500

@file_management_bp.route('/files/<int:file_id>/export', methods=['POST'])
@login_required
def export_file(current_user, file_id):
    """导出文件"""
    try:
        file_record = File.get_or_404(file_id)
        
        if not file_record.can_be_accessed_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        data = request.get_json()
        export_type = data.get('type', 'jsonl') if data else 'jsonl'
        start_index = data.get('start_index') if data else None
        end_index = data.get('end_index') if data else None
        
        qa_pairs = QAPair.get_by_file_and_range(
            file_id=file_id,
            start_index=start_index,
            end_index=end_index,
            include_deleted=False
        )
        
        if not qa_pairs:
            return jsonify(create_response(
                success=False,
                error={'code': 'NO_DATA', 'message': '没有可导出的数据'}
            )), 400
        
        export_data = [
            {
                'prompt': qa.prompt,
                'completion': qa.completion
            }
            for qa in qa_pairs
        ]
        
        export_filename = create_export_filename(
            file_record.original_filename,
            export_type,
            'edited'
        )
        export_path = os.path.join(current_app.config['EXPORT_FOLDER'], export_filename)
        
        if export_type == 'excel':
            success, error = export_to_excel(export_data, export_path)
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
            error={'code': 'INTERNAL_ERROR', 'message': f'导出文件失败: {str(e)}'}
        )), 500

@file_management_bp.route('/files/<int:file_id>', methods=['DELETE'])
@login_required
def delete_file(current_user, file_id):
    """删除文件"""
    try:
        file_record = File.get_or_404(file_id)
        
        if not file_record.can_be_deleted_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 注意：这里我们只做软删除，不再删除物理文件
        # file_record.delete_physical_file() 
        
        # 软删除文件记录 (is_deleted = True)
        file_record.delete()
        
        return jsonify(create_response(
            success=True,
            message='文件删除成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'删除文件失败: {str(e)}'}
        )), 500

# 访客模式的路由保持不变...
# ... (省略了访客模式相关的路由代码)

