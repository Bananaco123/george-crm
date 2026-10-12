import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './components/Icon.jsx';
import { OPPORTUNITY_STAGES, ORG_TREE, EMPLOYEES, projects, opportunities, tasks as initialTasks, dormantCustomers, getProjectStatus, getProjectStats, getPeriodRange, matchesFilters, matchesPeriod, hydrateStoredTasks, TODAY } from './data.js';
import { Board, Schedule, Attention } from './components/Workbench.jsx';
import Metrics from './components/Metrics.jsx';
import DateRangeControl from './components/DateRangeControl.jsx';
import FilterDropdown from './components/FilterDropdown.jsx';
import DestinationPage from './components/DestinationPage.jsx';
import ProjectLevelTag from './components/ProjectLevelTag.jsx';
import { CRM_PAGES, readNavigation, navigationHash, metricDestination } from './navigation.js';
import ConversationPanel from './components/ConversationPanel.jsx';
import StageDurationTag from './components/StageDurationTag.jsx';
import { getRelatedConversations } from './conversations.js';

const OP_COLORS = ['slate', 'red', 'blue', 'purple', 'amber', 'teal', 'green', 'red'];
const money = n => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(n);
const getProject = id => projects.find(p => p.id === id);
const getOpps = id => opportunities.filter(o => o.projectId === id);
const pending = t => t.status !== 'completed';

function useStoredState(key, fallback) {
  const [state, setState] = useState(() => {
    try { const data = JSON.parse(localStorage.getItem(key)); return Array.isArray(data) ? hydrateStoredTasks(data) : fallback; } catch { return fallback; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* Private browsing may disable storage. */ } }, [key, state]);
  return [state, setState];
}

function IconButton({ name, label, onClick, ...props }) {
  return <button className="icon-button" aria-label={label} title={label} onClick={onClick} {...props}><Icon name={name} size={17} /></button>;
}

function Badge({ children, color = 'blue' }) { return <span className={`badge ${color}`}>{children}</span>; }

function Sidebar({ collapsed, setCollapsed, activePage, onNavigate }) {
  const [groups, setGroups] = useState({ customer: true, project: true, quote: true });
  const toggle = key => setGroups(prev => ({ ...prev, [key]: !prev[key] }));
  const child = page => <button key={page} className={`nav-child ${activePage === page ? 'active' : ''}`} aria-current={activePage === page ? 'page' : undefined} onClick={() => onNavigate(page)}><span>{CRM_PAGES[page]}</span><span className="nav-dot" /></button>;
  const group = (key, icon, label, children) => <div className="nav-group"><button aria-label={label} className="nav-parent" onClick={() => toggle(key)} aria-expanded={groups[key]} title={collapsed ? label : undefined}><Icon name={icon} size={19} /><span>{label}</span><Icon className={groups[key] ? 'chevron open' : 'chevron'} name="chevron" size={14} /></button>{!collapsed && groups[key] && <div className="nav-children">{children}</div>}</div>;
  return <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
    <div className="brand"><span className="brand-mark">G<span /></span>{!collapsed && <span>CRM</span>}</div>
    {!collapsed && <div className="nav-eyebrow">工作空间</div>}
    <nav aria-label="主导航">
      <button className={`nav-parent ${activePage === 'workbench' ? 'active' : ''}`} aria-current={activePage === 'workbench' ? 'page' : undefined} title="工作台" onClick={() => onNavigate('workbench')}><Icon name="dashboard" size={19} /><span>工作台</span>{activePage === 'workbench' && <span className="active-dot" />}</button>
      <button className={`nav-parent ${activePage === 'todos' ? 'active' : ''}`} aria-current={activePage === 'todos' ? 'page' : undefined} onClick={() => onNavigate('todos')}><Icon name="checkCircle" size={19} /><span>待办中心</span></button>
      <div className="nav-divider" />
      {group('customer', 'users', '客户管理', ['leads', 'customers'].map(child))}
      {group('project', 'folder', '项目管理', ['projects', 'opportunities', 'invitations', 'visits'].map(child))}
      {group('quote', 'file', '方案报价', ['quotes', 'catalog'].map(child))}
    </nav>
    <div className="sidebar-bottom">{!collapsed && <div className="workspace-status"><span /> 工作台已就绪</div>}<button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}><Icon name="menu" size={18} />{!collapsed && <span>收起导航</span>}</button></div>
  </aside>;
}

