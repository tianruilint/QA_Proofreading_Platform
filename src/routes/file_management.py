from flask import Blueprint, request, jsonify, send_file, current_app
import os
import json
import io
import openpyxl
from src.models.file import File
from src.models.qa_pair import QAPair
from src.models.collaboration_task import CollaborationTask
from src.models import db
from src.utils.auth import login_required, create_response
from src.utils.file_handler import (
    save_uploaded_file, parse_jsonl_file, create_export_filename
)

file_management_bp = Blueprint('file_management', __name__)

@file_management_bp.route('/files/history', methods=['GET'])
@login_required
def get_file_history(current_user):
    """获取当前用户的单文件校对历史记录"""
    try:
        collaboration_file_ids_q = db.session.query(CollaborationTask.file_id).filter(CollaborationTask.file_id.isnot(None))
        collaboration_file_ids = [item[0] for item in collaboration_file_ids_q.all()]

        query_filter = [
            File.is_deleted == False,
            ~File.id.in_(collaboration_file_ids),
            File.uploaded_by == current_user.id 
        ]

        recent_files = File.query.filter(*query_filter).order_by(File.created_at.desc()).limit(50).all()
        history = [file.to_dict() for file in recent_files]
        return jsonify(create_response(True, data=history))
    except Exception as e:
        current_app.logger.error(f"获取文件历史失败: {e}", exc_info=True)
        return jsonify(create_response(False, error={'code': 'INTERNAL_ERROR', 'message': f'获取文件历史失败: {str(e)}'})), 500

@file_management_bp.route('/files/upload', methods=['POST'])
@login_required
def upload_file(current_user):
    """上传文件（仅用于单文件校对）"""
    try:
        if 'file' not in request.files or not request.files['file'].filename:
            return jsonify(create_response(False, error={'code': 'NO_FILE', 'message': '没有选择文件'})), 400

        file = request.files['file']
        file_info, error = save_uploaded_file(file, current_app.config['UPLOAD_FOLDER'])
        if error:
            return jsonify(create_response(False, error={'code': 'UPLOAD_ERROR', 'message': error})), 400
        
        qa_pairs, parse_error = parse_jsonl_file(file_info['file_path'])
        if parse_error:
            os.remove(file_info['file_path'])
            return jsonify(create_response(False, error={'code': 'PARSE_ERROR', 'message': parse_error})), 400
        
        file_record = File.create_file(
            filename=file_info['filename'],
            original_filename=file_info['original_filename'],
            file_path=file_info['file_path'],
            file_size=file_info['file_size'],
            file_type=file_info['file_type'],
            uploaded_by=current_user.id
        )
        QAPair.create_from_jsonl_data(file_record.id, qa_pairs)
        
        current_app.logger.info(f"文件 {file.filename} 上传成功, ID: {file_record.id}")
        return jsonify(create_response(True, data={'file': file_record.to_dict(), 'qa_count': len(qa_pairs)}, message='文件上传成功')), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"文件上传异常: {e}", exc_info=True)
        return jsonify(create_response(False, error={'code': 'INTERNAL_ERROR', 'message': f'文件上传失败: {str(e)}'})), 500

# --- 导出功能的最终修复版本 ---
# 关键修复：将 methods 从 ['POST'] 修改为 ['GET']
@file_management_bp.route('/files/<int:file_id>/export', methods=['GET'])
@login_required
def export_file_get(current_user, file_id):
    """导出文件为JSONL或Excel（修复版）"""
    try:
        file_record = File.get_or_404(file_id)
        if not file_record.can_be_accessed_by(current_user):
            return jsonify(create_response(False, error={'code': 'FORBIDDEN', 'message': '权限不足'})), 403

        export_format = request.args.get('format', 'jsonl').lower()
        qa_pairs = QAPair.query.filter_by(file_id=file_id, is_deleted=False).order_by(QAPair.index_in_file).all()
        
        if not qa_pairs:
            return jsonify(create_response(False, error={'code': 'NO_DATA', 'message': '没有可导出的数据'})), 400

        export_data = [{'prompt': qa.prompt, 'completion': qa.completion} for qa in qa_pairs]
        filename = create_export_filename(file_record.original_filename, export_format, 'edited')

        if export_format == 'excel':
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "QA Pairs"
            ws.append(['prompt', 'completion'])
            for item in export_data:
                ws.append([item['prompt'], item['completion']])
            
            mem_file = io.BytesIO()
            wb.save(mem_file)
            mem_file.seek(0)
            mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        else: # 默认为 jsonl
            jsonl_content = '\n'.join([json.dumps(item, ensure_ascii=False) for item in export_data])
            mem_file = io.BytesIO(jsonl_content.encode('utf-8'))
            mimetype = 'application/jsonl'

        return send_file(mem_file, as_attachment=True, download_name=filename, mimetype=mimetype)

    except Exception as e:
        current_app.logger.error(f"导出文件失败 (File ID: {file_id}): {e}", exc_info=True)
        return jsonify(create_response(False, error={'code': 'INTERNAL_ERROR', 'message': f'导出文件失败: {str(e)}'})), 500

