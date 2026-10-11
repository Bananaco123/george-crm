import test from 'node:test';
import assert from 'node:assert/strict';
import { PROJECT_STAGES, OPPORTUNITY_STAGES, BOARD_OPPORTUNITY_STAGES, ORG_TREE, EMPLOYEES, CURRENT_USER, projects, opportunities, tasks, dormantCustomers, TODAY, dateKey, getProjectStats, getProjectStatus, getMetrics, matchesFilters, matchesPeriod, hydrateStoredTasks, getDepartmentIds } from './data.js';

const project = { id: 'test-project', lost: false };
const item = (status, overrides = {}) => ({ projectId: project.id, category: 'product', status, amount: 1000, quoted: false, ...overrides });

test('项目状态聚合排除设计、待接受、已拒绝，零有效商机不会全部成交', () => {
  const items = [item('待接受'), item('已拒绝'), item('已完成', { category: 'design', quoted: true })];
  assert.deepEqual(getProjectStats(project, items), { total: 0, quoted: 0, won: 0, amount: 0 });
  assert.equal(getProjectStatus(project, items), '待成交');
  assert.equal(getProjectStatus(project, []), '待成交');
});

test('交付中与已完成均算成交，未成交及输单产品继续参与分母', () => {
  assert.equal(getProjectStatus(project, [item('交付中'), item('已完成')]), '全部成交');
  assert.equal(getProjectStatus(project, [item('交付中'), item('报价中')]), '部分成交');
  assert.equal(getProjectStatus(project, [item('已完成'), item('已输单')]), '部分成交');
  assert.equal(getProjectStatus(project, [item('已输单')]), '待成交');
  assert.equal(getProjectStatus(project, [item('已完成'), item('洽谈中', { category: 'design' })]), '全部成交');
});

test('项目手动输单优先，不反向改变商机状态', () => {
  const items = [item('交付中'), item('报价中')];
  const before = JSON.stringify(items);
  assert.equal(getProjectStatus({ ...project, lost: true }, items), '已输单');
  assert.equal(JSON.stringify(items), before);
});

test('项目商机数量、已报价数、成交数与金额使用同一产品集合', () => {
  const items = [item('交付中', { quoted: true }), item('洽谈中'), item('已拒绝', { quoted: true }), item('已完成', { category: 'design' }), item('已完成', { projectId: 'another' })];
  assert.deepEqual(getProjectStats(project, items), { total: 2, quoted: 1, won: 1, amount: 2000 });
});

test('演示数据覆盖各状态且所有商机和日程关联有效项目', () => {
  assert.ok(projects.length >= 10);
  assert.ok(opportunities.length >= 22);
  assert.deepEqual(new Set(opportunities.map(item => item.status)), new Set(OPPORTUNITY_STAGES));
  assert.deepEqual(new Set(projects.map(item => getProjectStatus(item))), new Set(PROJECT_STAGES));
  const ids = new Set(projects.map(item => item.id));
  assert.ok([...opportunities, ...tasks].every(item => ids.has(item.projectId)));
  assert.ok(tasks.some(item => item.date === TODAY));
  assert.ok(tasks.some(item => item.date < TODAY));
  assert.ok(tasks.some(item => item.date > TODAY));
});

test('日期键使用北京时间且保留已有日期字符串', () => {
  assert.equal(dateKey('2026-10-10T17:00:00Z'), '2026-10-11');
  assert.equal(dateKey('2026-10-11'), '2026-10-11');
  assert.equal(dateKey('invalid'), '');
  assert.match(TODAY, /^\d{4}-\d{2}-\d{2}$/);
});

test('指标筛选使用一致事件，今日新增项目与报价可核对', () => {
  const metrics = getMetrics('今日', '全部数据');
  assert.equal(metrics.length, 10);
  assert.deepEqual(metrics.slice(5).map(item => item.label), ['新建商机', '新建报价', '到店客户', '业绩金额', '输单项目']);
  assert.equal(metrics.find(item => item.key === 'projects').value, projects.filter(item => item.createdAt === TODAY).length);
  assert.equal(metrics.find(item => item.key === 'quotes').value, opportunities.filter(item => item.quoted && item.quotedAt === TODAY).length);
  assert.equal(metrics.find(item => item.key === 'opportunities').value, opportunities.filter(item => item.createdAt === TODAY).length);
  assert.equal(metrics.find(item => item.key === 'lost').value, projects.filter(item => item.lost && item.lostAt === TODAY).length);
  const mine = getMetrics('今日', '我的数据');
  assert.equal(mine.find(item => item.key === 'projects').value, projects.filter(item => item.createdAt === TODAY && item.owner === '林悦').length);
  assert.ok(mine.every(item => item.value <= metrics.find(all => all.key === item.key).value));
  assert.notEqual(mine.find(item => item.key === 'spend').value, metrics.find(item => item.key === 'spend').value);
});

