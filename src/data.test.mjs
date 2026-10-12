import test from 'node:test';
import assert from 'node:assert/strict';
import { PROJECT_STAGES, OPPORTUNITY_STAGES, BOARD_OPPORTUNITY_STAGES, ORG_TREE, EMPLOYEES, CURRENT_USER, projects, opportunities, tasks, dormantCustomers, receiptEvents, METRIC_CATALOG, DEFAULT_METRIC_KEYS, TODAY, dateKey, getPeriodRange, getProjectStats, getProjectStatus, getMetrics, matchesFilters, matchesPeriod, hydrateStoredTasks, getDepartmentIds, getStageDurationDays } from './data.js';

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
  assert.equal(metrics.length, 15);
  assert.deepEqual(metrics.slice(0, 10).map(item => item.key), DEFAULT_METRIC_KEYS);
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
  assert.ok(projects.length >= 17);
  assert.ok(opportunities.length >= 34);
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

test('本月每个看板阶段至少四个独立商机，保留历史样本和项目关系', () => {
  const current = opportunities.filter(item => matchesFilters(item) && matchesPeriod(item, '本月'));
  for (const stage of BOARD_OPPORTUNITY_STAGES) {
    assert.ok(current.filter(item => item.status === stage).length >= 4, `${stage} 本月应至少有四条商机`);
  }
  assert.equal(new Set(opportunities.map(item => item.id)).size, opportunities.length);
  assert.equal(new Set(opportunities.map(item => `${item.projectId}:${item.name}`)).size, opportunities.length);
  assert.ok(opportunities.some(item => !matchesPeriod(item, '本月')));
  assert.ok(opportunities.every(item => projects.some(project => project.id === item.projectId && project.createdAt <= item.createdAt)));
  assert.ok(projects.every(item => item.designType !== '采购方案设计'));
  assert.ok(projects.some(item => item.designType === '方案设计'));
  assert.ok(opportunities.every(item => !item.name.includes('采购方案设计')));
});