# --- 其他路由保持不变 ---

@file_management_bp.route('/files/<int:file_id>', methods=['GET'])
@login_required
def get_file(current_user, file_id):
    try:
        file_record = File.get_or_404(file_id)
        if not file_record.can_be_accessed_by(current_user):
            return jsonify(create_response(False, error={'code': 'FORBIDDEN', 'message': '权限不足'})), 403
        return jsonify(create_response(True, data=file_record.to_dict(include_qa_pairs=True)))
    except Exception as e:
        return jsonify(create_response(False, error={'code': 'INTERNAL_ERROR', 'message': f'获取文件详情失败: {str(e)}'})), 500

@file_management_bp.route('/files/<int:file_id>/rename', methods=['PUT'])
@login_required
def rename_file(current_user, file_id):
    try:
        file_record = File.get_or_404(file_id)
        if not file_record.can_be_accessed_by(current_user):
            return jsonify(create_response(False, error={'code': 'FORBIDDEN', 'message': '权限不足'})), 403
        data = request.get_json()
        new_name = data.get('new_name', '').strip()
        if not new_name:
            return jsonify(create_response(False, error={'code': 'INVALID_REQUEST', 'message': '新名称不能为空'})), 400
        file_record.original_filename = new_name
        db.session.commit()
        return jsonify(create_response(True, data=file_record.to_dict(), message='文件重命名成功'))
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(False, error={'code': 'INTERNAL_ERROR', 'message': f'文件重命名失败: {str(e)}'})), 500

@file_management_bp.route('/files/<int:file_id>/qa-pairs', methods=['GET'])
@login_required
def get_file_qa_pairs(current_user, file_id):
    try:
        file_record = File.get_or_404(file_id)
        if not file_record.can_be_accessed_by(current_user):
            return jsonify(create_response(False, error={'code': 'FORBIDDEN', 'message': '权限不足'})), 403
        qa_pairs = QAPair.query.filter_by(file_id=file_id, is_deleted=False).order_by(QAPair.index_in_file).all()
        return jsonify(create_response(True, data={'qa_pairs': [qa.to_dict(include_edit_history=True) for qa in qa_pairs]}))
    except Exception as e:
        return jsonify(create_response(False, error={'code': 'INTERNAL_ERROR', 'message': f'获取QA对列表失败: {str(e)}'})), 500

@file_management_bp.route('/files/<int:file_id>/qa-pairs/<int:qa_id>', methods=['PUT'])
@login_required
def update_qa_pair(current_user, file_id, qa_id):
    try:
        qa_pair = QAPair.get_or_404(qa_id)
        if qa_pair.file_id != file_id or not qa_pair.can_be_edited_by(current_user):
            return jsonify(create_response(False, error={'code': 'FORBIDDEN', 'message': '权限不足'})), 403
        data = request.get_json()
        if not data or 'prompt' not in data or 'completion' not in data:
            return jsonify(create_response(False, error={'code': 'MISSING_FIELDS', 'message': 'prompt和completion不能为空'})), 400
        qa_pair.edit(data['prompt'], data['completion'], current_user.id)
        return jsonify(create_response(True, data=qa_pair.to_dict(include_edit_history=True), message='QA对更新成功'))
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(False, error={'code': 'INTERNAL_ERROR', 'message': f'更新QA对失败: {str(e)}'})), 500

@file_management_bp.route('/files/<int:file_id>/qa-pairs/<int:qa_id>', methods=['DELETE'])
@login_required
def delete_qa_pair(current_user, file_id, qa_id):
    try:
        qa_pair = QAPair.get_or_404(qa_id)
        if qa_pair.file_id != file_id or not qa_pair.can_be_edited_by(current_user):
            return jsonify(create_response(False, error={'code': 'FORBIDDEN', 'message': '权限不足'})), 403
        qa_pair.soft_delete(current_user.id)
        return jsonify(create_response(True, message='QA对删除成功'))
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(False, error={'code': 'INTERNAL_ERROR', 'message': f'删除QA对失败: {str(e)}'})), 500

@file_management_bp.route('/files/<int:file_id>', methods=['DELETE'])
@login_required
def delete_file(current_user, file_id):
    try:
        file_record = File.get_or_404(file_id)
        if not file_record.can_be_deleted_by(current_user):
            return jsonify(create_response(False, error={'code': 'FORBIDDEN', 'message': '权限不足'})), 403
        file_record.delete()
        return jsonify(create_response(True, message='文件删除成功'))
    except Exception as e:
        db.session.rollback()
        return jsonify(create_response(False, error={'code': 'INTERNAL_ERROR', 'message': f'删除文件失败: {str(e)}'})), 500

