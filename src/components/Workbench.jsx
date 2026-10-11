import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import StageDurationTag from './StageDurationTag.jsx';
import { PROJECT_STAGES, BOARD_OPPORTUNITY_STAGES, projects, opportunities, getProjectStatus, getMetrics, matchesFilters, matchesPeriod, TODAY, dateKey } from '../data.js';

const amount = value => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value || 0);
const metricAmount = value => value >= 10000 ? (value / 10000).toFixed(1).replace(/\.0$/, '') : amount(value);
const findProject = id => projects.find(item => item.id === id);
const projectOpportunities = id => opportunities.filter(item => item.projectId === id);
const isPending = item => item.status !== 'completed';
function Tag({ children, tone = 'blue' }) { return <span className={`badge ${tone}`}>{children}</span>; }
function SmallButton({ icon, label, onClick, disabled }) { return <button className="icon-button" aria-label={label} title={label} onClick={onClick} disabled={disabled}><Icon name={icon} size={16} /></button>; }

function useTransientScrollbars(container) {
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const timers = new Map();
    const onScroll = event => {
      const element = event.target;
      if (!(element instanceof HTMLElement) || !element.matches('.pipeline-scroll, .pipeline-cards, .side-task-list')) return;
      clearTimeout(timers.get(element));
      element.dataset.scrolling = 'true';
      timers.set(element, setTimeout(() => {
        delete element.dataset.scrolling;
        timers.delete(element);
      }, 700));
    };
    root.addEventListener('scroll', onScroll, true);
    return () => {
      root.removeEventListener('scroll', onScroll, true);
      timers.forEach((timer, element) => { clearTimeout(timer); delete element.dataset.scrolling; });
    };
  }, [container]);
}

export function Metrics({ filter }) {
  const period = filter.period;
  const metrics = getMetrics(period, filter.scope, filter);
  return <section className="panel metrics-section" aria-label="业务概览">
    <div className="section-heading"><h2>业务概览</h2></div>
    <div className="metric-cards">{[metrics.slice(0, 5), metrics.slice(5)].map((row, i) => <div className="metric-card-row" style={{ '--card-count': row.length }} key={i}>{row.map(metric => <article className="metric-card" key={metric.key}>
      <div className="metric-label"><span>{metric.label}</span><span className={`metric-icon ${metric.color}`}><Icon name={metric.icon} size={15} /></span></div>
      <div className="metric-value" title={`${metric.value}${metric.unit}`}>{metric.unit === '元' && <span className="currency">¥</span>}{metric.unit === '元' ? metricAmount(metric.value) : amount(metric.value)}{metric.unit === '元' ? metric.value >= 10000 && <small>万</small> : <small>{metric.unit}</small>}</div>
      <div className="metric-footer"><span>较上周期</span><span className={metric.change > 0 ? 'trend-up' : metric.change < 0 ? 'trend-down' : 'trend-flat'}>{metric.change === null ? '—' : `${metric.change > 0 ? '+' : ''}${metric.change}%`}</span></div>
    </article>)}</div>)}</div>
  </section>;
}

function DataField({ label, children }) { return <div className="record-field"><dt>{label}</dt><dd>{children || '—'}</dd></div>; }

function openCard(event, item, onOpen) {
  // 子操作和展开的商机保留自己的入口，不触发外层项目详情。
  if (event.defaultPrevented || event.target.closest('button, a, input, select, textarea') || event.target.closest('.business-card') !== event.currentTarget) return;
  onOpen(item);
}

