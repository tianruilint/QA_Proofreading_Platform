import React, { useState, useEffect } from 'react';
import { Search, User, Clock, FileText, Eye, ChevronDown, ChevronRight } from 'lucide-react';

export function TraceabilityView({ taskId, sessionId }) {
  const [traceabilityData, setTraceabilityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedQAPairs, setExpandedQAPairs] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadTraceabilityData();
  }, [taskId, sessionId]);

  const loadTraceabilityData = async () => {
    try {
      setLoading(true);
      const endpoint = taskId 
        ? `/api/v1/tasks/${taskId}/traceability`
        : `/api/v1/sessions/${sessionId}/traceability`;
      
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setTraceabilityData(data.data);
      } else {
        console.error('加载溯源数据失败');
      }
    } catch (error) {
      console.error('加载溯源数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleQAPairExpansion = (qaPairId) => {
    const newExpanded = new Set(expandedQAPairs);
    if (newExpanded.has(qaPairId)) {
      newExpanded.delete(qaPairId);
    } else {
      newExpanded.add(qaPairId);
    }
    setExpandedQAPairs(newExpanded);
  };

  const filteredQAPairs = traceabilityData?.qa_pairs_detail?.filter(qa => {
    const matchesSearch = !searchTerm || 
      qa.original_question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      qa.original_answer.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || qa.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载溯源数据中...</div>
      </div>
    );
  }

  if (!traceabilityData) {
    return (
      <div className="text-center text-gray-500 py-8">
        无法加载溯源数据
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {taskId ? '任务溯源信息' : '文件溯源信息'}
        </h1>
        <p className="text-gray-600">
          查看详细的校对历史和责任人信息
        </p>
      </div>

      {/* 基本信息 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">基本信息</h2>
        
        {taskId && traceabilityData.task_info && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-500">任务名称</label>
              <p className="text-gray-900">{traceabilityData.task_info.title}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">创建时间</label>
              <p className="text-gray-900">
                {new Date(traceabilityData.task_info.created_at).toLocaleString()}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">任务状态</label>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                traceabilityData.task_info.status === 'completed' 
                  ? 'bg-green-100 text-green-800'
                  : traceabilityData.task_info.status === 'in_progress'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {traceabilityData.task_info.status === 'completed' ? '已完成' :
                 traceabilityData.task_info.status === 'in_progress' ? '进行中' : '待开始'}
              </span>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">文件名</label>
              <p className="text-gray-900">{traceabilityData.task_info.original_filename}</p>
            </div>
          </div>
        )}

        {sessionId && traceabilityData.session_info && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-500">文件名</label>
              <p className="text-gray-900">{traceabilityData.session_info.original_filename}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">上传时间</label>
              <p className="text-gray-900">
                {new Date(traceabilityData.session_info.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* 任务分配信息 */}
        {traceabilityData.assignments && traceabilityData.assignments.length > 0 && (
          <div className="mt-4">
            <h3 className="text-md font-semibold mb-3">任务分配</h3>
            <div className="space-y-2">
              {traceabilityData.assignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                  <div className="flex items-center">
                    <User className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="font-medium">{assignment.user_info?.name}</span>
                    <span className="text-gray-500 ml-2">({assignment.role})</span>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    assignment.status === 'completed' 
                      ? 'bg-green-100 text-green-800'
                      : assignment.status === 'in_progress'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {assignment.status === 'completed' ? '已完成' :
                     assignment.status === 'in_progress' ? '进行中' : '已分配'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 统计信息 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">校对统计</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {traceabilityData.qa_pairs_summary.total}
            </div>
            <div className="text-sm text-gray-500">总计</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {traceabilityData.qa_pairs_summary.pending}
            </div>
            <div className="text-sm text-gray-500">待校对</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {traceabilityData.qa_pairs_summary.corrected}
            </div>
            <div className="text-sm text-gray-500">已校对</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {traceabilityData.qa_pairs_summary.approved}
            </div>
            <div className="text-sm text-gray-500">已审核</div>
          </div>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="搜索QA对内容..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">所有状态</option>
              <option value="pending">待校对</option>
              <option value="corrected">已校对</option>
              <option value="reviewed">已审核</option>
              <option value="approved">已批准</option>
            </select>
          </div>
        </div>
      </div>

      {/* QA对详细列表 */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">QA对详细信息</h2>
          <p className="text-sm text-gray-500 mt-1">
            显示 {filteredQAPairs.length} / {traceabilityData.qa_pairs_detail.length} 个QA对
          </p>
        </div>
        
        <div className="divide-y divide-gray-200">
          {filteredQAPairs.map((qaPair, index) => (
            <QAPairTraceabilityItem
              key={qaPair.id}
              qaPair={qaPair}
              index={index}
              isExpanded={expandedQAPairs.has(qaPair.id)}
              onToggleExpansion={() => toggleQAPairExpansion(qaPair.id)}
            />
          ))}
          
          {filteredQAPairs.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              没有找到匹配的QA对
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// QA对溯源项组件
function QAPairTraceabilityItem({ qaPair, index, isExpanded, onToggleExpansion }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'corrected': return 'bg-blue-100 text-blue-800';
      case 'reviewed': return 'bg-purple-100 text-purple-800';
      case 'approved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return '待校对';
      case 'corrected': return '已校对';
      case 'reviewed': return '已审核';
      case 'approved': return '已批准';
      default: return '未知';
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <button
              onClick={onToggleExpansion}
              className="flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 mr-1" />
              ) : (
                <ChevronRight className="w-4 h-4 mr-1" />
              )}
              QA对 #{index + 1}
            </button>
            <span className={`ml-3 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(qaPair.status)}`}>
              {getStatusText(qaPair.status)}
            </span>
          </div>
          
          <div className="text-sm text-gray-600 mb-2">
            <span className="font-medium">问题:</span> {qaPair.original_question.substring(0, 100)}
            {qaPair.original_question.length > 100 && '...'}
          </div>
          
          {qaPair.corrector_info && (
            <div className="flex items-center text-xs text-gray-500">
              <User className="w-3 h-3 mr-1" />
              校对人: {qaPair.corrector_info.name}
              {qaPair.corrector_info.user_group && (
                <span className="ml-1">({qaPair.corrector_info.user_group})</span>
              )}
              {qaPair.corrected_at && (
                <span className="ml-3 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {new Date(qaPair.corrected_at).toLocaleString()}
                </span>
              )}
            </div>
          )}
        </div>
        
        <button
          onClick={onToggleExpansion}
          className="ml-4 p-1 text-gray-400 hover:text-gray-600"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
      
      {isExpanded && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          {/* 原始内容 */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">原始内容</h4>
            <div className="bg-gray-50 p-3 rounded">
              <div className="mb-2">
                <span className="text-xs font-medium text-gray-500">问题:</span>
                <p className="text-sm text-gray-700 mt-1">{qaPair.original_question}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">答案:</span>
                <p className="text-sm text-gray-700 mt-1">{qaPair.original_answer}</p>
              </div>
            </div>
          </div>
          
          {/* 校对后内容 */}
          {(qaPair.corrected_question || qaPair.corrected_answer) && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">校对后内容</h4>
              <div className="bg-blue-50 p-3 rounded">
                {qaPair.corrected_question && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-gray-500">问题:</span>
                    <p className="text-sm text-gray-700 mt-1">{qaPair.corrected_question}</p>
                  </div>
                )}
                {qaPair.corrected_answer && (
                  <div>
                    <span className="text-xs font-medium text-gray-500">答案:</span>
                    <p className="text-sm text-gray-700 mt-1">{qaPair.corrected_answer}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 校对历史 */}
          {qaPair.correction_history && qaPair.correction_history.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">校对历史</h4>
              <div className="space-y-2">
                {qaPair.correction_history.map((history, historyIndex) => (
                  <div key={historyIndex} className="flex items-start bg-gray-50 p-3 rounded">
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">
                          {history.action === 'corrected' ? '校对' : '审核'}
                        </span>
                        <span className="text-sm text-gray-500 ml-2">
                          by {history.user_name}
                          {history.user_group && ` (${history.user_group})`}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(history.timestamp).toLocaleString()}
                      </div>
                      
                      {history.changes && (
                        <div className="mt-2 text-xs">
                          {history.changes.question && (
                            <div className="mb-1">
                              <span className="font-medium text-gray-600">问题修改:</span>
                              <div className="text-red-600">- {history.changes.question.from}</div>
                              <div className="text-green-600">+ {history.changes.question.to}</div>
                            </div>
                          )}
                          {history.changes.answer && (
                            <div>
                              <span className="font-medium text-gray-600">答案修改:</span>
                              <div className="text-red-600">- {history.changes.answer.from}</div>
                              <div className="text-green-600">+ {history.changes.answer.to}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

