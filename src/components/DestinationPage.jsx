import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import FilterDropdown from './FilterDropdown.jsx';
import ProjectLevelTag from './ProjectLevelTag.jsx';
import { CRM_PAGES } from '../navigation.js';
import { EMPLOYEES, ORG_TREE, getDepartmentIds } from '../data.js';
import { filterDestinationRows, getDestinationRows } from '../destinationData.js';
import '../destination-table.css';

const PAGE_SIZE = 8;
const money = value => value == null ? '—' : `¥ ${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
const departmentName = id => ORG_TREE.find(item => item.id === id)?.name ?? id;
const memberName = id => EMPLOYEES.find(item => item.id === id)?.name ?? id;
const names = { leads: '线索名称', customers: '客户名称', projects: '项目名称', opportunities: '商机名称', todos: '待办事项', invitations: '邀请函名称', visits: '到店安排', quotes: '报价名称', catalog: '商品名称' };
const statusTone = status => /输单|拒绝|逾期|取消/.test(status) ? 'muted-red' : /完成|全部成交|已到店|已收款/.test(status) ? 'green' : /交付|部分成交|待下单|已发送/.test(status) ? 'teal' : 'blue';

function selectedOptions(options, selected) {
  return selected && !options.some(item => item.value === selected) ? [...options, { value: selected, label: selected }] : options;
}

function conditionChips(conditions) {
  const chips = [];
  if (conditions.department && conditions.department !== 'all') chips.push({ keys: ['department'], label: '部门', value: departmentName(conditions.department) });
  if (conditions.member && conditions.member !== 'all') chips.push({ keys: ['member'], label: '成员', value: memberName(conditions.member) });
  if (conditions.query) chips.push({ keys: ['query'], label: '搜索', value: conditions.query });
  if (conditions.level || conditions.grade) chips.push({ keys: ['level', 'grade'], label: '等级', value: `${conditions.level || conditions.grade} 级` });
  if (conditions.status || conditions.stage) chips.push({ keys: ['status', 'stage'], label: '状态', value: conditions.status || conditions.stage });
  const labels = { recordType: '记录类型', taskType: '待办类型', projectId: '项目编号', opportunityId: '商机编号', taskId: '待办编号', date: '待办日期', name: '名称', owner: '负责人' };
  for (const [key, label] of Object.entries(labels)) if (conditions[key]) chips.push({ keys: [key], label, value: conditions[key] });
  return chips;
}

export default function DestinationPage({ route, onBack, onDetail, tasks, onConditionsChange, onRecordDetail }) {
  const conditions = route.conditions ?? {};
  const [pageNumber, setPageNumber] = useState(1);
  const [dateDraft, setDateDraft] = useState({ start: conditions.start ?? '', end: conditions.end ?? '' });
  const [dateError, setDateError] = useState('');
  const conditionSignature = JSON.stringify(conditions);
  const rows = useMemo(() => getDestinationRows(route.page, { tasks }), [route.page, tasks]);
  const filteredRows = useMemo(() => filterDestinationRows(rows, conditions), [rows, conditionSignature]);
  const chips = conditionChips(conditions);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(pageNumber, pageCount);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasAmount = ['projects', 'opportunities', 'quotes', 'catalog'].includes(route.page) || conditions.recordType === '投放消耗';
  const amountLabel = conditions.recordType === '已收款' ? '实收金额' : conditions.recordType === '成交业绩' ? '成交金额' : route.page === 'quotes' ? '报价金额' : route.page === 'opportunities' ? '订单金额' : route.page === 'projects' ? '项目金额' : '金额';
  const hasGrade = route.page !== 'catalog';
  const hasCustomer = route.page !== 'customers' && route.page !== 'catalog';
  const columns = 5 + Number(hasCustomer) + Number(hasGrade) + Number(hasAmount);
  const departmentIds = conditions.department && conditions.department !== 'all' ? getDepartmentIds(conditions.department) : null;
  const memberOptions = EMPLOYEES.filter(item => !departmentIds || departmentIds.includes(item.departmentId));
  const statusOptions = [{ value: '', label: '全部状态' }, ...[...new Set(rows.map(item => item.status).filter(Boolean))].map(value => ({ value, label: value }))];
  const selectedStatus = conditions.status || conditions.stage || '';

  useEffect(() => setPageNumber(1), [route.page, conditionSignature]);
  useEffect(() => {
    setDateDraft({ start: conditions.start ?? '', end: conditions.end ?? '' });
    setDateError('');
  }, [route.page, conditions.start, conditions.end]);

  const updateConditions = (patch, remove = []) => {
    const next = { ...conditions, ...patch };
    for (const key of remove) delete next[key];
    for (const key of Object.keys(next)) if (next[key] === '' || next[key] == null || next[key] === 'all') delete next[key];
    onConditionsChange?.(next);
  };
  const clearConditions = () => { setDateDraft({ start: '', end: '' }); setDateError(''); onConditionsChange?.({}); };
  const changeDate = (key, value) => {
    const next = { ...dateDraft, [key]: value };
    setDateDraft(next);
    if (next.start && next.end && next.start > next.end) { setDateError('开始日期不能晚于结束日期'); return; }
    setDateError('');
    updateConditions(next, ['period']);
  };

  return <main className="workspace destination-workspace destination-table-workspace">
    <div className="destination-heading"><h1>{CRM_PAGES[route.page]}</h1><button className="secondary-button" onClick={onBack}><Icon name="arrow" className="back-chevron" size={15} />返回工作台</button></div>
    <section className="panel destination-panel destination-list-panel" aria-label={`${CRM_PAGES[route.page]}列表`}>
      <div className="destination-list-toolbar">
        <label className="destination-search"><Icon name="search" size={16} /><input aria-label="搜索名称或客户" placeholder="搜索名称或客户" value={conditions.query ?? ''} onChange={event => updateConditions({ query: event.target.value })} />{conditions.query && <button type="button" aria-label="清空搜索" onClick={() => updateConditions({}, ['query'])}><Icon name="close" size={13} /></button>}</label>
        <FilterDropdown className="destination-department" label="筛选部门" value={conditions.department === 'all' ? '' : conditions.department ?? ''} options={selectedOptions([{ value: '', label: '全部部门' }, ...ORG_TREE.map(item => ({ value: item.id, label: item.name }))], conditions.department === 'all' ? '' : conditions.department)} onChange={value => updateConditions({ department: value }, ['member', 'owner'])} />
        <FilterDropdown className="destination-member" label="筛选成员" value={conditions.member === 'all' ? '' : conditions.member ?? ''} options={selectedOptions([{ value: '', label: '全部成员' }, ...memberOptions.map(item => ({ value: item.id, label: item.name }))], conditions.member === 'all' ? '' : conditions.member)} onChange={value => updateConditions({ member: value }, ['owner'])} />
        {hasGrade && <FilterDropdown className="destination-level" label="筛选等级" value={conditions.level || conditions.grade || ''} options={[{ value: '', label: '全部等级' }, ...['A', 'B', 'C', 'D'].map(value => ({ value, label: `${value} 级` }))]} onChange={value => updateConditions({ level: value }, ['grade'])} />}
        <FilterDropdown className="destination-status" label="筛选状态" value={selectedStatus} options={selectedOptions(statusOptions, selectedStatus)} onChange={value => updateConditions({ status: value }, ['stage'])} />
        <button className="destination-reset" onClick={clearConditions}><Icon name="refresh" size={13} />清空筛选</button>
      </div>
      <div className="destination-date-row">
        <span className="destination-filter-label" title={conditions.dateField || '按记录日期筛选'}>日期范围</span>
        <div className="destination-date-fields" role="group" aria-label="筛选日期范围"><input type="date" aria-label="筛选开始日期" value={dateDraft.start} aria-invalid={Boolean(dateError)} onChange={event => changeDate('start', event.target.value)} /><span>至</span><input type="date" aria-label="筛选结束日期" value={dateDraft.end} aria-invalid={Boolean(dateError)} onChange={event => changeDate('end', event.target.value)} />{(dateDraft.start || dateDraft.end) && <button type="button" className="destination-date-clear" aria-label="清空日期范围" onClick={() => { setDateDraft({ start: '', end: '' }); setDateError(''); updateConditions({}, ['start', 'end', 'period']); }}><Icon name="close" size={13} /></button>}</div>
        {dateError && <span className="destination-date-error" role="alert">{dateError}</span>}
        {conditions.metric && <span className="destination-source" title={conditions.dateField}>来源：{conditions.metric}</span>}
      </div>
      {chips.length > 0 && <div className="destination-active-filters" aria-label="已选筛选条件"><span className="destination-filter-label">已选条件</span>{chips.map(chip => <span className="destination-filter-chip" key={chip.keys[0]} title={`${chip.label}：${chip.value}`}><span>{chip.label}：{chip.value}</span><button type="button" aria-label={`移除${chip.label}筛选`} onClick={() => updateConditions({}, chip.keys)}><Icon name="close" size={12} /></button></span>)}</div>}
      <div className="destination-results-heading"><div><strong>共 {filteredRows.length} 条</strong><span className="destination-sample-label">示例数据</span></div>{onDetail && <button type="button" className="destination-detail-link" onClick={onDetail}>查看关联详情<Icon name="arrow" size={13} /></button>}</div>
      <div className="destination-table-scroll"><table className="destination-record-table">
        <thead><tr><th className="destination-name-column">{names[route.page] ?? '名称'}</th>{hasCustomer && <th>客户</th>}{hasGrade && <th className="destination-grade-column">等级</th>}<th>部门</th><th>负责人</th><th>状态</th><th className="destination-date-column">{route.page === 'todos' ? '待办日期' : '日期'}</th>{hasAmount && <th className="destination-amount-column">{amountLabel}</th>}</tr></thead>
        <tbody>{pageRows.length ? pageRows.map(row => {
          const canOpen = Boolean(row.detailKind && onRecordDetail);
          return <tr key={row.id}><td className="destination-record-name">{canOpen ? <button type="button" onClick={() => onRecordDetail(row)} title={`查看${row.name}`}>{row.name}<Icon name="arrow" size={13} /></button> : <span>{row.name}</span>}</td>{hasCustomer && <td>{row.customer || '—'}</td>}{hasGrade && <td><ProjectLevelTag level={row.level} /></td>}<td>{departmentName(row.departmentId) || '—'}</td><td>{row.owner || '—'}</td><td><span className={`destination-status-tag ${statusTone(row.status ?? '')}`}>{row.status || '—'}</span></td><td className="destination-record-date">{row.date || '—'}</td>{hasAmount && <td className="destination-record-amount">{money(row.amount)}</td>}</tr>;
        }) : <tr><td colSpan={columns}><div className="destination-empty"><Icon name="search" size={25} /><strong>没有符合条件的记录</strong><span>调整筛选条件，查看其他示例数据。</span><button type="button" className="secondary-button" onClick={clearConditions}>清空筛选</button></div></td></tr>}</tbody>
      </table></div>
      <footer className="destination-pagination"><span>{filteredRows.length ? `第 ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredRows.length)} 条` : '0 条记录'}<span className="destination-page-size">每页 {PAGE_SIZE} 条</span></span><div><button type="button" aria-label="上一页" disabled={currentPage === 1} onClick={() => setPageNumber(value => Math.max(1, value - 1))}><Icon name="chevron" size={14} className="back-chevron" /></button><span>{currentPage}<i>/</i>{pageCount}</span><button type="button" aria-label="下一页" disabled={currentPage === pageCount} onClick={() => setPageNumber(value => Math.min(pageCount, value + 1))}><Icon name="chevron" size={14} /></button></div></footer>
    </section>
  </main>;
}
