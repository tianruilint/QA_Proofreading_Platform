import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { CollaborationTaskEditor } from './CollaborationTaskEditor';
import { CollaborationTaskSummary } from './CollaborationTaskSummary';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from './ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import {
  Plus, FileText, Users, Clock, CheckCircle, AlertCircle, Eye, Edit3, Trash2,
  Download, UserPlus, BarChart3, Calendar, User, Shield, Search
} from 'lucide-react';

function TaskCard({ task, user, onAssign, onSummary, onEdit, onDelete, onExport }) {
    const getStatusDisplay = (taskStatus, userAssignmentStatus) => {
        // BUG 3 修复: 如果是参与者且个人任务已完成，则优先显示“已完成”
        if (userAssignmentStatus === 'completed') {
            return { text: '已完成', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle };
        }
        
        switch (taskStatus) {
            case 'draft': return { text: '草稿', color: 'text-gray-600', bg: 'bg-gray-100', icon: FileText };
            case 'in_progress': return { text: '进行中', color: 'text-blue-600', bg: 'bg-blue-100', icon: Clock };
            case 'completed': return { text: '已完成', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle };
            case 'finalized': return { text: '已确认', color: 'text-purple-600', bg: 'bg-purple-100', icon: Shield };
            default: return { text: '未知', color: 'text-gray-600', bg: 'bg-gray-100', icon: AlertCircle };
        }
    };
    
    // BUG 3 修复: 传递个人任务状态
    const statusDisplay = getStatusDisplay(task.status, task.user_assignment_status);
    const StatusIcon = statusDisplay.icon;
    const userRole = task.created_by === user.id ? 'creator' : task.user_role;
    
    return (
        <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col hover:shadow-lg transition-shadow duration-300">
            <div className="flex-1">
                <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 pr-2">{task.title}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusDisplay.bg} ${statusDisplay.color} flex-shrink-0`}>
                        <StatusIcon className="w-3 h-3 mr-1.5" />
                        {statusDisplay.text}
                    </span>
                </div>
                {task.description && <p className="text-sm text-gray-600 mb-4 line-clamp-2">{task.description}</p>}
                <div className="space-y-2 text-sm text-gray-500 mb-4">
                    <div className="flex items-center"><FileText className="w-4 h-4 mr-2" />{task.total_qa_pairs} 个QA对</div>
                    {task.progress && <div className="flex items-center"><Users className="w-4 h-4 mr-2" />{task.progress.total_assignments || 0} 人参与</div>}
                    {task.deadline && <div className="flex items-center"><Calendar className="w-4 h-4 mr-2" />截止于 {new Date(task.deadline).toLocaleDateString()}</div>}
                </div>
                {task.progress && task.progress.total_assignments > 0 && (
                    <div>
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span>完成进度</span>
                            <span>{Math.round(task.progress.completion_rate * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${task.progress.completion_rate * 100}%` }}></div>
                        </div>
                    </div>
                )}
            </div>
            <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between items-center">
                <div className="text-xs text-gray-400">
                    {userRole === 'creator' && <span className="inline-flex items-center"><User className="w-3 h-3 mr-1"/>我创建的</span>}
                    {userRole === 'assignee' && <span className="inline-flex items-center"><User className="w-3 h-3 mr-1"/>分配给我</span>}
                </div>
                <div className="flex items-center space-x-1">
                    {userRole === 'creator' && (
                        <>
                            {task.status === 'draft' && <Button variant="ghost" size="icon" onClick={() => onAssign(task)} title="分配任务"><UserPlus className="w-4 h-4 text-blue-600" /></Button>}
                            {(task.status === 'in_progress' || task.status === 'completed') && <Button variant="ghost" size="icon" onClick={() => onSummary(task)} title="查看汇总"><BarChart3 className="w-4 h-4 text-purple-600" /></Button>}
                            {(task.status === 'in_progress' || task.status === 'completed') && <Button variant="ghost" size="icon" onClick={() => onExport(task.id)} title="导出结果"><Download className="w-4 h-4 text-green-600" /></Button>}
                            <Button variant="ghost" size="icon" onClick={() => onDelete(task.id)} title="删除任务"><Trash2 className="w-4 h-4 text-red-600" /></Button>
                        </>
                    )}
                    {userRole === 'assignee' && task.assignment && (
                        <>
                            {/* BUG 3 修复: 使用 user_assignment_status 判断按钮状态 */}
                            {task.user_assignment_status === 'completed' ? (
                                <Button variant="outline" size="sm" onClick={() => onEdit(task)}><Eye className="w-4 h-4 mr-2"/>已提交</Button>
                            ) : (
                                <Button size="sm" onClick={() => onEdit(task)}><Edit3 className="w-4 h-4 mr-2"/>开始任务</Button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ... The rest of the CollaborationTasks component remains unchanged ...
export function CollaborationTasks() {
    const { user } = useAuth();
    if (user && user.role === 'super_admin') {
        return null; // 或者返回一个提示信息
    }
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState('list');
    const [selectedTask, setSelectedTask] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const [createForm, setCreateForm] = useState({ title: '', description: '', deadline: '', file: null });
    const initialAssignForm = { strategy: 'average', selectedUsers: [], manualAssignments: {} };
    const [assignForm, setAssignForm] = useState(initialAssignForm);
    const [availableUsers, setAvailableUsers] = useState([]);
    const [availableGroups, setAvailableGroups] = useState([]);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const response = await apiClient.getCollaborationTasks();
            if (response.success) {
                setTasks(response.data.tasks || []);
            } else {
                toast.error(`获取任务列表失败: ${response.error.message}`);
            }
        } catch (error) {
            toast.error(`获取任务列表失败: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchTasks();
    }, [user]);

    const filteredTasks = tasks.filter(task => 
        (filterStatus === 'all' || task.status === filterStatus) &&
        (task.title.toLowerCase().includes(searchTerm.toLowerCase()) || (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    const handleCreateTask = async (e) => {
        e.preventDefault();
        if (!createForm.title || !createForm.file) {
            toast.error('请填写任务标题并选择文件');
            return;
        }
        const formData = new FormData();
        formData.append('title', createForm.title);
        formData.append('description', createForm.description);
        if (createForm.deadline) formData.append('deadline', createForm.deadline);
        formData.append('file', createForm.file);
        try {
            const response = await apiClient.createCollaborationTask(formData);
            if (response.success) {
                toast.success('协作任务创建成功');
                setShowCreateModal(false);
                setCreateForm({ title: '', description: '', deadline: '', file: null });
                const newTask = response.data;
                newTask.progress = { total_assignments: 0, completed_assignments: 0, completion_rate: 0 };
                setTasks(prevTasks => [newTask, ...prevTasks]);
            } else {
                toast.error(`创建任务失败: ${response.error.message || '未知错误'}`);
            }
        } catch (error) {
            toast.error(`创建任务失败: ${error.message}`);
        }
    };

    const openAssignModal = async (task) => {
        setSelectedTask(task);
        setAssignForm(initialAssignForm);
        try {
            const response = await apiClient.getManageableUsersForTask(task.id);
            if (response.success) {
                setAvailableUsers(response.data.users || []);
                setAvailableGroups(response.data.user_groups || []);
                setShowAssignModal(true);
            } else {
                toast.error(`获取可分配用户失败: ${response.error.message}`);
                setAvailableUsers([]);
                setAvailableGroups([]);
                setShowAssignModal(true);
            }
        } catch (error) {
            toast.error(`获取可分配用户失败: ${error.message}`);
        }
    };
    
    const handleAssignTask = async () => {
        if (!selectedTask) return;
        
        const validSelectedUserIds = assignForm.selectedUsers.filter(userId => 
            availableUsers.some(u => u.id === userId)
        );

        let assignmentData = {
            strategy: assignForm.strategy,
            selected_users: validSelectedUserIds,
            manual_assignments: []
        };
        
        if (assignForm.strategy === 'manual') {
            let currentIndex = 0;
            
            const usersToAssign = validSelectedUserIds.map(userId => ({
                id: userId,
                quantity: Number(assignForm.manualAssignments[userId]) || 0
            }));

            const assignmentsWithQuantity = usersToAssign.filter(a => a.quantity > 0);

            const totalToAssign = assignmentsWithQuantity.reduce((sum, a) => sum + a.quantity, 0);
            if (totalToAssign > selectedTask.total_qa_pairs) {
                toast.error(`分配总数 (${totalToAssign}) 不能超过任务总数 (${selectedTask.total_qa_pairs})。`);
                return;
            }

            assignmentData.manual_assignments = assignmentsWithQuantity.map(a => {
                const assignment = {
                    user_id: a.id,
                    start_index: currentIndex,
                    end_index: currentIndex + a.quantity - 1,
                };
                currentIndex += a.quantity;
                return assignment;
            });
            
            assignmentData.selected_users = assignmentsWithQuantity.map(a => a.id);
        }

        try {
            const response = await apiClient.assignCollaborationTask(selectedTask.id, assignmentData);
            if (response.success) {
                toast.success('任务分配成功');
                setShowAssignModal(false);
                const updatedTask = response.data;
                fetchTasks()
                window.dispatchEvent(new CustomEvent('refresh-notifications'));
            } else {
                toast.error(`任务分配失败: ${response.error.message}`);
            }
        } catch (error) {
            toast.error(`任务分配失败: ${error.message}`);
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (window.confirm('确定要删除这个协作任务吗？此操作不可撤销。')) {
            try {
                const response = await apiClient.deleteCollaborationTask(taskId);
                if (response.success) {
                    toast.success('任务删除成功');
                    fetchTasks();
                } else {
                    toast.error(`任务删除失败: ${response.error.message}`);
                }
            } catch (error) {
                toast.error(`任务删除失败: ${error.message}`);
            }
        }
    };

    const handleExportTask = async (taskId, type = 'jsonl') => {
        try {
            const blob = await apiClient.exportCollaborationTask(taskId, type);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `task_${taskId}_export.${type}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('任务导出成功');
        } catch (error) {
            toast.error(`任务导出失败: ${error.message}`);
        }
    };
    
    const backToTaskList = () => {
        setCurrentView('list');
        setSelectedTask(null);
        fetchTasks();
    };
    
    const remainingQaCount = useMemo(() => {
        if (assignForm.strategy !== 'manual' || !selectedTask) {
            return selectedTask?.total_qa_pairs || 0;
        }
        const totalAssigned = Object.values(assignForm.manualAssignments).reduce((sum, count) => sum + (Number(count) || 0), 0);
        return selectedTask.total_qa_pairs - totalAssigned;
    }, [assignForm.strategy, assignForm.manualAssignments, selectedTask]);


    if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

    if (currentView === 'editor') {
        return selectedTask ? <CollaborationTaskEditor task={selectedTask} onBack={backToTaskList} /> : null;
    }
    if (currentView === 'summary') {
       return selectedTask ? <CollaborationTaskSummary task={selectedTask} onBack={backToTaskList} /> : null;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">协作任务</h1>
                    <p className="text-sm text-gray-600 mt-1">管理和参与协作校对任务</p>
                </div>
                {user.role === 'admin' && (
                    <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                        <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />创建任务</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader><DialogTitle>创建协作任务</DialogTitle><DialogDescription>填写任务信息并上传QA对文件。</DialogDescription></DialogHeader>
                            <form onSubmit={handleCreateTask} className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="title" className="text-right">标题 *</Label><Input id="title" value={createForm.title} onChange={(e) => setCreateForm(p => ({ ...p, title: e.target.value }))} className="col-span-3" required /></div>
                                <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="description" className="text-right">描述</Label><Textarea id="description" value={createForm.description} onChange={(e) => setCreateForm(p => ({ ...p, description: e.target.value }))} className="col-span-3" /></div>
                                <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="deadline" className="text-right">截止时间</Label><Input id="deadline" type="datetime-local" value={createForm.deadline} onChange={(e) => setCreateForm(p => ({ ...p, deadline: e.target.value }))} className="col-span-3" /></div>
                                <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="file" className="text-right">文件 *</Label><Input id="file" type="file" accept=".jsonl" onChange={(e) => setCreateForm(p => ({ ...p, file: e.target.files[0] }))} className="col-span-3" required /></div>
                                <DialogFooter><Button type="submit">创建任务</Button></DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" /><Input placeholder="搜索任务标题..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="所有状态" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">所有状态</SelectItem><SelectItem value="draft">草稿</SelectItem><SelectItem value="in_progress">进行中</SelectItem><SelectItem value="completed">已完成</SelectItem><SelectItem value="finalized">已确认</SelectItem></SelectContent>
                </Select>
            </div>

            {filteredTasks.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredTasks.map((task) => (
                        <TaskCard key={task.id} task={task} user={user} onAssign={openAssignModal} onSummary={(t) => { setSelectedTask(t); setCurrentView('summary'); }} onEdit={(t) => { setSelectedTask(t); setCurrentView('editor'); }} onDelete={handleDeleteTask} onExport={handleExportTask} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16"><FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-800">没有找到任务</h3><p className="text-gray-500">请尝试调整过滤器或创建新任务。</p></div>
            )}
            
            <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
                <DialogContent className="sm:max-w-2xl">
                     <DialogHeader>
                         <DialogTitle>分配任务: {selectedTask?.title}</DialogTitle>
                         <DialogDescription>
                              为团队成员分配校对范围。共 {selectedTask?.total_qa_pairs || 0} 条QA对。
                             {assignForm.strategy === 'manual' && (
                                 <span className={`ml-4 font-semibold ${remainingQaCount < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                     剩余: {remainingQaCount}
                                 </span>
                             )}
                         </DialogDescription>
                     </DialogHeader>
                     <div className="max-h-[60vh] overflow-y-auto p-1 pr-4 space-y-6">
                         <div>
                             <Label>分配策略</Label>
                             <RadioGroup value={assignForm.strategy} onValueChange={(value) => setAssignForm(p => ({...p, strategy: value, manualAssignments: {}}))} className="mt-2 flex space-x-4">
                                 <div className="flex items-center space-x-2"><RadioGroupItem value="average" id="r-avg" /><Label htmlFor="r-avg">平均分配</Label></div>
                                 <div className="flex items-center space-x-2"><RadioGroupItem value="manual" id="r-manual" /><Label htmlFor="r-manual">自定义分配</Label></div>
                             </RadioGroup>
                         </div>

                         <div>
                             <Label>选择校对员</Label>
                             <Accordion type="multiple" className="w-full mt-2" collapsible>
                                 {availableGroups.map(group => {
                                     const groupUsers = availableUsers.filter(u => u.user_group_id === group.id);
                                     const groupUserIds = groupUsers.map(u => u.id);
                                     const isAllInGroupSelected = groupUsers.length > 0 && groupUserIds.every(id => assignForm.selectedUsers.includes(id));

                                     const handleGroupSelectToggle = (isChecked) => {
                                         if (isChecked) {
                                             setAssignForm(p => ({ ...p, selectedUsers: [...new Set([...p.selectedUsers, ...groupUserIds])] }));
                                         } else {
                                             setAssignForm(p => ({ ...p, selectedUsers: p.selectedUsers.filter(id => !groupUserIds.includes(id)) }));
                                         }
                                     };

                                     return (
                                         <AccordionItem value={`group-${group.id}`} key={group.id}>
                                             <AccordionTrigger>{group.name} ({group.user_count} 人)</AccordionTrigger>
                                             <AccordionContent>
                                                 {groupUsers.length > 0 ? (
                                                     <div className="space-y-3 p-2 max-h-48 overflow-y-auto">
                                                         <div className="flex items-center space-x-2 sticky top-0 bg-white z-10 py-1">
                                                             <Checkbox id={`g-all-${group.id}`} checked={isAllInGroupSelected} onCheckedChange={handleGroupSelectToggle} />
                                                             <Label htmlFor={`g-all-${group.id}`} className="font-semibold">全选/全不选</Label>
                                                         </div>
                                                         {groupUsers.map(u => {
                                                             const isChecked = assignForm.selectedUsers.includes(u.id);
                                                             return (
                                                                 <div key={u.id} className="flex items-center justify-between space-x-2 pl-6">
                                                                     <div className="flex items-center space-x-2 flex-1">
                                                                         <Checkbox 
                                                                             id={`u-${u.id}`} 
                                                                             checked={isChecked} 
                                                                             onCheckedChange={(checked) => {
                                                                                 setAssignForm(p => ({...p, selectedUsers: checked ? [...p.selectedUsers, u.id] : p.selectedUsers.filter(id => id !== u.id)}));
                                                                             }}
                                                                         />
                                                                         <Label htmlFor={`u-${u.id}`} className="font-normal truncate" title={`${u.display_name} (${u.username})`}>
                                                                             {u.display_name} ({u.username})
                                                                         </Label>
                                                                     </div>
                                                                     {assignForm.strategy === 'manual' && isChecked && (
                                                                         <Input 
                                                                             type="number" 
                                                                             placeholder="数量" 
                                                                             className="w-28 text-right" 
                                                                             value={assignForm.manualAssignments[u.id] || ''} 
                                                                             onChange={e => {
                                                                                 const val = e.target.value;
                                                                                 const newCount = val === '' ? 0 : parseInt(val, 10);
                                                                                 setAssignForm(p => ({...p, manualAssignments: {...p.manualAssignments, [u.id]: isNaN(newCount) ? 0 : newCount }}));
                                                                             }}
                                                                             min="0"
                                                                         />
                                                                     )}
                                                                 </div>
                                                             );
                                                         })}
                                                     </div>
                                                 ) : (
                                                     <div className="text-sm text-gray-500 p-2 pl-8">该用户组中没有可分配的用户。</div>
                                                 )}
                                             </AccordionContent>
                                         </AccordionItem>
                                     );
                                 })}
                             </Accordion>
                         </div>

                         


                     </div>
                     <DialogFooter>
                         <Button variant="outline" onClick={() => setShowAssignModal(false)}>取消</Button>
                         <Button onClick={handleAssignTask} disabled={assignForm.strategy === 'manual' && remainingQaCount < 0}>
                             {assignForm.strategy === 'manual' && remainingQaCount < 0 ? '分配数超额' : '确认分配'}
                         </Button>
                     </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

