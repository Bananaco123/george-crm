import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPLOYEES, METRIC_CATALOG, TODAY, getPeriodRange, opportunities, projects, receiptEvents, tasks } from './data.js';
import { metricDestination } from './navigation.js';
import { filterDestinationRows, getDestinationRows, getDestinationStatusOptions } from './destinationData.js';

const baseFilter = { departmentId: 'all', employeeId: 'all', period: '近30天' };
const shifted = offset => {
  const date = new Date(`${TODAY}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

test('全部目标页面有共用海外客户样本，15 个指标默认跳转均能显示对应记录', () => {
  for (const page of ['projects', 'opportunities', 'todos', 'leads', 'customers', 'invitations', 'visits', 'quotes', 'catalog']) {
    const rows = getDestinationRows(page);
    assert.ok(rows.length > 0, page);
    assert.equal(new Set(rows.map(row => row.id)).size, rows.length, `${page} 行标识不重复`);
    assert.ok(rows.every(row => row.customer && row.owner && row.memberId && row.projectId && row.date), `${page} 关联信息完整`);
  }
  assert.deepEqual(getDestinationRows('unknown'), []);
  for (const metric of METRIC_CATALOG) {
    const route = metricDestination(metric, baseFilter);
    assert.ok(filterDestinationRows(getDestinationRows(route.page), route.conditions).length > 0, `${metric.label} 有对应示例`);
  }
});

test('部门与成员条件取交集，不因有具体项目编号而放宽条件', () => {
  const rows = getDestinationRows('projects');
  const employee = EMPLOYEES.find(item => item.id === 'lin-yue');
  const result = filterDestinationRows(rows, { department: employee.departmentId, member: employee.id });
  assert.ok(result.length > 0);
  assert.ok(result.every(row => row.departmentId === employee.departmentId && row.memberId === employee.id));
  assert.equal(filterDestinationRows(rows, { department: 'middle-east', member: employee.id }).length, 0);
  assert.equal(filterDestinationRows(rows, { projectId: result[0].projectId, member: 'zhou-yuan' }).length, 0);
  assert.equal(filterDestinationRows(rows, { department: 'not-a-department' }).length, 0);
});

test('日期支持闭区间、单边及准确日期；反向范围和无效日期不会退回全量', () => {
  const rows = getDestinationRows('projects');
  const today = filterDestinationRows(rows, { start: TODAY, end: TODAY });
  assert.ok(today.length > 0);
  assert.ok(today.every(row => row.date === TODAY));
  const since = shifted(-9);
  assert.ok(filterDestinationRows(rows, { start: since }).every(row => row.date >= since));
  assert.ok(filterDestinationRows(rows, { end: since }).every(row => row.date <= since));
  assert.ok(filterDestinationRows(rows, { date: TODAY }).every(row => row.date === TODAY));
  assert.deepEqual(filterDestinationRows(rows, { start: TODAY, end: shifted(-1) }), []);
  assert.deepEqual(filterDestinationRows(rows, { start: '2026-02-30' }), []);
  assert.deepEqual(filterDestinationRows(rows, { date: '2026-02-30' }), []);
  assert.deepEqual(filterDestinationRows(rows, { start: '2099-01-01' }), []);
  assert.deepEqual(filterDestinationRows(rows, { period: '错误周期' }), []);
});

test('状态多值、项目阶段、ABCD 等级分别严格筛选，不混淆或隐式降级', () => {
  const rows = getDestinationRows('opportunities');
  const won = filterDestinationRows(rows, { status: '交付中、已完成' });
  assert.ok(won.length > 0);
  assert.ok(won.every(row => ['交付中', '已完成'].includes(row.status)));
  assert.ok(filterDestinationRows(rows, { stage: '报价中' }).every(row => row.status === '报价中'));
  for (const level of ['A', 'B', 'C', 'D']) {
    const result = filterDestinationRows(rows, { level });
    assert.ok(result.length > 0, `${level} 级有真实样本`);
    assert.ok(result.every(row => row.level === level));
    assert.equal(filterDestinationRows(rows, { grade: `${level}级项目` }).length, result.length);
  }
  assert.deepEqual(filterDestinationRows(rows, { level: 'E' }), []);
  assert.deepEqual(filterDestinationRows(rows, { status: '不存在的状态' }), []);
  assert.ok(getDestinationStatusOptions('opportunities', rows).includes('洽谈中'));
});

test('具体商机、项目与待办 ID 可定位，矛盾的关联 ID 不会显示记录', () => {
  const rows = getDestinationRows('opportunities');
  const target = rows.find(row => row.id === 'OP-001');
  assert.equal(filterDestinationRows(rows, { opportunityId: target.id, projectId: target.projectId }).length, 1);
  assert.equal(filterDestinationRows(rows, { opportunityId: target.id, projectId: 'P-UNKNOWN' }).length, 0);
  const todo = getDestinationRows('todos')[0];
  assert.deepEqual(filterDestinationRows(getDestinationRows('todos'), { taskId: todo.id }).map(row => row.id), [todo.id]);
  assert.deepEqual(filterDestinationRows(rows, { opportunityId: 'OP-MISSING' }), []);
});

test('项目/客户关键词不区分大小写，查询条件与携带条件继续取交集', () => {
  const rows = getDestinationRows('opportunities');
  const result = filterDestinationRows(rows, { query: 'kanchan 木作' });
  assert.ok(result.length > 0);
  assert.ok(result.every(row => row.name.includes('木作') && row.customer === 'Kanchan Rajput'));
  assert.equal(filterDestinationRows(rows, { query: '完全不存在的客户' }).length, 0);
  assert.equal(filterDestinationRows(rows, { query: 'KANCHAN', member: 'zhou-yuan' }).length, 0);
  const sameOwner = filterDestinationRows(rows, { owner: '林悦' });
  assert.ok(sameOwner.length > 0);
  assert.ok(sameOwner.every(row => row.owner === '林悦'));
  assert.equal(filterDestinationRows(rows, { dateField: '任意口径说明' }).length, rows.length);
});

test('商机金额保留状态规则：洽谈无订单/实收，报价无实收，待下单实收为零', () => {
  const rows = getDestinationRows('opportunities');
  for (const row of rows.filter(item => item.status === '洽谈中')) {
    assert.equal(row.amount, null);
    assert.equal(row.orderAmount, null);
    assert.equal(row.receivedAmount, null);
  }
  for (const row of rows.filter(item => item.status === '报价中')) {
    assert.ok(row.orderAmount > 0);
    assert.equal(row.receivedAmount, null);
  }
  for (const row of rows.filter(item => item.status === '待下单')) assert.equal(row.receivedAmount, 0);
});

test('报价/成交/输单使用相应事件日期，而非创建日期', () => {
  const range = getPeriodRange('近7天');
  const within = date => date && date >= range.start && date <= range.end;
  const quoted = filterDestinationRows(getDestinationRows('quotes'), { ...range, metric: '新建报价', recordType: '新建报价' });
  assert.equal(quoted.length, opportunities.filter(item => item.quoted && within(item.quotedAt)).length);
  assert.ok(quoted.every(row => row.date === row.dates.quotedAt && row.amount === row.quoteAmount));
  const won = filterDestinationRows(getDestinationRows('opportunities'), { ...range, metric: '成交商机', status: '交付中、已完成' });
  assert.equal(won.length, opportunities.filter(item => ['交付中', '已完成'].includes(item.status) && within(item.closedAt)).length);
  assert.ok(won.every(row => row.date === row.dates.closedAt));
  const lost = filterDestinationRows(getDestinationRows('projects'), { ...range, metric: '输单项目', status: '已输单' });
  assert.equal(lost.length, projects.filter(item => item.lost && within(item.lostAt)).length);
  assert.ok(lost.every(row => row.date === row.dates.lostAt));
});

test('实收列表只含范围内发生的收款，展示金额不将范围外的尾款计入', () => {
  const result = filterDestinationRows(getDestinationRows('opportunities'), { start: TODAY, end: TODAY, metric: '实收金额', recordType: '已收款' });
  const expected = receiptEvents.filter(event => event.date === TODAY);
  assert.ok(result.length > 0);
  assert.equal(result.reduce((total, row) => total + row.amount, 0), expected.reduce((total, event) => total + event.amount, 0));
  assert.ok(result.every(row => row.date === TODAY));
});

test('待办接收当前本地状态，待处理包含逾期且已完成项不再显示在未完成筛选中', () => {
  const current = tasks.map(task => ({ ...task, status: task.id === 'T-002' ? 'completed' : task.status }));
  const rows = getDestinationRows('todos', { tasks: current });
  assert.equal(rows.find(row => row.id === 'T-002').status, '已完成');
  const pending = filterDestinationRows(rows, { status: '待处理' });
  assert.ok(pending.every(row => row.taskState === 'pending'));
  assert.ok(pending.some(row => row.status === '已逾期'));
  const overdue = filterDestinationRows(rows, { status: '已逾期' });
  assert.ok(overdue.every(row => row.date < TODAY && row.taskState === 'pending'));
  const followups = filterDestinationRows(rows, { status: '待处理', taskType: '跟进' });
  assert.ok(followups.every(row => row.taskType === '跟进'));
  assert.deepEqual(getDestinationRows('todos', { tasks: [] }), []);
});

test('筛选不会修改主数据或调用者持有的原始行', () => {
  const rows = getDestinationRows('opportunities');
  const before = JSON.stringify(rows);
  filterDestinationRows(rows, { start: TODAY, metric: '实收金额', recordType: '已收款' });
  assert.equal(JSON.stringify(rows), before);
});