function OpportunityCard({ item, onOpen, onLocate, nested = false }) {
  const project = findProject(item.projectId);
  return <article className={`business-card opportunity-card ${nested ? 'nested-card' : ''}`} data-opportunity-id={item.id} onClick={event => openCard(event, item, onOpen)}>
    <button className="record-name" onClick={() => onOpen(item)}>{item.name}</button>
    <div className="record-tags">{nested && <Tag tone={item.status === '已输单' ? 'red' : 'blue'}>{item.status}</Tag>}<StageDurationTag item={item} /></div>
    <dl className="record-fields">
      <DataField label="关联项目"><button className="record-project-link" onClick={() => onLocate(item.projectId)} title={`定位项目：${project?.name}`}><span>{project?.name}</span><Icon name="arrow" size={12} /></button></DataField>
      <DataField label="客户">{project?.customer}</DataField>
      <DataField label="方案经理">{item.solutionManager}</DataField>
      <DataField label="商机部门">{item.opportunityDepartment}</DataField>
      <DataField label="订单金额">{item.orderAmount == null ? '—' : `¥ ${amount(item.orderAmount)}`}</DataField>
      <DataField label="实收金额">{item.receivedAmount == null ? '—' : `¥ ${amount(item.receivedAmount)}`}</DataField>
      <DataField label="创建于"><time dateTime={item.createdAt}>{item.createdAt}</time></DataField>
    </dl>
  </article>;
}

function ProjectCard({ project, expanded, toggle, highlighted, onOpen, onLocate, onProject }) {
  const related = projectOpportunities(project.id);
  return <article className={`business-card project-card ${highlighted ? 'highlighted' : ''}`} data-project-id={project.id} onClick={event => openCard(event, project, onProject)}>
    <button className="record-name" onClick={() => onProject(project)}>{project.name}</button>
    <dl className="record-fields"><DataField label="客户">{project.customer}</DataField><DataField label="负责人">{project.pm}</DataField><DataField label="国家地区">{project.region}</DataField><DataField label="交付经理">{project.deliveryManager || project.owner}</DataField><DataField label="项目金额">¥ {amount(project.contribution)}</DataField><DataField label="实收金额">¥ {amount(project.collected)}</DataField><DataField label={project.designType === '暂无' ? '方案设计' : project.designType}>{project.designStatus === '暂无' ? '暂无' : <Tag tone={project.designStatus === '已设计' ? 'teal' : 'purple'}>{project.designStatus}</Tag>}</DataField></dl>
    <button className={`expand-opps ${expanded ? 'expanded' : ''}`} aria-expanded={expanded} onClick={() => toggle(project.id)}><span>关联商机 <b>{related.length}</b></span><Icon name="chevronDown" size={14} /></button>
    {expanded && <div className="project-children">{related.map(item => <OpportunityCard key={item.id} item={item} onOpen={onOpen} onLocate={onLocate} nested />)}</div>}
  </article>;
}

