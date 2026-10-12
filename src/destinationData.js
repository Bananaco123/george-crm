import {
  EMPLOYEES, TODAY, dateKey, getDepartmentIds, getPeriodRange, getProjectStatus,
  opportunities, projects, receiptEvents, tasks as defaultTasks,
} from './data.js';

const projectById = new Map(projects.map(project => [project.id, project]));
const wonStatuses = ['交付中', '已完成'];
const memberId = item => item.responsibleEmployeeId
  ?? EMPLOYEES.find(member => member.name === (item.solutionManager ?? item.pm ?? item.owner))?.id;

function projectFields(project) {
  return {
    customer: project.customer, projectId: project.id, projectName: project.name,
    departmentId: project.departmentId, memberId: memberId(project), owner: project.pm,
    level: project.level, date: project.createdAt, dates: { createdAt: project.createdAt, lostAt: project.lostAt },
  };
}

function opportunityRow(item) {
  const project = projectById.get(item.projectId);
  const receipts = receiptEvents.filter(receipt => receipt.opportunityId === item.id);
  return {
    ...projectFields(project), id: item.id, name: item.name, opportunityId: item.id,
    memberId: memberId(item), owner: item.solutionManager, departmentId: item.departmentId,
    status: item.status, date: item.createdAt, amount: item.orderAmount,
    orderAmount: item.orderAmount, receivedAmount: item.receivedAmount, quoteAmount: item.quoteAmount,
    closedAmount: item.closedAmount,
    recordType: '新建商机', recordTypes: ['新建商机', ...(wonStatuses.includes(item.status) ? ['成交业绩'] : []), ...(item.receivedAmount > 0 ? ['已收款'] : [])],
    dates: {
      createdAt: item.createdAt, quotedAt: item.quotedAt, closedAt: item.closedAt,
      lostAt: item.status === '已输单' ? item.closedAt : null,
      receivedAt: receipts.map(receipt => receipt.date).sort().at(-1) ?? null,
    },
    receipts: receipts.map(({ date, amount }) => ({ date, amount })), detailKind: 'opportunity',
  };
}

/** 目标页复用同一批客户、负责人及项目；示例行不冒充概览指标的全部明细。 */
export function getDestinationRows(page, { tasks = defaultTasks } = {}) {
  if (page === 'projects') return projects.map(project => ({
    ...projectFields(project), id: project.id, name: project.name, status: getProjectStatus(project),
    amount: project.contribution, orderAmount: project.contribution, receivedAmount: project.collected,
    recordType: '新建项目', detailKind: 'project',
  }));

  if (page === 'opportunities') return opportunities.map(opportunityRow);

  if (page === 'todos') return (Array.isArray(tasks) ? tasks : defaultTasks).map(task => {
    const project = projectById.get(task.projectId);
    return {
      ...(project ? projectFields(project) : {}), id: task.id, taskId: task.id, name: task.title,
      customer: project?.customer ?? '', projectId: task.projectId,
      departmentId: task.departmentId ?? project?.departmentId, memberId: memberId(task), owner: task.owner,
      status: task.status === 'completed' ? '已完成' : task.date < TODAY ? '已逾期' : '待处理',
      taskState: task.status, taskType: task.type, recordType: '待办', date: task.date, dates: { scheduledAt: task.date },
      amount: null, detailKind: 'task',
    };
  });

  if (page === 'quotes') return opportunities.filter(item => item.quoted).map(item => ({
    ...opportunityRow(item), id: `QUOTE-${item.id}`, name: `${item.name} · 报价`,
    status: item.status === '报价中' ? '报价中' : wonStatuses.includes(item.status) ? '已采纳' : item.status === '已输单' ? '已关闭' : '待确认',
    date: item.quotedAt, amount: item.quoteAmount, recordType: '新建报价', recordTypes: ['新建报价', '报价金额'],
  }));

  if (page === 'leads') return projects.flatMap((project, index) => [
    { recordType: '投放消耗', name: `${project.customer} · 推广线索`, status: '已投放', amount: 680 + index * 73 },
    { recordType: '询盘进线', name: `${project.customer} · 采购询盘`, status: index % 3 ? '已跟进' : '待跟进', amount: null },
    { recordType: '线索转派', name: `${project.customer} · 需求转派`, status: '已转派', amount: null },
  ].map((record, recordIndex) => ({
    ...projectFields(project), ...record, id: `LEAD-${index + 1}-${recordIndex + 1}`, detailKind: 'project',
  })));

  const pageDefinitions = {
    customers: { prefix: 'CUSTOMER', recordType: '新建客户', name: project => project.customer, statuses: ['跟进中', '已成交', '待跟进'] },
    invitations: { prefix: 'INVITE', recordType: '客户邀请函', name: project => `${project.customer} · 展厅邀请函`, statuses: ['已发送', '待发送', '已确认'] },
    visits: { prefix: 'VISIT', recordType: '邀约到店', name: project => `${project.customer} · 展厅选材`, statuses: ['已到店', '待到店', '已到店'] },
    catalog: { prefix: 'PRODUCT', recordType: '商城选品', name: (project, index) => `${project.customer} · ${['木作柜体', '成品家具', '软装陈设'][index % 3]}`, statuses: ['已选品', '待确认', '已选品'] },
  };
  const definition = pageDefinitions[page];
  if (!definition) return [];
  return projects.map((project, index) => ({
    ...projectFields(project), id: `${definition.prefix}-${index + 1}`, name: definition.name(project, index),
    recordType: definition.recordType, status: definition.statuses[index % definition.statuses.length],
    amount: page === 'catalog' ? 12000 + index * 2500 : null, detailKind: 'project',
  }));
}