test('进入阶段日期独立于创建日期且符合报价、成交、交付与完成先后关系', () => {
  for (const opportunity of opportunities) {
    assert.match(opportunity.stageEnteredAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(opportunity.createdAt <= opportunity.stageEnteredAt && opportunity.stageEnteredAt <= TODAY, opportunity.id);
    assert.equal(Boolean(opportunity.quotedAt), opportunity.quoted, opportunity.id);
    if (opportunity.quotedAt) {
      assert.ok(opportunity.createdAt <= opportunity.quotedAt && opportunity.quotedAt <= opportunity.stageEnteredAt, opportunity.id);
    }
    if (opportunity.closedAt) {
      assert.ok(opportunity.createdAt <= opportunity.closedAt && opportunity.closedAt <= opportunity.stageEnteredAt, opportunity.id);
      if (opportunity.quotedAt) assert.ok(opportunity.quotedAt <= opportunity.closedAt, opportunity.id);
    }
    if (opportunity.status === '报价中') assert.equal(opportunity.stageEnteredAt, opportunity.quotedAt);
    if (['交付中', '已输单'].includes(opportunity.status)) assert.equal(opportunity.stageEnteredAt, opportunity.closedAt);
    if (opportunity.status === '已完成') {
      assert.ok(opportunity.closedAt);
      assert.ok(opportunity.closedAt <= opportunity.stageEnteredAt);
      assert.equal(opportunity.receivedAmount, opportunity.orderAmount);
    }
    if (['洽谈中', '待接受', '已拒绝'].includes(opportunity.status)) {
      assert.equal(opportunity.quotedAt, null);
      assert.equal(opportunity.closedAt, null);
      assert.equal(opportunity.orderAmount, null);
      assert.equal(opportunity.receivedAmount, null);
    }
  }
  assert.ok(opportunities.some(item => item.createdAt < item.stageEnteredAt));
  assert.ok(opportunities.some(item => item.status === '已完成' && item.closedAt < item.stageEnteredAt));
});

test('阶段停留天数按北京时间自然日计算，跨月闰日有效且不会出现负数', () => {
  assert.equal(getStageDurationDays({ createdAt: '2026-01-01', stageEnteredAt: '2026-10-09' }, '2026-10-11'), 2);
  assert.equal(getStageDurationDays({ stageEnteredAt: '2026-09-30' }, '2026-10-02'), 2);
  assert.equal(getStageDurationDays({ stageEnteredAt: '2024-02-28' }, '2024-03-01'), 2);
  assert.equal(getStageDurationDays({ stageEnteredAt: '2026-10-10T17:30:00Z' }, '2026-10-11T15:59:00Z'), 0);
  assert.equal(getStageDurationDays({ stageEnteredAt: '2026-10-12' }, '2026-10-11'), 0);
  assert.equal(getStageDurationDays({ stageEnteredAt: 'invalid' }, TODAY), 0);
  assert.equal(getStageDurationDays({ stageEnteredAt: TODAY }, 'invalid'), 0);
  assert.equal(getStageDurationDays({ createdAt: '2026-01-01' }), 0);
  assert.equal(getStageDurationDays(null), 0);
  assert.equal(getStageDurationDays({ stageEnteredAt: TODAY }), 0);
  assert.ok(opportunities.every(item => Number.isInteger(getStageDurationDays(item)) && getStageDurationDays(item) >= 0));
});

const offsetDate = (offset, from = TODAY) => {
  const date = new Date(`${from}T12:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + offset);
  return dateKey(date);
};

test('项目等级由商机继承，近30天各阶段样本充足且全部成交由已赢产品真实聚合', () => {
  assert.ok(projects.every(item => ['A', 'B', 'C', 'D'].includes(item.level)));
  assert.deepEqual(new Set(projects.map(item => item.level)), new Set(['A', 'B', 'C', 'D']));
  assert.ok(opportunities.every(item => item.level === projects.find(project => project.id === item.projectId).level));
  const currentProjects = projects.filter(item => matchesPeriod(item, '近30天'));
  for (const stage of PROJECT_STAGES) assert.ok(currentProjects.filter(item => getProjectStatus(item) === stage).length >= 3, stage);
  for (const project of currentProjects) {
    const products = opportunities.filter(item => item.projectId === project.id && item.category === 'product' && !['待接受', '已拒绝'].includes(item.status));
    const wins = products.filter(item => ['交付中', '已完成'].includes(item.status));
    const status = getProjectStatus(project);
    if (status === '全部成交') {
      assert.ok(products.length > 0);
      assert.equal(wins.length, products.length);
    }
    if (status === '部分成交') assert.ok(wins.length > 0 && wins.length < products.length);
    if (status === '待成交') assert.equal(wins.length, 0);
    if (status === '已输单') assert.equal(project.lost, true);
  }
  for (const stage of BOARD_OPPORTUNITY_STAGES) assert.ok(opportunities.filter(item => matchesPeriod(item, '近30天') && item.status === stage).length >= 4, stage);
  for (const stage of ['洽谈中', '报价中', '待下单', '交付中']) {
    assert.ok(opportunities.some(item => matchesPeriod(item, '近30天') && item.status === stage && getStageDurationDays(item) >= 10), `${stage} 缺少超时样本`);
    assert.ok(opportunities.some(item => matchesPeriod(item, '近30天') && item.status === stage && getStageDurationDays(item) === 0), `${stage} 缺少普通样本`);
  }
});

test('日期快捷区间包含两端，近7天和近30天均包含今日', () => {
  assert.deepEqual(getPeriodRange(), { start: offsetDate(-29), end: TODAY });
  assert.deepEqual(getPeriodRange('昨日'), { start: offsetDate(-1), end: offsetDate(-1) });
  assert.deepEqual(getPeriodRange('今日'), { start: TODAY, end: TODAY });
  assert.deepEqual(getPeriodRange('近7天'), { start: offsetDate(-6), end: TODAY });
  assert.deepEqual(getPeriodRange('近30天'), { start: offsetDate(-29), end: TODAY });
  for (const period of ['昨日', '今日', '近7天', '近30天', '本周', '本月']) {
    const { start, end } = getPeriodRange(period);
    assert.equal(matchesPeriod({ createdAt: start }, period), true);
    assert.equal(matchesPeriod({ createdAt: end }, period), true);
    assert.equal(matchesPeriod({ createdAt: offsetDate(-1, start) }, period), false);
    assert.equal(matchesPeriod({ createdAt: offsetDate(1, end) }, period), false);
  }
  assert.equal(matchesPeriod({ createdAt: `${offsetDate(-1)}T16:00:00Z` }, '今日'), true);
});

test('自由筛选严格校验日期与先后顺序，无效范围返回空数据而非全量', () => {
  const valid = { start: '2024-02-28', end: '2024-03-01' };
  assert.deepEqual(getPeriodRange('自由筛选', valid), valid);
  assert.equal(matchesPeriod({ createdAt: '2024-02-29' }, '自由筛选', valid), true);
  assert.equal(matchesPeriod({ createdAt: '2024-03-02' }, '自由筛选', valid), false);
  for (const range of [undefined, null, {}, { start: TODAY }, { end: TODAY }, { start: TODAY, end: offsetDate(-1) }, { start: '2026-02-29', end: TODAY }, { start: '2026-09-31', end: TODAY }, { start: 'invalid', end: TODAY }, { start: `${TODAY}T00:00:00Z`, end: TODAY }]) {
    assert.equal(getPeriodRange('自由筛选', range), null);
    assert.equal(matchesPeriod({ createdAt: TODAY }, '自由筛选', range), false);
    const metrics = getMetrics('自由筛选', '全部数据', { dateRange: range });
    assert.equal(metrics.length, 15);
    assert.ok(metrics.every(item => item.value === 0 && item.previousValue === 0 && item.change === null && item.range === null));
    assert.deepEqual(metrics.find(item => item.key === 'transfers').gradeBreakdown, { A: 0, B: 0, C: 0 });
  }
  assert.equal(getPeriodRange('未知周期'), null);
  assert.equal(matchesPeriod({ createdAt: TODAY }, '未知周期'), false);
  assert.equal(dateKey('2026-02-30'), '');
});

test('新周期与自由区间比较前一个等长连续区间，比较值能够独立重算', () => {
  for (const [period, dateRange] of [['昨日'], ['今日'], ['近7天'], ['近30天'], ['自由筛选', { start: offsetDate(-19), end: offsetDate(-5) }], ['自由筛选', { start: TODAY, end: TODAY }]]) {
    for (const departmentId of ['all', 'north-america', 'wisdom-center']) {
      const metrics = getMetrics(period, '全部数据', { departmentId, dateRange });
      const { range, comparisonRange } = metrics[0];
      const duration = Math.round((new Date(`${range.end}T00:00:00Z`) - new Date(`${range.start}T00:00:00Z`)) / 86400000) + 1;
      assert.equal(comparisonRange.start, offsetDate(-duration, range.start));
      assert.equal(comparisonRange.end, offsetDate(-1, range.start));
      const previous = getMetrics('自由筛选', '全部数据', { departmentId, dateRange: comparisonRange });
      for (const metric of metrics) {
        const base = previous.find(item => item.key === metric.key).value;
        assert.equal(metric.previousValue, base);
        assert.equal(metric.change, base === 0 ? null : Math.round(((metric.value - base) / base) * 1000) / 10);
      }
    }
  }
  const spend = getMetrics('近30天').find(item => item.key === 'spend');
  assert.ok(spend.value > 0 && spend.previousValue > 0, '活动数据应覆盖近60天及前期比较');
});

test('指标目录提供15项完整业务定义，默认10项顺序固定且备选值来自业务数据', () => {
  assert.deepEqual(DEFAULT_METRIC_KEYS, ['spend', 'enquiries', 'transfers', 'customers', 'visits', 'projects', 'opportunities', 'quotes', 'revenue', 'lost']);
  assert.equal(METRIC_CATALOG.length, 15);
  assert.equal(new Set(METRIC_CATALOG.map(item => item.key)).size, 15);
  assert.ok(METRIC_CATALOG.every(item => item.label && item.unit && item.icon && item.color && item.description));
  for (const period of ['昨日', '今日', '近7天', '近30天']) {
    for (const departmentId of ['all', ...ORG_TREE.map(item => item.id)]) {
      const range = getPeriodRange(period), within = date => date >= range.start && date <= range.end;
      const visible = item => matchesFilters(item, { departmentId });
      const metrics = getMetrics(period, '全部数据', { departmentId });
      const value = key => metrics.find(item => item.key === key).value;
      const pending = tasks.filter(item => visible(item) && within(item.date) && item.status !== 'completed');
      assert.equal(value('followups'), pending.filter(item => item.type === '跟进').length);
      assert.equal(value('overdue'), pending.filter(item => item.date < TODAY).length);
      assert.equal(value('won'), opportunities.filter(item => visible(item) && within(item.closedAt) && ['交付中', '已完成'].includes(item.status)).length);
      assert.equal(value('receipts'), receiptEvents.filter(item => visible(item) && within(item.date)).reduce((sum, item) => sum + item.amount, 0));
      assert.equal(value('quoteAmount'), opportunities.filter(item => visible(item) && item.quoted && within(item.quotedAt)).reduce((sum, item) => sum + item.quoteAmount, 0));
    }
  }
});

test('线索转派等级与总量同源，同部门成员及日期切片均可加总还原', () => {
  const transfer = (period, filter = {}) => getMetrics(period, '全部数据', filter).find(item => item.key === 'transfers');
  for (const period of ['昨日', '今日', '近7天', '近30天']) {
    const total = transfer(period);
    assert.equal(Object.values(total.gradeBreakdown).reduce((sum, value) => sum + value, 0), total.value);
    const departments = ORG_TREE.map(item => transfer(period, { departmentId: item.id }));
    assert.equal(departments.reduce((sum, item) => sum + item.value, 0), total.value);
    for (const grade of ['A', 'B', 'C']) {
      assert.equal(departments.reduce((sum, item) => sum + item.gradeBreakdown[grade], 0), total.gradeBreakdown[grade]);
    }
    for (const department of ORG_TREE) {
      const metrics = EMPLOYEES.filter(item => item.departmentId === department.id).map(item => transfer(period, { departmentId: department.id, employeeId: item.id }));
      const selected = transfer(period, { departmentId: department.id });
      assert.equal(metrics.reduce((sum, item) => sum + item.value, 0), selected.value);
      for (const grade of ['A', 'B', 'C']) assert.equal(metrics.reduce((sum, item) => sum + item.gradeBreakdown[grade], 0), selected.gradeBreakdown[grade]);
    }
  }
  const daily = Array.from({ length: 7 }, (_, offset) => transfer('自由筛选', { dateRange: { start: offsetDate(-offset), end: offsetDate(-offset) } }));
  const week = transfer('近7天');
  assert.equal(daily.reduce((sum, item) => sum + item.value, 0), week.value);
  for (const grade of ['A', 'B', 'C']) assert.equal(daily.reduce((sum, item) => sum + item.gradeBreakdown[grade], 0), week.gradeBreakdown[grade]);
  const mismatch = transfer('近30天', { departmentId: 'north-america', employeeId: 'zhou-yuan' });
  assert.equal(mismatch.value, 0);
  assert.deepEqual(mismatch.gradeBreakdown, { A: 0, B: 0, C: 0 });
});

test('实收事件严格等于已有商机实收，时间不早于成交且未成交商机没有现金事件', () => {
  assert.equal(new Set(receiptEvents.map(item => item.id)).size, receiptEvents.length);
  for (const opportunity of opportunities) {
    const receipts = receiptEvents.filter(item => item.opportunityId === opportunity.id);
    assert.equal(receipts.reduce((sum, item) => sum + item.amount, 0), opportunity.receivedAmount ?? 0);
    if (!['交付中', '已完成'].includes(opportunity.status)) assert.equal(receipts.length, 0);
    for (const receipt of receipts) {
      assert.ok(receipt.amount > 0);
      assert.ok(receipt.date >= opportunity.closedAt && receipt.date <= opportunity.stageEnteredAt && receipt.date <= TODAY);
      assert.equal(receipt.projectId, opportunity.projectId);
      assert.equal(receipt.departmentId, opportunity.departmentId);
      assert.equal(receipt.responsibleEmployeeId, opportunity.responsibleEmployeeId);
    }
    assert.equal(opportunity.quoteAmount, opportunity.quoted ? opportunity.amount : null);
  }
});

test('待办指标使用浏览器当前数组，新增跟进与已完成状态同步且保留范围过滤', () => {
  const currentTasks = [
    { id: 'ACT-C-001', owner: CURRENT_USER, projectId: projects[0].id, type: '跟进', date: TODAY, status: 'pending' },
    { id: 'OVERDUE-MINE', owner: CURRENT_USER, type: '跟进', date: offsetDate(-1), status: 'pending' },
    { id: 'OTHER-DEPARTMENT', owner: '周予安', type: '跟进', date: offsetDate(-1), status: 'pending' },
    { id: 'COMPLETED', owner: CURRENT_USER, type: '跟进', date: offsetDate(-1), status: 'completed' },
    { id: 'OUTSIDE-RANGE', owner: CURRENT_USER, type: '跟进', date: offsetDate(-8), status: 'pending' },
  ];
  const values = (period, overrides = {}) => Object.fromEntries(getMetrics(period, '全部数据', {
    tasks: currentTasks, departmentId: 'north-america', employeeId: 'lin-yue', ...overrides,
  }).filter(item => ['followups', 'overdue'].includes(item.key)).map(item => [item.key, item.value]));
  assert.deepEqual(values('近7天'), { followups: 2, overdue: 1 });
  assert.deepEqual(values('今日'), { followups: 1, overdue: 0 });
  assert.deepEqual(values('近7天', { departmentId: 'all', employeeId: 'all' }), { followups: 3, overdue: 2 });
  currentTasks[0].status = 'completed';
  assert.deepEqual(values('今日'), { followups: 0, overdue: 0 });
  assert.deepEqual(values('近7天'), { followups: 1, overdue: 1 });
  assert.deepEqual(values('近7天', { tasks: [] }), { followups: 0, overdue: 0 });
  assert.deepEqual(values('自由筛选', { dateRange: { start: offsetDate(-1), end: offsetDate(-1) } }), { followups: 1, overdue: 1 });
  assert.deepEqual(values('自由筛选', { dateRange: { start: TODAY, end: offsetDate(-1) } }), { followups: 0, overdue: 0 });
});
