import os
import json
import uuid
import io
import openpyxl
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_file
from werkzeug.utils import secure_filename
from src.models import db
from src.models.single_file import SingleFileSession
from src.models.qa_pair import QAPair
from src.routes.auth import optional_login
from src.config import Config

# 创建蓝图
single_file_bp = Blueprint('single_file', __name__)

def allowed_file(filename):
    """检查文件类型是否允许"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in {'jsonl'}

@single_file_bp.route('/single-file/upload', methods=['POST'])
@optional_login
def upload_file(current_user):
    """上传JSONL文件"""
    if 'file' not in request.files:
        return jsonify({
            'success': False,
            'error': {
                'code': 'NO_FILE',
                'message': '没有文件被上传'
            }
        }), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({
            'success': False,
            'error': {
                'code': 'NO_FILE_SELECTED',
                'message': '没有选择文件'
            }
        }), 400
    
    if not allowed_file(file.filename):
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_FILE_TYPE',
                'message': '只支持JSONL文件'
            }
        }), 400
    
    try:
        # 为了避免文件名冲突和安全问题，生成一个唯一的文件名
        original_filename = secure_filename(file.filename)
        unique_id = uuid.uuid4().hex
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        new_filename = f"{os.path.splitext(original_filename)[0]}_{timestamp}_{unique_id}.jsonl"
        file_path = os.path.join(Config.UPLOAD_FOLDER, new_filename)
        file.seek(0) # 确保文件指针在开头
        file.save(file_path)
        
        # 解析JSONL文件并存入数据库
        qa_pairs_to_add = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    data = json.loads(line)
                    prompt = data.get('prompt') or data.get('question')
                    completion = data.get('completion') or data.get('answer')

                    if prompt is None or completion is None:
                         raise ValueError(f'第{line_num}行缺少 prompt/question 或 completion/answer 字段')

                    qa_pairs_to_add.append({
                        'prompt': prompt,
                        'completion': completion,
                        'index_in_file': line_num -1
                    })
                
                except (json.JSONDecodeError, ValueError) as e:
                    return jsonify({
                        'success': False,
                        'error': {
                            'code': 'INVALID_FORMAT',
                            'message': f'文件解析错误: {str(e)}'
                        }
                    }), 400
        
        if not qa_pairs_to_add:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'EMPTY_FILE',
                    'message': '文件中没有有效的QA对'
                }
            }), 400
            
        # 创建会话
        session = SingleFileSession(
            original_filename=original_filename,
            file_path=file_path,
            total_pairs=len(qa_pairs_to_add),
            created_by=current_user.id if current_user else None
        )
        db.session.add(session)
        db.session.flush() # 刷新以获取 session.id

        # 批量创建QA对记录
        for qa_data in qa_pairs_to_add:
            qa_pair = QAPair(
                session_id=session.id,
                prompt=qa_data['prompt'],
                completion=qa_data['completion'],
                original_prompt=qa_data['prompt'],
                original_completion=qa_data['completion'],
                index_in_file=qa_data['index_in_file']
            )
            db.session.add(qa_pair)
            
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {
                'file': session.to_dict()
            }
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"文件上传失败: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': {
                'code': 'UPLOAD_ERROR',
                'message': f'文件上传处理失败: {str(e)}'
            }
        }), 500

@single_file_bp.route('/single-file/<int:file_id>/qa-pairs', methods=['GET'])
@optional_login
def get_qa_pairs(current_user, file_id):
    """获取QA对列表"""
    session = SingleFileSession.query.get_or_404(file_id)
    
    # 权限检查 (可选，如果需要限制访问)
    # if session.created_by and (not current_user or session.created_by != current_user.id):
    #     return jsonify({'success': False, 'error': {'code': 'FORBIDDEN', 'message': '无权访问此文件'}}), 403
    
    qa_pairs = QAPair.query.filter_by(session_id=file_id).order_by(QAPair.index_in_file).all()
    
    return jsonify({
        'success': True,
        'data': {
            'qa_pairs': [qa.to_dict(user=current_user) for qa in qa_pairs]
        }
    })

@single_file_bp.route('/single-file/<int:file_id>/qa-pairs/<int:qa_id>', methods=['PUT'])
@optional_login
def update_qa_pair(current_user, file_id, qa_id):
    """更新QA对"""
    qa_pair = QAPair.query.filter_by(id=qa_id, session_id=file_id).first_or_404()
    
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': {'code': 'INVALID_REQUEST', 'message': '请求数据无效'}}), 400
    
    # 更新字段
    if 'prompt' in data:
        qa_pair.prompt = data['prompt']
    if 'completion' in data:
        qa_pair.completion = data['completion']
    
    qa_pair.edited_at = datetime.utcnow()
    
    if current_user:
        qa_pair.edited_by = current_user.id
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': {
            'qa_pair': qa_pair.to_dict(user=current_user)
        }
    })

@single_file_bp.route('/single-file/<int:file_id>/qa-pairs/<int:qa_id>', methods=['DELETE'])
@optional_login
def delete_qa_pair(current_user, file_id, qa_id):
    """删除QA对"""
    qa_pair = QAPair.query.filter_by(id=qa_id, session_id=file_id).first_or_404()
    
    db.session.delete(qa_pair)
    
    # 更新文件总数
    session = SingleFileSession.query.get(file_id)
    if session:
        session.total_pairs = QAPair.query.filter_by(session_id=file_id).count()

    db.session.commit()
    
    return jsonify({'success': True, 'message': 'QA对已删除'})


@single_file_bp.route('/single-file/<int:file_id>/export', methods=['GET'])
@optional_login
def export_session(current_user, file_id):
    """导出校对结果"""
    session = SingleFileSession.query.get_or_404(file_id)
    
    export_format = request.args.get('format', 'jsonl').lower()
    
    qa_pairs = QAPair.query.filter_by(session_id=file_id).order_by(QAPair.index_in_file).all()
    
    filename_base = os.path.splitext(session.original_filename)[0]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if export_format == 'jsonl':
        # 在内存中创建JSONL文件
        mem_file = io.StringIO()
        for qa in qa_pairs:
            line = json.dumps({
                "prompt": qa.prompt,
                "completion": qa.completion
            }, ensure_ascii=False)
            mem_file.write(line + '\n')
        
        mem_file.seek(0)
        
        # 转换为BytesIO以便send_file处理
        bytes_file = io.BytesIO(mem_file.read().encode('utf-8'))
        bytes_file.seek(0)

        filename = f"{filename_base}_edited_{timestamp}.jsonl"
        
        return send_file(
            bytes_file,
            mimetype='application/jsonl',
            as_attachment=True,
            download_name=filename
        )

    elif export_format == 'excel':
        # 在内存中创建Excel文件
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "QA对"
        ws.append(["prompt", "completion"]) # 写入表头

        for qa in qa_pairs:
            ws.append([qa.prompt, qa.completion])
        
        mem_file = io.BytesIO()
        wb.save(mem_file)
        mem_file.seek(0)

        filename = f"{filename_base}_edited_{timestamp}.xlsx"

        return send_file(
            mem_file,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )

    else:
        return jsonify({'success': False, 'error': {'code': 'INVALID_FORMAT', 'message': '不支持的导出格式'}}), 400