test('本周和本月数据包含今日，所有指标值与对比均有效', () => {
  for (const scope of ['全部数据', '我的数据']) {
    const today = getMetrics('今日', scope);
    for (const period of ['本周', '本月']) {
      const metrics = getMetrics(period, scope);
      assert.ok(metrics.every(item => Number.isFinite(item.value) && item.value >= today.find(current => current.key === item.key).value));
      assert.ok(metrics.every(item => item.change === null || Number.isFinite(item.change)));
    }
  }
});

test('营销中心选项与 GOS 一致，层级筛选包含所有子级', () => {
  assert.deepEqual(ORG_TREE.map(item => item.name), ['威猛创客中心', '启明创客中心', '天马创客中心', '出海找我', 'Wisdom创客中心']);
  const tree = [{ id: 'a', children: [{ id: 'a-1', children: [{ id: 'a-1-1' }] }, { id: 'a-2' }] }, { id: 'b' }];
  assert.deepEqual(getDepartmentIds('a', tree), ['a', 'a-1', 'a-1-1', 'a-2']);
  assert.deepEqual(getDepartmentIds('a-1', tree), ['a-1', 'a-1-1']);
  assert.deepEqual(getDepartmentIds('missing', tree), []);
});

test('部门与员工筛选取交集，项目按 PM、商机按处理 SM、日程按负责人', () => {
  for (const employee of EMPLOYEES) {
    const filter = { employeeId: employee.id, departmentId: employee.departmentId };
    for (const [items, key] of [[projects, 'pm'], [opportunities, 'solutionManager'], [tasks, 'owner']]) {
      assert.deepEqual(items.filter(item => matchesFilters(item, filter)).map(item => item.id), items.filter(item => item[key] === employee.name).map(item => item.id));
      const anotherDepartment = ORG_TREE.find(item => item.id !== employee.departmentId).id;
      assert.equal(items.filter(item => matchesFilters(item, { ...filter, departmentId: anotherDepartment })).length, 0);
    }
  }
  const ownProjects = new Set(projects.filter(item => item.pm === CURRENT_USER).map(item => item.id));
  const mine = opportunities.filter(item => matchesFilters(item, { scope: '我的数据' }));
  assert.deepEqual(mine.map(item => item.id), opportunities.filter(item => item.solutionManager === CURRENT_USER || ownProjects.has(item.projectId)).map(item => item.id));
  assert.ok(projects.filter(item => matchesFilters(item, { scope: '我的数据', employeeId: 'zhou-yuan' })).length === 0);
  assert.ok(matchesFilters({ owner: '林悦', projectId: projects[0].id }, { scope: '我的数据', departmentId: 'north-america', employeeId: 'lin-yue' }));
  assert.ok(matchesFilters({ projectId: projects[0].id }, { scope: '我的数据', departmentId: 'north-america' }));
  assert.equal(matchesFilters({ owner: '周予安', projectId: projects[0].id }, { scope: '我的数据' }), false);
});

test('十项指标的部门员工口径与列表一致，无匹配数据时统一归零', () => {
  const filters = [
    ...ORG_TREE.map(item => ({ departmentId: item.id })),
    ...EMPLOYEES.map(item => ({ employeeId: item.id })),
    { departmentId: 'north-america', employeeId: 'zhou-yuan' },
  ];
  for (const scope of ['全部数据', '我的数据']) {
    for (const filter of filters) {
      const visible = item => matchesFilters(item, { ...filter, scope });
      const metrics = getMetrics('今日', scope, filter);
      const value = key => metrics.find(item => item.key === key).value;
      assert.equal(value('projects'), projects.filter(item => visible(item) && item.createdAt === TODAY).length);
      assert.equal(value('opportunities'), opportunities.filter(item => visible(item) && item.createdAt === TODAY).length);
      assert.equal(value('quotes'), opportunities.filter(item => visible(item) && item.quoted && item.quotedAt === TODAY).length);
      assert.equal(value('lost'), projects.filter(item => visible(item) && item.lost && item.lostAt === TODAY).length);
      assert.equal(value('revenue'), opportunities.filter(item => visible(item) && ['交付中', '已完成'].includes(item.status) && item.closedAt === TODAY).reduce((sum, item) => sum + item.closedAmount, 0));
    }
  }
  assert.ok(getMetrics('本月', '全部数据', { departmentId: 'north-america', employeeId: 'zhou-yuan' }).every(item => item.value === 0));
});

