import { EMPLOYEES, ORG_TREE, getPeriodRange } from './data.js';

export const CRM_PAGES = {
  workbench: '工作台', todos: '待办中心', leads: '线索管理', customers: '客户管理',
  projects: '项目管理', opportunities: '商机管理', invitations: '客户邀请函',
  visits: '邀约到店', quotes: '草稿报价', catalog: '商城选品',
};

const metricTargets = {
  spend: ['leads', { recordType: '投放消耗' }],
  enquiries: ['leads', { recordType: '询盘进线' }],
  transfers: ['leads', { recordType: '线索转派' }],
  customers: ['customers', { recordType: '新建客户' }],
  visits: ['visits', { status: '已到店' }],
  projects: ['projects', { recordType: '新建项目' }],
  opportunities: ['opportunities', { recordType: '新建商机' }],
  quotes: ['quotes', { recordType: '新建报价' }],
  revenue: ['opportunities', { status: '交付中、已完成', recordType: '成交业绩' }],
  lost: ['projects', { status: '已输单' }],
  followups: ['todos', { taskType: '跟进', status: '待处理' }],
  overdue: ['todos', { status: '已逾期' }],
  won: ['opportunities', { status: '交付中、已完成' }],
  receipts: ['opportunities', { recordType: '已收款' }],
  quoteAmount: ['quotes', { recordType: '报价金额' }],
};

export function filterConditions(filter) {
  const range = getPeriodRange(filter.period, filter.dateRange);
  return {
    department: filter.departmentId, member: filter.employeeId, period: filter.period,
    ...(range ? { start: range.start, end: range.end } : {}),
  };
}

export function metricDestination(metric, filter, extra = {}) {
  const [page, businessConditions] = metricTargets[metric.key] ?? ['workbench', {}];
  return { page, conditions: { ...filterConditions(filter), metric: metric.label, dateField: metric.description, ...businessConditions, ...extra } };
}

export function navigationHash(page, conditions = {}) {
  const query = new URLSearchParams(Object.entries(conditions).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => [key, String(value)]));
  return `#/${CRM_PAGES[page] ? page : 'workbench'}${query.size ? `?${query}` : ''}`;
}

export function readNavigation(hash = window.location.hash) {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  return { page: CRM_PAGES[path] ? path : 'workbench', conditions: Object.fromEntries(new URLSearchParams(query)) };
}

export function conditionEntries(conditions) {
  const entries = [];
  if (conditions.start && conditions.end) entries.push(['日期范围', `${conditions.start} 至 ${conditions.end}`]);
  const labels = { period: '统计周期', metric: '来源指标', recordType: '记录类型', status: '业务状态', grade: '等级', level: '项目等级', projectId: '项目编号', opportunityId: '商机编号', taskId: '待办编号', taskType: '待办类型', date: '待办日期', name: '名称', owner: '负责人', stage: '所属阶段', dateField: '日期口径' };
  if (conditions.department) entries.push(['部门', ORG_TREE.find(item => item.id === conditions.department)?.name ?? (conditions.department === 'all' ? '全部部门' : conditions.department)]);
  if (conditions.member) entries.push(['成员', EMPLOYEES.find(item => item.id === conditions.member)?.name ?? (conditions.member === 'all' ? '全部成员' : conditions.member)]);
  for (const [key, label] of Object.entries(labels)) if (conditions[key]) entries.push([label, conditions[key]]);
  return entries;
}