const splitValues = value => String(value ?? '').split(/[、,，]/).map(part => part.trim()).filter(Boolean);
const active = value => value !== undefined && value !== null && value !== '' && !['all', '全部', '全部部门', '全部成员', '全部状态', '全部等级'].includes(value);
const normalized = value => String(value ?? '').trim().toLocaleLowerCase();
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(value) === value;
const gradeKey = value => String(value ?? '').trim().replace(/\s*(?:级项目|级|类)$/, '').trim().toUpperCase();

function dateBasis(row, conditions) {
  const source = `${conditions.metric ?? ''}|${conditions.recordType ?? ''}`;
  if (/(?:新建报价|报价金额|quoteAmount|^quotes\|)/.test(source)) return { dates: [row.dates?.quotedAt], amount: row.quoteAmount ?? row.amount };
  if (/(?:业绩金额|成交业绩|成交商机|^revenue\||^won\|)/.test(source)) return { dates: [row.dates?.closedAt], amount: row.closedAmount ?? row.amount };
  if (/(?:实收金额|已收款|^receipts\|)/.test(source)) return { dates: row.receipts?.map(receipt => receipt.date) ?? [row.dates?.receivedAt], receipts: row.receipts };
  if (/(?:输单项目|^lost\|)/.test(source) || (row.detailKind === 'project' && conditions.status === '已输单')) return { dates: [row.dates?.lostAt] };
  // 日期口径由明确的来源指标选择；说明文案 dateField 不作模糊匹配。
  return { dates: [row.date] };
}

/** 所有业务条件取交集；空结果保持为空，不用其他样本填充或忽略跳转条件。 */
export function filterDestinationRows(rows, conditions = {}) {
  let { start, end } = conditions;
  if (!start && !end && active(conditions.period)) {
    const range = getPeriodRange(conditions.period);
    if (!range) return [];
    ({ start, end } = range);
  }
  if ((start && !validDate(start)) || (end && !validDate(end)) || (start && end && start > end)
    || (conditions.date && !validDate(conditions.date))) return [];
  const within = date => Boolean(validDate(date)) && (!start || date >= start) && (!end || date <= end);
  const departmentIds = active(conditions.department) ? getDepartmentIds(conditions.department) : null;
  const queries = normalized(conditions.query).split(/\s+/).filter(Boolean);
  const requestedGrades = splitValues(conditions.level ?? conditions.grade).map(gradeKey);
  const statuses = splitValues(conditions.status);
  const stages = splitValues(conditions.stage);
  return rows.flatMap(row => {
    if (departmentIds && !departmentIds.includes(row.departmentId)) return [];
    if (active(conditions.member) && row.memberId !== conditions.member) return [];
    if (active(conditions.level ?? conditions.grade) && !requestedGrades.includes(gradeKey(row.level))) return [];
    if (active(conditions.status) && !statuses.some(status => row.status === status || (status === '待处理' && row.taskState === 'pending'))) return [];
    if (active(conditions.stage) && !stages.includes(row.status)) return [];
    if (active(conditions.recordType) && !(row.recordTypes ?? [row.recordType]).includes(conditions.recordType)) return [];
    for (const key of ['id', 'projectId', 'opportunityId', 'taskId', 'taskType', 'owner']) {
      if (active(conditions[key]) && row[key] !== conditions[key]) return [];
    }
    if (conditions.date && row.date !== conditions.date) return [];
    if (active(conditions.name) && !normalized(row.name).includes(normalized(conditions.name))) return [];
    const searchText = normalized([row.name, row.customer, row.projectName, row.owner, row.id].join(' '));
    if (!queries.every(query => searchText.includes(query))) return [];
    const basis = dateBasis(row, conditions);
    const matchedDates = basis.dates.filter(within).sort();
    // 即使不设日期范围，成交/报价/收款等来源也必须有相应业务事件。
    if (!matchedDates.length) return [];
    const amount = basis.receipts
      ? basis.receipts.filter(receipt => within(receipt.date)).reduce((total, receipt) => total + receipt.amount, 0)
      : basis.amount ?? row.amount;
    return [{ ...row, date: matchedDates.at(-1), amount }];
  });
}

export function getDestinationStatusOptions(page, rows = getDestinationRows(page)) {
  return [...new Set(rows.map(row => row.status).filter(Boolean))];
}
