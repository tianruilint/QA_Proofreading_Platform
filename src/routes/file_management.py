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
        
        # 验证QA对属于指定文件
        if qa_pair.file_id != file_id:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_REQUEST', 'message': 'QA对不属于指定文件'}
            )), 400
        
        # 权限检查
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
        
        # 更新QA对
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
        
        # 验证QA对属于指定文件
        if qa_pair.file_id != file_id:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_REQUEST', 'message': 'QA对不属于指定文件'}
            )), 400
        
        # 权限检查
        if not qa_pair.can_be_edited_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 软删除QA对
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
        
        # 权限检查
        if not file_record.can_be_accessed_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        data = request.get_json()
        export_type = data.get('type', 'jsonl') if data else 'jsonl'
        start_index = data.get('start_index') if data else None
        end_index = data.get('end_index') if data else None
        
        # 获取QA对
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
        
        # 准备导出数据
        export_data = [
            {
                'prompt': qa.prompt,
                'completion': qa.completion
            }
            for qa in qa_pairs
        ]
        
        # 创建导出文件
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
        
        # 权限检查
        if not file_record.can_be_deleted_by(current_user):
            return jsonify(create_response(
                success=False,
                error={'code': 'FORBIDDEN', 'message': '权限不足'}
            )), 403
        
        # 删除物理文件
        file_record.delete_physical_file()
        
        # 删除数据库记录
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

# 访客模式文件会话管理
@file_management_bp.route('/guest-sessions', methods=['POST'])
def create_guest_session():
    """创建访客会话"""
    try:
        data = request.get_json()
        if not data:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_REQUEST', 'message': '请求数据格式错误'}
            )), 400
        
        filename = data.get('filename')
        file_data = data.get('file_data')
        
        if not filename or not file_data:
            return jsonify(create_response(
                success=False,
                error={'code': 'MISSING_FIELDS', 'message': '文件名和文件数据不能为空'}
            )), 400
        
        # 验证文件数据格式
        is_valid, error = validate_jsonl_content(file_data)
        if not is_valid:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_DATA', 'message': error}
            )), 400
        
        # 创建会话
        session_id = str(uuid.uuid4())
        session = SingleFileSession.create_session(
            session_id=session_id,
            filename=filename,
            file_data=json.dumps(file_data),
            is_guest_session=True
        )
        
        return jsonify(create_response(
            success=True,
            data={
                'session_id': session.id,
                'filename': session.filename,
                'qa_count': len(file_data)
            },
            message='访客会话创建成功'
        )), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'创建访客会话失败: {str(e)}'}
        )), 500

@file_management_bp.route("/guest-sessions/<session_id>", methods=["GET"])
def get_guest_session(session_id):
    """获取访客会话"""
    try:
        session = SingleFileSession.query.filter_by(session_id=session_id).first()
        if not session:
            return jsonify(create_response(
                success=False,
                error={'code': 'SESSION_NOT_FOUND', 'message': '会话不存在'}
            )), 404
        
        # 检查会话是否过期
        if session.is_expired():
            session.delete()
            return jsonify(create_response(
                success=False,
                error={'code': 'SESSION_EXPIRED', 'message': '会话已过期'}
            )), 410
        
        # 更新访问时间
        session.update_access_time()
        
        file_data = json.loads(session.file_data)
        
        return jsonify(create_response(
            success=True,
            data={
                'session_id': session.id,
                'filename': session.filename,
                'file_data': file_data,
                'qa_count': len(file_data)
            }
        ))
    
    except Exception as e:
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'获取访客会话失败: {str(e)}'}
        )), 500

@file_management_bp.route('/guest-sessions/<session_id>', methods=['PUT'])
def update_guest_session(session_id):
    """更新访客会话"""
    try:
        session = SingleFileSession.query.filter_by(session_id=session_id).first()
        if not session:
            return jsonify(create_response(
                success=False,
                error={'code': 'SESSION_NOT_FOUND', 'message': '会话不存在'}
            )), 404
        
        # 检查会话是否过期
        if session.is_expired():
            session.delete()
            return jsonify(create_response(
                success=False,
                error={'code': 'SESSION_EXPIRED', 'message': '会话已过期'}
            )), 410
        
        data = request.get_json()
        if not data:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_REQUEST', 'message': '请求数据格式错误'}
            )), 400
        
        file_data = data.get('file_data')
        if not file_data:
            return jsonify(create_response(
                success=False,
                error={'code': 'MISSING_FIELDS', 'message': '文件数据不能为空'}
            )), 400
        
        # 验证文件数据格式
        is_valid, error = validate_jsonl_content(file_data)
        if not is_valid:
            return jsonify(create_response(
                success=False,
                error={'code': 'INVALID_DATA', 'message': error}
            )), 400
        
        # 更新会话数据
        session.file_data = json.dumps(file_data)
        session.update_access_time()
        db.session.commit()
        
        return jsonify(create_response(
            success=True,
            data={
                'session_id': session.id,
                'filename': session.filename,
                'qa_count': len(file_data)
            },
            message='访客会话更新成功'
        ))
    
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(
            success=False,
            error={'code': 'INTERNAL_ERROR', 'message': f'更新访客会话失败: {str(e)}'}
        )), 500

@file_management_bp.route('/guest-sessions/<session_id>/export', methods=['POST'])
def export_guest_session(session_id):
    """导出访客会话"""
    try:
        session = SingleFileSession.query.filter_by(id=session_id).first()
        if not session:
            return jsonify(create_response(
                success=False,
                error={'code': 'SESSION_NOT_FOUND', 'message': '会话不存在'}
            )), 404
        
        # 检查会话是否过期
        if session.is_expired():
            session.delete()
            return jsonify(create_response(
                success=False,
                error={'code': 'SESSION_EXPIRED', 'message': '会话已过期'}
            )), 410
        
        data = request.get_json()
        export_type = data.get('type', 'jsonl') if data else 'jsonl'
        
        file_data = json.loads(session.file_data)
        
        # 创建导出文件
        export_filename = create_export_filename(
            session.filename,
            export_type,
            'guest_edited'
        )
        export_path = os.path.join(current_app.config['EXPORT_FOLDER'], export_filename)
        
        if export_type == 'excel':
            success, error = export_to_excel(file_data, export_path)
        else:
            success, error = export_to_jsonl(file_data, export_path)
        
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
            error={'code': 'INTERNAL_ERROR', 'message': f'导出访客会话失败: {str(e)}'}
        )), 500