test('新建商机与输单项目按各自事件日期统计，并在今日周月应用部门成员筛选', () => {
  const today = new Date(`${TODAY}T12:00:00+08:00`);
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const starts = { 今日: TODAY, 本周: dateKey(monday), 本月: `${TODAY.slice(0, 7)}-01` };
  const filters = [{}, ...ORG_TREE.map(item => ({ departmentId: item.id })), ...EMPLOYEES.map(item => ({ employeeId: item.id, departmentId: item.departmentId }))];
  for (const [period, start] of Object.entries(starts)) {
    const within = value => value && value >= start && value <= TODAY;
    for (const scope of ['全部数据', '我的数据']) {
      for (const filter of filters) {
        const visible = item => matchesFilters(item, { ...filter, scope });
        const metrics = getMetrics(period, scope, filter);
        assert.equal(metrics.find(item => item.key === 'opportunities').value, opportunities.filter(item => visible(item) && within(item.createdAt)).length);
        assert.equal(metrics.find(item => item.key === 'lost').value, projects.filter(item => visible(item) && item.lost && within(item.lostAt)).length);
      }
    }
  }
  assert.ok(projects.every(item => item.lost ? item.lostAt >= item.createdAt && item.lostAt <= TODAY : item.lostAt === null));
});

test('全部商机输单不自动计为输单项目，项目标记及输单日期共同决定计数', () => {
  const baseline = getMetrics('今日').find(item => item.key === 'lost').value;
  const syntheticProject = { id: 'test-loss-metric', owner: CURRENT_USER, pm: CURRENT_USER, createdAt: TODAY, lost: false, lostAt: TODAY };
  const syntheticOpportunity = { projectId: syntheticProject.id, owner: CURRENT_USER, category: 'product', status: '已输单', createdAt: TODAY, closedAt: TODAY };
  projects.push(syntheticProject);
  opportunities.push(syntheticOpportunity);
  try {
    const value = () => getMetrics('今日').find(item => item.key === 'lost').value;
    assert.equal(value(), baseline);
    syntheticProject.lost = true;
    syntheticProject.lostAt = '2000-01-01';
    assert.equal(value(), baseline);
    syntheticProject.lostAt = null;
    assert.equal(value(), baseline);
    syntheticProject.lostAt = TODAY;
    assert.equal(value(), baseline + 1);
  } finally {
    opportunities.pop();
    projects.pop();
  }
});

test('商机从洽谈中进入看板，项目收款与产品商机同源且角色字段独立', () => {
  assert.deepEqual(BOARD_OPPORTUNITY_STAGES, ['洽谈中', '报价中', '待下单', '交付中', '已完成', '已输单']);
  assert.ok(opportunities.every(item => ['产品订单', '设计服务', '增补订单'].includes(item.opportunityType)));
  assert.ok(opportunities.every(item => (item.orderAmount === null || item.orderAmount >= item.closedAmount) && (item.receivedAmount === null || item.closedAmount >= item.receivedAmount)));
  assert.ok(opportunities.every(item => item.solutionManager && item.opportunityDepartment && item.createdAt));
  assert.ok(opportunities.every(item => item.departmentId === projects.find(project => project.id === item.projectId).departmentId));
  assert.ok(opportunities.every(item => item.opportunityDepartment === ORG_TREE.find(department => department.id === item.departmentId).name));
  assert.ok(opportunities.some(item => item.solutionManager !== projects.find(project => project.id === item.projectId).pm));
  for (const project of projects) {
    const products = opportunities.filter(item => item.projectId === project.id && item.category === 'product' && !['待接受', '已拒绝'].includes(item.status));
    assert.equal(project.contribution, products.reduce((sum, item) => sum + item.closedAmount, 0));
    assert.equal(project.collected, products.reduce((sum, item) => sum + (item.receivedAmount ?? 0), 0));
    assert.ok(project.pm && project.deliveryManager && project.pm !== project.deliveryManager);
  }
});

