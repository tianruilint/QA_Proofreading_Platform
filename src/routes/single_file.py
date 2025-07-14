import os
import json
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
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
def upload_file():
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
        # 保存文件
        filename = secure_filename(file.filename)
        session_id = str(uuid.uuid4())
        file_path = os.path.join(Config.UPLOAD_FOLDER, f"{session_id}_{filename}")
        file.save(file_path)
        
        # 解析JSONL文件
        qa_pairs = []
        total_pairs = 0
        
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
                                'message': f'第{line_num}行格式错误：缺少question或answer字段'
                            }
                        }), 400
                    
                    qa_pairs.append({
                        'original_question': data['question'],
                        'original_answer': data['answer']
                    })
                    total_pairs += 1
                    
                except json.JSONDecodeError:
                    return jsonify({
                        'success': False,
                        'error': {
                            'code': 'INVALID_JSON',
                            'message': f'第{line_num}行JSON格式错误'
                        }
                    }), 400
        
        if total_pairs == 0:
            return jsonify({
                'success': False,
                'error': {
                    'code': 'EMPTY_FILE',
                    'message': '文件中没有有效的QA对'
                }
            }), 400
        
        # 创建会话
        session = SingleFileSession(
            id=session_id,
            file_path=file_path,
            original_filename=filename,
            total_pairs=total_pairs
        )
        db.session.add(session)
        
        # 创建QA对记录
        for qa_data in qa_pairs:
            qa_pair = QAPair(
                id=str(uuid.uuid4()),
                session_id=session_id,
                original_question=qa_data['original_question'],
                original_answer=qa_data['original_answer']
            )
            db.session.add(qa_pair)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {
                'session_id': session_id,
                'total_pairs': total_pairs,
                'filename': filename
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': {
                'code': 'UPLOAD_ERROR',
                'message': f'文件上传失败：{str(e)}'
            }
        }), 500

@single_file_bp.route('/single-file/<session_id>/qa-pairs', methods=['GET'])
@optional_login
def get_qa_pairs(session_id):
    """获取QA对列表"""
    session = SingleFileSession.query.get(session_id)
    if not session:
        return jsonify({
            'success': False,
            'error': {
                'code': 'SESSION_NOT_FOUND',
                'message': '会话不存在'
            }
        }), 404
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    
    qa_pairs = QAPair.query.filter_by(session_id=session_id).paginate(
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

@single_file_bp.route('/single-file/<session_id>/qa-pairs/<qa_id>', methods=['PUT'])
@optional_login
def update_qa_pair(session_id, qa_id):
    """更新QA对"""
    qa_pair = QAPair.query.filter_by(id=qa_id, session_id=session_id).first()
    if not qa_pair:
        return jsonify({
            'success': False,
            'error': {
                'code': 'QA_PAIR_NOT_FOUND',
                'message': 'QA对不存在'
            }
        }), 404
    
    data = request.get_json()
    if not data:
        return jsonify({
            'success': False,
            'error': {
                'code': 'INVALID_REQUEST',
                'message': '请求数据无效'
            }
        }), 400
    
    # 更新字段
    if 'corrected_question' in data:
        qa_pair.corrected_question = data['corrected_question']
    if 'corrected_answer' in data:
        qa_pair.corrected_answer = data['corrected_answer']
    
    qa_pair.status = 'corrected'
    qa_pair.corrected_at = datetime.utcnow()
    
    if request.current_user:
        qa_pair.corrected_by = request.current_user.id
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': {
            'qa_pair': qa_pair.to_dict()
        }
    })

@single_file_bp.route('/single-file/<session_id>/export', methods=['GET'])
@optional_login
def export_session(session_id):
    """导出校对结果"""
    session = SingleFileSession.query.get(session_id)
    if not session:
        return jsonify({
            'success': False,
            'error': {
                'code': 'SESSION_NOT_FOUND',
                'message': '会话不存在'
            }
        }), 404
    
    qa_pairs = QAPair.query.filter_by(session_id=session_id).all()
    
    # 生成导出数据
    export_data = []
    for qa in qa_pairs:
        export_data.append({
            'original_question': qa.original_question,
            'original_answer': qa.original_answer,
            'corrected_question': qa.corrected_question or qa.original_question,
            'corrected_answer': qa.corrected_answer or qa.original_answer,
            'status': qa.status
        })
    
    # 保存导出文件
    export_filename = f"export_{session_id}.jsonl"
    export_path = os.path.join(Config.EXPORT_FOLDER, export_filename)
    
    with open(export_path, 'w', encoding='utf-8') as f:
        for item in export_data:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    
    return jsonify({
        'success': True,
        'data': {
            'export_path': export_path,
            'filename': export_filename,
            'total_pairs': len(export_data)
        }
    })