export function Board({ filter, onOpportunity, onProject, locateId, setLocateId, onLocate }) {
  const [mode, setMode] = useState('opportunity');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState([]);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [dragging, setDragging] = useState(false);
  const track = useRef(null);
  useTransientScrollbars(track);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const stages = mode === 'project' ? PROJECT_STAGES : BOARD_OPPORTUNITY_STAGES;
  const scopeItems = (mode === 'project' ? projects : opportunities.filter(item => BOARD_OPPORTUNITY_STAGES.includes(item.status))).filter(item => matchesFilters(item, filter) && matchesPeriod(item, filter.period));
  const items = scopeItems.filter(item => {
    const project = mode === 'project' ? item : findProject(item.projectId);
    return [project?.name, project?.customer].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase());
  });
  const toggle = id => setExpanded(old => old.includes(id) ? old.filter(value => value !== id) : [...old, id]);
  useEffect(() => { setQuery(''); track.current?.scrollTo({ left: 0 }); }, [filter.departmentId, filter.employeeId, filter.period]);
  useEffect(() => { if (locateId) { setMode('project'); setQuery(''); setExpanded(old => [...new Set([...old, locateId])]); } }, [locateId]);
  useEffect(() => { if (locateId && mode === 'project') { const frame = requestAnimationFrame(() => track.current?.querySelector(`[data-project-id="${locateId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })); return () => cancelAnimationFrame(frame); } }, [locateId, mode, query]);

  useEffect(() => {
    const scroller = track.current;
    if (!scroller) return;
    const updateEdges = () => {
      const next = { left: scroller.scrollLeft > 1, right: scroller.scrollLeft < scroller.scrollWidth - scroller.clientWidth - 1 };
      setEdges(previous => previous.left === next.left && previous.right === next.right ? previous : next);
    };
    // 仅阶段条把纵向滚轮映射为横向移动，卡片列表继续使用原本的纵向滚动。
    const onWheel = event => {
      if (!event.target.closest('.pipeline-step') || event.ctrlKey) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      const unit = event.deltaMode === 1 ? 24 : event.deltaMode === 2 ? scroller.clientWidth : 1;
      const next = Math.max(0, Math.min(scroller.scrollWidth - scroller.clientWidth, scroller.scrollLeft + delta * unit));
      if (Math.abs(next - scroller.scrollLeft) < 0.5) return;
      event.preventDefault();
      scroller.scrollLeft = next;
    };
    scroller.addEventListener('scroll', updateEdges, { passive: true });
    scroller.addEventListener('wheel', onWheel, { passive: false });
    const observer = new ResizeObserver(updateEdges);
    observer.observe(scroller);
    observer.observe(scroller.firstElementChild);
    updateEdges();
    return () => { observer.disconnect(); scroller.removeEventListener('scroll', updateEdges); scroller.removeEventListener('wheel', onWheel); };
  }, [mode]);

  const startDrag = event => {
    suppressClick.current = false;
    if (event.button !== 0 || event.pointerType === 'touch' || event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
    const scroller = track.current;
    // 保留原生滚动条拖动；其余区域先记录起点，超过阈值才接管手势。
    for (const element of [event.target.closest('.pipeline-cards'), scroller].filter(Boolean)) {
      const rect = element.getBoundingClientRect();
      if (event.clientX >= rect.left + element.clientLeft + element.clientWidth || event.clientY >= rect.top + element.clientTop + element.clientHeight) return;
    }
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: scroller.scrollLeft, moved: false };
  };
  const moveDrag = event => {
    const active = drag.current;
    if (!active || event.pointerId !== active.pointerId) return;
    const distance = event.clientX - active.x;
    const scroller = track.current;
    if (!active.moved) {
      if (Math.abs(distance) < 6 || Math.abs(distance) <= Math.abs(event.clientY - active.y)) return;
      active.moved = true;
      suppressClick.current = true;
      scroller.setPointerCapture(event.pointerId);
      scroller.focus({ preventScroll: true });
      setDragging(true);
    }
    event.preventDefault();
    scroller.scrollLeft = active.left - distance;
  };
  const cancelDragClick = event => {
    if (!suppressClick.current || event.detail === 0) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };
  const endDrag = event => {
    const active = drag.current, scroller = track.current;
    if (!active || event.pointerId !== active.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (scroller.hasPointerCapture(event.pointerId)) scroller.releasePointerCapture(event.pointerId);
    if (active.moved && event.type !== 'pointercancel') {
      const width = scroller.querySelector('.pipeline-column').getBoundingClientRect().width;
      const maximum = scroller.scrollWidth - scroller.clientWidth;
      const position = maximum - scroller.scrollLeft < width / 2 ? maximum : Math.round(scroller.scrollLeft / width) * width;
      scroller.scrollTo({ left: position, behavior: 'smooth' });
    }
  };
  const changeMode = value => { setMode(value); setLocateId(null); track.current?.scrollTo({ left: 0 }); };
  return <section className="panel board-panel" id="business-board">
    <div className="section-heading board-heading">
      <h2>项目商机</h2>
      <div className="board-tools">
        <label className="search-input"><Icon name="search" size={15} /><input aria-label="搜索项目名称和客户" placeholder="搜索项目名称和客户" value={query} onChange={event => { setQuery(event.target.value); setLocateId(null); track.current?.scrollTo({ left: 0 }); }} />{query && <button aria-label="清空搜索" onClick={() => setQuery('')}><Icon name="close" size={13} /></button>}</label>
        <div className="segmented" aria-label="看板视图"><button aria-pressed={mode === 'opportunity'} className={mode === 'opportunity' ? 'selected' : ''} onClick={() => changeMode('opportunity')}>商机视图</button><button aria-pressed={mode === 'project'} className={mode === 'project' ? 'selected' : ''} onClick={() => changeMode('project')}>项目视图</button></div>
      </div>
    </div>
    {locateId && <div className="locate-notice"><Icon name="target" size={14} />{findProject(locateId)?.name}<button onClick={() => setLocateId(null)}>取消定位</button></div>}
    <div className={`pipeline-viewport ${edges.left ? 'has-left' : ''} ${edges.right ? 'has-right' : ''}`}>
      <div className={`pipeline-scroll ${dragging ? 'is-dragging' : ''}`} ref={track} tabIndex={0} aria-label={`${mode === 'project' ? '项目' : '商机'}阶段进度图`} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClickCapture={cancelDragClick} onPointerLeave={() => { if (!drag.current?.moved) drag.current = null; }} onLostPointerCapture={() => { drag.current = null; setDragging(false); }}>
        <div className="pipeline-grid" style={{ '--stage-count': stages.length, '--visible-stages': Math.min(stages.length, 4.5) }}>{stages.map(stage => {
          const records = items.filter(item => (mode === 'project' ? getProjectStatus(item) : item.status) === stage);
          return <section className={`pipeline-column ${stage === '已输单' ? 'loss-stage' : ''}`} key={stage}>
            <div className="pipeline-step" title="按住拖动，或滚动滚轮横向浏览"><span className="step-name">{stage}</span><span className="step-total">{records.length}</span></div>
            <div className="pipeline-cards">{records.map(item => mode === 'project' ? <ProjectCard key={item.id} project={item} expanded={expanded.includes(item.id)} toggle={toggle} highlighted={locateId === item.id} onOpen={onOpportunity} onLocate={onLocate} onProject={onProject} /> : <OpportunityCard key={item.id} item={item} onOpen={onOpportunity} onLocate={onLocate} />)}</div>
          </section>;
        })}</div>
      </div>
    </div>
  </section>;
}

export function Schedule({ tasks, selectedDate, setSelectedDate, onTask, focusRequest }) {
  const taskList = useRef(null);
  useTransientScrollbars(taskList);
  const initial = new Date(`${TODAY}T12:00:00+08:00`);
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [type, setType] = useState('全部');
  const [page, setPage] = useState(0);
  const [showCalendar, setShowCalendar] = useState(true);
  const year = month.getFullYear(), monthNumber = month.getMonth(), offset = (month.getDay() + 6) % 7;
  const totalDays = new Date(year, monthNumber + 1, 0).getDate();
  const dates = Array.from({ length: Math.ceil((offset + totalDays) / 7) * 7 }, (_, i) => { const date = new Date(year, monthNumber, i - offset + 1, 12); return { key: dateKey(date), day: date.getDate(), current: date.getMonth() === monthNumber }; });
  const unfinished = tasks.filter(isPending);
  const datesWithTasks = new Set(unfinished.map(item => item.date));
  const base = unfinished.filter(item => item.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  const filtered = base.filter(item => type === '全部' || item.type === type);
  const maxPage = Math.max(0, Math.ceil(filtered.length / 5) - 1), currentPage = Math.min(page, maxPage);
  useEffect(() => { if (focusRequest) { const current = new Date(`${TODAY}T12:00:00`); setMonth(new Date(current.getFullYear(), current.getMonth(), 1)); setSelectedDate(TODAY); setType('全部'); setPage(0); } }, [focusRequest, setSelectedDate]);
  const chooseDate = key => { const chosen = new Date(`${key}T12:00:00`); setMonth(new Date(chosen.getFullYear(), chosen.getMonth(), 1)); setSelectedDate(key); setPage(0); };
  const today = () => { chooseDate(TODAY); setMonth(new Date(initial.getFullYear(), initial.getMonth(), 1)); };
  return <aside className="schedule-panel" aria-label="我的日历与待办中心">
    <section className="panel calendar-panel" aria-label="我的日历">
    <div className="section-heading"><h2>我的日历</h2><div className="calendar-actions"><button className="text-button" onClick={today}>今天</button><button className={`icon-button ${showCalendar ? 'calendar-collapse' : ''}`} aria-label={showCalendar ? '收起日历' : '展开日历'} aria-expanded={showCalendar} onClick={() => setShowCalendar(value => !value)}><Icon name="chevronDown" size={15} /></button></div></div>
    {showCalendar && <div className="calendar-block"><div className="calendar-month"><strong>{year}年{monthNumber + 1}月</strong><div><button className="icon-button previous" aria-label="上个月" onClick={() => setMonth(new Date(year, monthNumber - 1, 1))}><Icon name="chevron" size={15} /></button><SmallButton icon="chevron" label="下个月" onClick={() => setMonth(new Date(year, monthNumber + 1, 1))} /></div></div><div className="calendar-grid">{['一', '二', '三', '四', '五', '六', '日'].map(day => <span className="weekday" key={day}>{day}</span>)}{dates.map(date => <button key={date.key} aria-label={date.key} aria-pressed={date.key === selectedDate} className={`calendar-day ${date.current ? '' : 'muted-day'} ${date.key === TODAY ? 'today' : ''} ${date.key === selectedDate ? 'chosen' : ''}`} onClick={() => chooseDate(date.key)}><span>{date.day}</span>{datesWithTasks.has(date.key) && <i />}</button>)}</div></div>}
    </section>
    <section className="panel daily-tasks" id="todo-panel" aria-label="待办中心"><div className="task-day-heading"><h2>待办中心<span>{base.length}</span></h2></div>
    <div className="task-tabs" role="tablist" aria-label="待办类型">{['全部', '跟进', '项目', '报价'].map(value => <button role="tab" aria-selected={value === type} className={value === type ? 'selected' : ''} key={value} onClick={() => { setType(value); setPage(0); }}>{value}待办<span>{base.filter(item => value === '全部' || item.type === value).length}</span></button>)}</div>
    <div className="side-task-list" ref={taskList}>{filtered.length ? filtered.slice(currentPage * 5, currentPage * 5 + 5).map(item => <button className="side-task" key={item.id} onClick={() => onTask(item)}><div className="side-task-meta"><Tag tone={item.type === '报价' ? 'purple' : item.type === '项目' ? 'teal' : 'blue'}>{item.type}</Tag><time className={item.date < TODAY ? 'overdue' : ''}>{item.date < TODAY ? '逾期 · ' : ''}{item.time}</time></div><strong>{item.title}</strong><div className="side-task-project">{findProject(item.projectId)?.name || '客户跟进'}</div><div className="side-task-owner"><span>{item.owner}</span><Icon name="chevron" size={13} /></div></button>) : <div className="side-task-empty"><Icon name="checkCircle" size={25} /><span>暂无{type === '全部' ? '' : type}待办</span></div>}</div>
    {filtered.length > 5 && <div className="task-pagination"><span>{currentPage * 5 + 1}–{Math.min((currentPage + 1) * 5, filtered.length)} / {filtered.length}</span><div><button className="icon-button previous" aria-label="待办上一页" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><Icon name="chevron" size={14} /></button><SmallButton icon="chevron" label="待办下一页" disabled={currentPage === maxPage} onClick={() => setPage(currentPage + 1)} /></div></div>}
    </section>
  </aside>;
}

export function Attention({ onDormant, onSchedule, onAnalysis, count }) {
  return <section className="panel utility-panel" aria-label="业务工具"><button onClick={onDormant}><Icon name="users" size={18} /><span>沉睡客户激活</span><b>{count}</b><Icon name="chevron" size={14} /></button><button onClick={onSchedule}><Icon name="clock" size={18} /><span>定时任务推送</span><Tag tone="slate">未启用</Tag><Icon name="chevron" size={14} /></button><button onClick={onAnalysis}><Icon name="chart" size={18} /><span>数据监测与分析</span><Icon name="chevron" size={14} /></button></section>;
}