test('海外客户与项目名称参照 GOS，商机、待办、沉睡客户保持同一客户关系', () => {
  assert.equal(projects.length, 13);
  assert.equal(opportunities.length, 34);
  assert.ok(projects.every(project => /[a-z]/i.test(project.customer) && /[a-z]/i.test(project.name)));
  assert.deepEqual(projects.filter(project => ['Aster Residence', 'Lim Family House', 'Noura Villa'].includes(project.customer)).map(project => [project.customer, project.region]), [
    ['Aster Residence', '新加坡'], ['Lim Family House', '马来西亚'], ['Noura Villa', '沙特'],
  ]);
  assert.ok(opportunities.every(item => item.name.startsWith(projects.find(project => project.id === item.projectId).customer.split(' ')[0])));
  assert.ok(tasks.every(task => /[a-z]/i.test(task.title)));
  for (const customer of dormantCustomers) {
    const project = projects.find(project => project.id === customer.projectId);
    assert.equal(customer.name, project.customer);
    assert.equal(customer.company, project.name);
    assert.equal(customer.departmentId, project.departmentId);
  }
});

test('商机金额明确区分尚未产生与数值零，洽谈没有订单及实收、报价没有实收', () => {
  for (const opportunity of opportunities) {
    assert.ok(Number.isFinite(opportunity.amount) && opportunity.amount > 0);
    assert.ok(Number.isFinite(opportunity.closedAmount) && opportunity.closedAmount >= 0);
    if (['待接受', '已拒绝', '洽谈中'].includes(opportunity.status)) {
      assert.equal(opportunity.orderAmount, null);
      assert.equal(opportunity.receivedAmount, null);
      assert.equal(opportunity.closedAmount, 0);
    } else {
      assert.ok(Number.isFinite(opportunity.orderAmount) && opportunity.orderAmount >= 0);
      if (opportunity.status === '报价中') assert.equal(opportunity.receivedAmount, null);
      else assert.ok(Number.isFinite(opportunity.receivedAmount) && opportunity.receivedAmount >= 0);
    }
  }
  assert.ok(opportunities.some(item => item.status === '待下单' && item.receivedAmount === 0));
});

test('看板创建日期周期与新建项目商机指标一致，不影响其他筛选口径', () => {
  for (const period of ['今日', '本周', '本月']) {
    for (const filter of [{}, { departmentId: 'north-america' }, { employeeId: 'zhou-yuan' }]) {
      const visible = item => matchesFilters(item, filter) && matchesPeriod(item, period);
      const metrics = getMetrics(period, '全部数据', filter);
      assert.equal(projects.filter(visible).length, metrics.find(item => item.key === 'projects').value);
      assert.equal(opportunities.filter(visible).length, metrics.find(item => item.key === 'opportunities').value);
    }
    assert.equal(matchesPeriod({ createdAt: TODAY }, period), true);
    assert.equal(matchesPeriod({ createdAt: '2000-01-01' }, period), false);
    assert.equal(matchesPeriod({ createdAt: '2999-01-01' }, period), false);
    assert.equal(matchesPeriod({}, period), false);
  }
  assert.equal(matchesFilters({ owner: CURRENT_USER, createdAt: '2000-01-01' }), true);
});

test('旧缓存迁移更新国际客户名称但保留完成状态、日期、时间和新增跟进', () => {
  const oldBase = { ...tasks[0], title: '确认星河湾全屋柜体报价', description: '与陈先生沟通', status: 'completed', date: '2026-10-12', time: '16:00', projectId: 'old-project' };
  const oldFollowup = { id: 'ACT-C-001', customerId: 'C-001', title: '回访陈先生', description: '旧关注点', projectId: 'old-project', date: '2026-10-13', time: '17:30', status: 'completed' };
  const unknown = { id: 'USER-001', title: '用户自建事项', status: 'pending' };
  const saved = [oldBase, oldFollowup, unknown];
  const before = JSON.stringify(saved);
  const migrated = hydrateStoredTasks(saved);
  assert.equal(migrated.length, tasks.length + 2);
  const base = migrated.find(task => task.id === oldBase.id);
  assert.equal(base.title, tasks[0].title);
  assert.equal(base.description, tasks[0].description);
  assert.equal(base.projectId, tasks[0].projectId);
  assert.equal(base.status, 'completed');
  assert.equal(base.date, '2026-10-12');
  assert.equal(base.time, '16:00');
  const followup = migrated.find(task => task.id === oldFollowup.id);
  assert.ok(followup.title.includes(dormantCustomers[0].name));
  assert.ok(followup.description.includes(dormantCustomers[0].interest));
  assert.equal(followup.projectId, dormantCustomers[0].projectId);
  assert.equal(followup.status, 'completed');
  assert.equal(followup.date, '2026-10-13');
  assert.equal(followup.time, '17:30');
  assert.deepEqual(migrated.find(task => task.id === unknown.id), unknown);
  assert.equal(JSON.stringify(saved), before);
  assert.deepEqual(hydrateStoredTasks(migrated), migrated);
  assert.deepEqual(hydrateStoredTasks(null), tasks);
});