function Clock() {
  const [now, setNow] = useState(new Date());
  const [zone, setZone] = useState('Asia/Shanghai');
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  return <div className="global-clock"><Icon name="globe" size={15} /><select aria-label="时区" value={zone} onChange={e => setZone(e.target.value)}><option value="Asia/Shanghai">北京</option><option value="Asia/Dubai">迪拜</option><option value="Europe/London">伦敦</option><option value="America/New_York">纽约</option></select><time>{new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now)}</time></div>;
}

function Header({ onHelp, onNotifications, taskCount, page, onHome }) {
  return <header className="topbar"><div className="breadcrumb"><button onClick={onHome} aria-label="返回工作台"><Icon name="home" size={17} /></button><span>/</span><strong>{CRM_PAGES[page]}</strong></div><div className="topbar-right"><IconButton name="help" label="工作台使用说明" onClick={onHelp} /><button className="notification-button icon-button" title="待办提醒" aria-label="待办提醒" onClick={onNotifications}><Icon name="bell" size={19} />{taskCount > 0 && <span className="notification-dot" />}</button><span className="header-divider" /><div className="user-avatar">悦</div><span className="user-name">林悦<small>销售负责人</small></span></div></header>;
}

function Dialog({ title, children, onClose, wide = false, className = '' }) {
  const ref = useRef(null);
  useEffect(() => { const before = document.activeElement; const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; ref.current?.querySelector('button')?.focus(); const onKey = e => { if (e.key === 'Escape') onClose(); if (e.key === 'Tab') { const nodes = ref.current?.querySelectorAll('button:not([disabled]), input, select, [tabindex="0"]'); if (!nodes?.length) return; const first = nodes[0], last = nodes[nodes.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } }; document.addEventListener('keydown', onKey); return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', onKey); before?.focus(); }; }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section ref={ref} className={`dialog ${wide ? 'wide' : ''} ${className}`} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="dialog-heading"><div><h2 id="dialog-title">{title}</h2></div><IconButton name="close" label="关闭详情" onClick={onClose} /></div><div className="dialog-body">{children}</div></section></div>;
}

function RelatedConversations({ context, onOpen }) {
  const related = getRelatedConversations(context);
  return <section className="detail-conversations">
    <div className="detail-conversation-heading"><h3>关联会话 <span>{related.length}</span></h3><button className="secondary-button sales-assistant-button" onClick={() => onOpen(context, 'analysis')}><Icon name="sparkles" size={15} />AI 销冠</button></div>
    <div className="detail-conversation-list">{related.slice(0, 2).map(item => <button key={item.id} onClick={() => onOpen(context, 'conversation', item.id)}><span className="conversation-entry-icon"><Icon name={item.type === 'group' ? 'users' : 'user'} size={18} /></span><span><strong>{item.title}</strong><small>{item.channel} · {item.type === 'group' ? '项目群' : '客户私聊'}</small></span><Icon name="chevron" size={14} /></button>)}</div>
    {related.length > 2 && <button className="text-button conversation-view-all" onClick={() => onOpen(context, 'conversation')}>查看全部 {related.length} 个关联会话<Icon name="arrow" size={13} /></button>}
  </section>;
}

function ProjectDetail({ item, onOpportunity, onConversation }) {
  const related = getOpps(item.id), stats = getProjectStats(item);
  const fields = [['客户', item.customer], ['国家地区', item.region], ['负责人', item.pm], ['交付经理', item.deliveryManager], ['项目金额', `¥ ${money(item.contribution)}`], ['实收金额', `¥ ${money(item.collected)}`], ['创建日期', item.createdAt], [item.designType === '暂无' ? '方案设计' : item.designType, <Badge color={item.designStatus === '暂无' ? 'slate' : item.designStatus === '已设计' ? 'teal' : 'purple'}>{item.designStatus === '暂无' ? '未发起' : item.designStatus}</Badge>]];
  return <>
    <div className="detail-summary"><Badge>{getProjectStatus(item)}</Badge><ProjectLevelTag level={item.level} /><span>{item.id}</span></div>
    <div className="detail-fields">{fields.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <RelatedConversations context={{ kind: 'project', id: item.id }} onOpen={onConversation} />
    <h3 className="detail-section-title">关联商机 · 已报价 {stats.quoted} · 已成交 {stats.won}</h3>
    <div className="project-detail-opportunities">{related.map(opportunity => <button key={opportunity.id} onClick={() => onOpportunity(opportunity)}><span><strong>{opportunity.name}</strong><small>{opportunity.id} · {opportunity.solutionManager}</small></span><Badge color={OP_COLORS[OPPORTUNITY_STAGES.indexOf(opportunity.status)]}>{opportunity.status}</Badge><Icon name="chevron" size={13} /></button>)}</div>
  </>;
}

function OpportunityDetail({ item, onLocate, onProject, onConversation }) {
  const project = getProject(item.projectId);
  const route = ['洽谈中', '报价中', '待下单', '交付中', '已完成'];
  const fields = [
    ['客户', project.customer], ['方案经理', item.solutionManager],
    ['商机部门', item.opportunityDepartment], ['商机类型', item.opportunityType],
    ['订单金额', item.orderAmount == null ? '—' : `¥ ${money(item.orderAmount)}`], ['实收金额', item.receivedAmount == null ? '—' : `¥ ${money(item.receivedAmount)}`],
    ['创建日期', item.createdAt], ['报价情况', item.quoted ? '已创建报价' : '暂未报价'],
  ];
  return <>
    <div className="detail-summary"><ProjectLevelTag level={project.level} /><Badge color={OP_COLORS[OPPORTUNITY_STAGES.indexOf(item.status)]}>{item.status}</Badge><span>{item.id}</span><StageDurationTag item={item} /></div>
    <div className="detail-fields">{fields.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <h3 className="detail-section-title">商机进展</h3>
    <div className="stage-timeline">{route.map((stage, i) => <div key={stage} className={`${i <= route.indexOf(item.status) ? 'reached' : ''} ${stage === item.status ? 'current' : ''}`}><span>{i < route.indexOf(item.status) ? <Icon name="check" size={12} /> : i + 1}</span><small>{stage}</small></div>)}</div>
    {['待接受', '已拒绝', '已输单'].includes(item.status) && <p className="detail-note">当前状态：{item.status}。{item.status === '已输单' ? '输单后不可恢复，不自动改变项目状态。' : '接受商机后进入洽谈中。'}</p>}
    <RelatedConversations context={{ kind: 'opportunity', id: item.id }} onOpen={onConversation} />
    <div className="related-project-heading"><h3 className="detail-section-title">所属项目</h3><button className="text-button" onClick={() => onLocate(project.id)}>看板定位</button></div>
    <button className="linked-project" onClick={() => onProject(project)}><span className="attention-icon blue"><Icon name="folder" size={21} /></span><span><strong>{project.name}</strong><small>{getProjectStatus(project)} · {getOpps(project.id).length} 个关联商机</small></span><span className="link-copy">查看详情 <Icon name="arrow" size={14} /></span></button>
    <div className="detail-fields compact"><div><span>设计类型</span><strong>{project.designType === '暂无' ? '方案设计' : project.designType}</strong></div><div><span>设计状态</span><strong><Badge color={project.designStatus === '暂无' ? 'slate' : project.designStatus === '已设计' ? 'teal' : 'purple'}>{project.designStatus === '暂无' ? '未发起' : project.designStatus}</Badge></strong></div></div>
  </>;
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [employeeId, setEmployeeId] = useState('all');
  const [departmentId, setDepartmentId] = useState('all');
  const [period, setPeriod] = useState('近30天');
  const [dateRange, setDateRange] = useState(() => getPeriodRange('近30天'));
  const [route, setRoute] = useState(() => readNavigation());
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [taskFocusRequest, setTaskFocusRequest] = useState(0);
  const [tasks, setTasks] = useStoredState(`george-crm-tasks-v1-${TODAY}`, initialTasks);
  const [dialog, setDialog] = useState(null);
  const [locateId, setLocateId] = useState(null);
  const [toast, setToast] = useState('');
  const closeDialog = React.useCallback(() => setDialog(null), []);
  const filter = useMemo(() => ({ scope: '全部数据', departmentId, employeeId, period, dateRange, tasks }), [departmentId, employeeId, period, dateRange, tasks]);
  const members = EMPLOYEES.filter(item => departmentId === 'all' || item.departmentId === departmentId);
  const todayCount = tasks.filter(item => pending(item) && item.date === TODAY).length;
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  const openProject = item => setDialog({ type: 'project', item });
  const openOpportunity = item => setDialog({ type: 'opportunity', item });
  const openConversation = (context, mode, conversationId) => setDialog({ type: 'conversation', context, mode, conversationId });
  useEffect(() => {
    const change = () => { setRoute(readNavigation()); setDialog(null); };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  const navigate = (page, conditions = {}) => {
    setDialog(null);
    window.location.hash = navigationHash(page, conditions);
    setRoute({ page, conditions });
    window.scrollTo({ top: 0 });
  };
  const navigateMetric = (metric, extra = {}) => {
    const destination = metricDestination(metric, filter, extra);
    navigate(destination.page, destination.conditions);
  };
  const changeDestinationConditions = conditions => {
    window.history.replaceState(null, '', navigationHash(route.page, conditions));
    setRoute({ page: route.page, conditions });
    setDialog(null);
  };
  const openDestinationRecord = row => {
    const kind = row.detailKind;
    const item = kind === 'opportunity' ? opportunities.find(item => item.id === row.opportunityId) : kind === 'task' ? tasks.find(item => item.id === row.taskId) : kind === 'project' ? getProject(row.projectId) : null;
    if (item) setDialog({ type: kind, item });
  };
  const navigateTask = item => navigate('todos', { taskId: item.id, date: item.date, taskType: item.type, name: item.title, owner: item.owner, status: item.status === 'completed' ? '已完成' : '待处理' });
  const locateProject = id => {
    setDialog(null);
    const project = getProject(id);
    if (project && !matchesPeriod(project, period, dateRange)) { setDialog({ type: 'project', item: project }); setToast('项目不在当前新建周期内，已打开项目详情'); return; }
    navigate('workbench');
    if (project && !matchesFilters(project, filter)) {
      if (employeeId !== 'all' && project.responsibleEmployeeId !== employeeId) setEmployeeId('all');
      if (departmentId !== 'all' && project.departmentId !== departmentId) setDepartmentId(project.departmentId);
      setToast('已切换数据范围并定位所属项目');
    }
    setLocateId(id);
    document.getElementById('business-board')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const addFollowup = customer => {
    if (tasks.some(item => item.customerId === customer.id && pending(item))) { setToast('该客户已有待跟进任务'); return; }
    setTasks(previous => [...previous, { id: `ACT-${customer.id}`, customerId: customer.id, title: `回访${customer.name}，确认近期采购计划`, type: '跟进', projectId: customer.projectId, owner: customer.owner, departmentId: customer.departmentId, responsibleEmployeeId: customer.responsibleEmployeeId, date: TODAY, time: '17:00', status: 'pending', description: `已 ${customer.days} 天未联系。沟通关注点：${customer.interest}。` }]);
    setSelectedDate(TODAY);
    setTaskFocusRequest(previous => previous + 1);
    setToast('已添加跟进待办，日历与待办列表已同步');
  };
  const showTodayTasks = () => {
    navigate('workbench');
    setTaskFocusRequest(previous => previous + 1);
    requestAnimationFrame(() => document.getElementById('todo-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };
  const destinationRecord = route.conditions.opportunityId ? opportunities.find(item => item.id === route.conditions.opportunityId) : route.conditions.taskId ? tasks.find(item => item.id === route.conditions.taskId) : route.conditions.projectId ? getProject(route.conditions.projectId) : null;
  const showDestinationDetail = destinationRecord ? () => setDialog({ type: route.conditions.opportunityId ? 'opportunity' : route.conditions.taskId ? 'task' : 'project', item: destinationRecord }) : null;
  const dialogTitle = dialog?.type === 'conversation' ? '关联会话与 AI 销冠' : ['opportunity', 'project'].includes(dialog?.type) ? dialog.item.name : dialog?.type === 'task' ? '待办详情' : dialog?.type === 'dormant' ? '沉睡客户激活' : dialog?.type === 'schedule' ? '定时任务推送' : dialog?.type === 'analysis' ? '数据监测与分析' : '工作台说明';
  return <div className={`app-shell ${collapsed ? 'sidebar-is-collapsed' : ''}`}>
    <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} activePage={route.page} onNavigate={page => navigate(page)} />
    <div className="app-main">
      <Header taskCount={todayCount} onHelp={() => setDialog({ type: 'help' })} onNotifications={showTodayTasks} page={route.page} onHome={() => navigate('workbench')} />
      <main className="workspace" style={{ display: route.page === 'workbench' ? undefined : 'none' }}>
        <div className="workbench-heading">
          <div className="workbench-heading-main">
            <div className="workbench-title"><h1>工作台</h1></div>
            <div className="workbench-filters">
              <DateRangeControl period={period} dateRange={dateRange} onChange={(value, range) => { setPeriod(value); if (range) setDateRange(range); setLocateId(null); }} />
              <FilterDropdown label="部门筛选" className="department-filter" value={departmentId} options={[{ value: 'all', label: '全部部门' }, ...ORG_TREE.map(department => ({ value: department.id, label: department.name }))]} onChange={id => { setDepartmentId(id); if (id !== 'all' && !EMPLOYEES.some(item => item.id === employeeId && item.departmentId === id)) setEmployeeId('all'); setLocateId(null); }} />
              <FilterDropdown label="成员筛选" className="member-filter" value={employeeId} options={[{ value: 'all', label: '全部成员' }, ...members.map(member => ({ value: member.id, label: member.name }))]} onChange={id => { setEmployeeId(id); setLocateId(null); }} />
            </div>
          </div>
          <div className="workbench-time"><Clock /></div>
        </div>
        <div className="workbench-columns">
          <div className="workbench-primary">
            <Metrics filter={filter} onNavigate={navigateMetric} />
            <Board filter={filter} onProject={openProject} onOpportunity={openOpportunity} locateId={locateId} setLocateId={setLocateId} onLocate={locateProject} />
            <Attention count={dormantCustomers.length} onDormant={() => setDialog({ type: 'dormant' })} onSchedule={() => setDialog({ type: 'schedule' })} onAnalysis={() => setDialog({ type: 'analysis' })} />
          </div>
          <Schedule tasks={tasks} selectedDate={selectedDate} setSelectedDate={setSelectedDate} onTask={navigateTask} focusRequest={taskFocusRequest} />
        </div>
        <footer className="workbench-footer">演示数据 · 金额单位：人民币</footer>
      </main>
      {route.page !== 'workbench' && <DestinationPage route={route} tasks={tasks} onBack={() => navigate('workbench')} onDetail={showDestinationDetail} onConditionsChange={changeDestinationConditions} onRecordDetail={openDestinationRecord} />}
    </div>
    {dialog && <Dialog title={dialogTitle} onClose={closeDialog} wide={['analysis', 'dormant'].includes(dialog.type)} className={dialog.type === 'conversation' ? 'conversation-dialog' : ''}>
      {dialog.type === 'opportunity' && <OpportunityDetail item={dialog.item} onLocate={locateProject} onProject={openProject} onConversation={openConversation} />}
      {dialog.type === 'project' && <ProjectDetail item={dialog.item} onOpportunity={openOpportunity} onConversation={openConversation} />}
      {dialog.type === 'conversation' && <ConversationPanel key={`${dialog.context.kind}-${dialog.context.id}`} context={dialog.context} initialMode={dialog.mode} initialConversationId={dialog.conversationId} onBack={() => setDialog({ type: dialog.context.kind, item: dialog.context.kind === 'project' ? getProject(dialog.context.id) : opportunities.find(item => item.id === dialog.context.id) })} />}
      {dialog.type === 'task' && <><Badge color={dialog.item.type === '报价' ? 'purple' : 'blue'}>{dialog.item.type}</Badge><h3 className="task-detail-title">{dialog.item.title}</h3><div className="detail-fields"><div><span>负责人</span><strong>{dialog.item.owner}</strong></div><div><span>计划时间 · 北京时间</span><strong>{dialog.item.date} {dialog.item.time}</strong></div><div><span>关联项目</span><strong>{getProject(dialog.item.projectId)?.name || '客户跟进'}</strong></div><div><span>任务状态</span><strong>{dialog.item.status === 'completed' ? '已完成' : dialog.item.date < TODAY ? '已逾期' : '待处理'}</strong></div></div><p className="task-description">{dialog.item.description}</p>{dialog.item.projectId && <button className="primary-button" onClick={() => locateProject(dialog.item.projectId)}>在看板中查看项目<Icon name="arrow" size={15} /></button>}</>}
      {dialog.type === 'dormant' && <><div className="dormant-list">{dormantCustomers.map(customer => { const added = tasks.some(item => item.customerId === customer.id && pending(item)); return <article key={customer.id}><div className="dormant-avatar">{customer.name.slice(0, 1)}</div><div><h3>{customer.name}<Badge color="amber">{customer.days} 天未联系</Badge></h3><p>{customer.company} · 负责人 {customer.owner}</p><small>关注：{customer.interest}</small></div><button className={added ? 'secondary-button' : 'primary-button'} disabled={added} onClick={() => addFollowup(customer)}>{added ? '已添加待办' : '添加跟进'}</button></article>; })}{!dormantCustomers.length && <p className="dialog-intro">当前范围暂无沉睡客户</p>}</div><p className="detail-note">添加后会出现在本地工作台的待办与日历中，不会向客户发送消息。</p></>}
      {dialog.type === 'schedule' && <>{[{ title: '今日待办摘要', time: '每个工作日 09:00', description: '当天的跟进、项目与报价待办' }, { title: '逾期待办提醒', time: '每个工作日 16:30', description: '尚未处理的逾期事项' }, { title: '沉睡客户回访', time: '每周一 10:00', description: '长期未联系的客户名单' }].map(item => <div className="schedule-row" key={item.title}><span className="attention-icon blue"><Icon name="clock" size={20} /></span><div><strong>{item.title}</strong><p>{item.time} · 北京时间</p><small>{item.description}</small></div><Badge color="slate">未启用</Badge></div>)}<div className="info-callout"><Icon name="bell" size={18} /><span>当前为提醒计划预览，实际推送需接入任务服务和通知渠道。</span></div></>}
      {dialog.type === 'analysis' && <><p className="dialog-intro">以下为全部演示数据的规则分析，尚未接入实时 AI 服务。</p><div className="insight-card"><Badge color="purple">报价推进</Badge><h3>{opportunities.filter(item => item.status === '报价中').length} 个商机处于报价中</h3><p>确认客户反馈与报价版本，明确下一次沟通时间。</p></div><div className="insight-card"><Badge color="amber">成交衔接</Badge><h3>{opportunities.filter(item => item.status === '待下单').length} 个商机等待下单</h3><p>报价确认后，需由 ERP 收款达到备货标准并确定生产，才进入交付中。</p></div><div className="insight-card"><Badge color="blue">跟进提醒</Badge><h3>{tasks.filter(item => pending(item) && item.date < TODAY).length} 项待办已逾期</h3><p>检查联系计划和业务进度，跟进尚未获得反馈的事项。</p></div></>}
      {dialog.type === 'help' && <><div className="help-list"><p><b>01</b><span><strong>部门与成员</strong>部门、成员与统计周期共同筛选业务概览和项目商机，项目商机按创建日期统计。右侧日历与待办保留独立的日期和类型筛选。</span></p><p><b>02</b><span><strong>项目商机</strong>切换商机视图或项目视图，按项目名称或客户搜索。看板整个内容区均可按住左右拖动，阶段条上也可使用滚轮横向浏览。单击卡片直接打开项目或商机详情，点击关联项目可在看板中定位。业务概览指标卡片携带筛选条件跳转至对应列表。</span></p><p><b>03</b><span><strong>日历与待办</strong>在我的日历中选择日期，查看当天待办；待办中心可切换全部待办、跟进待办、项目待办和报价待办。</span></p></div><div className="info-callout"><Icon name="help" size={18} /><span>工作台提供业务概览与看板，其他模块使用通用示例列表展示筛选结果。全部业务数据用于演示，未连接实际客户、订单或通知系统。</span></div></>}
    </Dialog>}
    {toast && <div className="toast" role="status"><Icon name="checkCircle" size={17} />{toast}</div>}
  </div>;
}
