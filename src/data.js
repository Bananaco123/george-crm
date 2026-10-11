/**
 * George CRM 工作台演示数据。
 * 金额单位为人民币元；全部日期相对本次打开页面的北京时间生成。
 * 这里的事件与汇总仅用于演示，不连接真实业务系统。
 */
export const PROJECT_STAGES = ['待成交', '部分成交', '全部成交', '已输单'];
export const OPPORTUNITY_STAGES = ['待接受', '已拒绝', '洽谈中', '报价中', '待下单', '交付中', '已完成', '已输单'];
export const BOARD_OPPORTUNITY_STAGES = OPPORTUNITY_STAGES.slice(2);

// 营销中心口径沿用 GOS 工作台，商机部门继承所属项目的部门。
export const ORG_TREE = [
  { id: 'north-america', name: '威猛创客中心' },
  { id: 'custom-division', name: '启明创客中心' },
  { id: 'furniture-division', name: '天马创客中心' },
  { id: 'middle-east', name: '出海找我' },
  { id: 'wisdom-center', name: 'Wisdom创客中心' },
];
export const EMPLOYEES = [
  { id: 'lin-yue', name: '林悦', departmentId: 'north-america' },
  { id: 'zhou-yuan', name: '周予安', departmentId: 'custom-division' },
  { id: 'xu-zhiyuan', name: '许知远', departmentId: 'furniture-division' },
  { id: 'shen-jianing', name: '沈佳宁', departmentId: 'middle-east' },
  { id: 'chen-jiahui', name: '陈嘉慧', departmentId: 'wisdom-center' },
  { id: 'zhao-ming', name: '赵明', departmentId: 'north-america' },
  { id: 'xu-yao', name: '徐瑶', departmentId: 'custom-division' },
  { id: 'lu-chuan', name: '陆川', departmentId: 'furniture-division' },
  { id: 'tang-jin', name: '唐瑾', departmentId: 'middle-east' },
];
export const CURRENT_USER = '林悦';
const employeeByName = name => EMPLOYEES.find(employee => employee.name === name);
const responsibility = name => ({ responsibleEmployeeId: employeeByName(name)?.id, departmentId: employeeByName(name)?.departmentId });

export function getDepartmentIds(departmentId, nodes = ORG_TREE) {
  const find = entries => {
    for (const node of entries) {
      if (node.id === departmentId) return node;
      const nested = find(node.children ?? []);
      if (nested) return nested;
    }
    return null;
  };
  const node = find(nodes);
  const collect = entry => [entry.id, ...(entry.children ?? []).flatMap(collect)];
  return node ? collect(node) : [];
}

/** 部门、员工和数据范围取交集。商机同时保留当前用户作为项目 PM 的可见范围。 */
export function matchesFilters(item, { scope = '全部数据', departmentId = 'all', employeeId = 'all' } = {}) {
  const project = item.projectId && projects.find(entry => entry.id === item.projectId);
  const responsible = EMPLOYEES.find(employee => employee.id === item.responsibleEmployeeId)
    ?? employeeByName(item.solutionManager ?? item.pm ?? item.owner ?? project?.pm);
  const ownProjectOpportunity = Boolean(item.solutionManager) && project?.pm === CURRENT_USER;
  if (scope === '我的数据' && responsible?.name !== CURRENT_USER && !ownProjectOpportunity) return false;
  if (departmentId !== 'all' && !getDepartmentIds(departmentId).includes(item.departmentId ?? responsible?.departmentId)) return false;
  if (employeeId !== 'all' && responsible?.id !== employeeId) return false;
  return true;
}

const shanghaiDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function dateKey(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  const parts = shanghaiDate.formatToParts(parsed);
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export const TODAY = dateKey(new Date());
const dayOffset = (offset, from = TODAY) => {
  const date = new Date(`${from}T12:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + offset);
  return dateKey(date);
};

/** 阶段停留按进入当前阶段的北京时间日期计算，不以商机创建日期替代。 */
export function getStageDurationDays(item, asOf = TODAY) {
  if (!item?.stageEnteredAt || !asOf) return 0;
  const start = dateKey(item.stageEnteredAt), end = dateKey(asOf);
  const elapsed = new Date(`${end}T00:00:00+08:00`) - new Date(`${start}T00:00:00+08:00`);
  return Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / 86400000)) : 0;
}

// 客户与国家地区取自 GOS V1.3 的 projectDashboard.js；Aster / Lim / Noura 取自
// operationsDashboard.js 的 RESULT_TOUCHPOINTS。沿用当地项目场景，阶段与日期仍为本 Demo 演示数据。
const projectRows = [
  ['P-20261001', '加拿大 Kanchan · 全屋柜体', 'Kanchan Rajput', '林悦', '加拿大', -2, '方案设计', '设计中', false],
  ['P-20261002', '新加坡 Joseph · 圣淘沙别墅', 'Joseph Chen', '林悦', '新加坡', -6, '方案设计', '已设计', false],
  ['P-20261003', '法国 Sofia · 精品酒店公区', 'Sofia Laurent', '周予安', '法国', -12, '独立设计服务', '已设计', false],
  ['P-20261004', '美国 Emily · 洛杉矶山景别墅', 'Emily Carter', '林悦', '美国', -24, '方案设计', '已设计', false],
  ['P-20261005', '菲律宾 Miguel · 高尔夫会所', 'Miguel Santos', '许知远', '菲律宾', -18, '独立设计服务', '设计中', true, -2],
  ['P-20261006', '美国 Sarah · 芝加哥办公室', 'Sarah Mitchell', '周予安', '美国', -9, '方案设计', '设计中', false],
  ['P-20261007', '新加坡 Aster Residence · 公寓全屋定制', 'Aster Residence', '林悦', '新加坡', 0, '方案设计', '设计中', false],
  ['P-20261008', '英国 Oliver · 样板间', 'Oliver Smith', '沈佳宁', '英国', -37, '方案设计', '已设计', false],
  ['P-20261009', '马来西亚 Lim Family House · 住宅', 'Lim Family House', '林悦', '马来西亚', 0, '暂无', '暂无', false],
  ['P-20261010', '加拿大 Nathan · 湖景住宅', 'Nathan Brooks', '许知远', '加拿大', -31, '独立设计服务', '设计中', false],
  ['P-20261011', '沙特 Noura Villa · 别墅', 'Noura Villa', '沈佳宁', '沙特', -15, '暂无', '暂无', true, 0],
  ['P-20261012', '澳洲 Thomas · 悉尼公寓柜体', 'Thomas King', '林悦', '澳大利亚', -4, '暂无', '暂无', false],
  ['P-20261013', '美国 Morgan · 精品酒店客房', 'Morgan Lee', '周予安', '美国', -1, '独立设计服务', '已设计', false],
];

// lostAt 是项目被手动标记输单的演示事件日期，与商机输单或商机关闭日期分别记录。
export const projects = projectRows.map(([id, name, customer, owner, region, age, designType, designStatus, lost, lostAge = null], index) => ({
  id, name, customer, owner, pm: owner, deliveryManager: ['王建', '陈涛', '陆远'][index % 3],
  ...responsibility(owner), region, createdAt: dayOffset(age), designType, designStatus, lost,
  lostAt: lost && lostAge !== null ? dayOffset(lostAge) : null,
}));

// 最后三列为报价、成交/输单、进入当前阶段的相对日期，阶段日期独立于创建日期。
const opportunityRows = [
  ['OP-001', 0, '全屋柜体定制', 'product', '报价中', 186000, true, -2, 0, null, 0],
  ['OP-002', 0, '客餐厅软装', 'product', '洽谈中', 88000, false, -1, null, null, 0],
  ['OP-003', 0, '主卧木作', 'product', '待下单', 126000, true, -1, 0, null, 0],
  ['OP-004', 0, '全屋深化方案', 'design', '报价中', 18000, true, -2, -1, null, -1],
  ['OP-005', 1, '进口系统门窗', 'product', '交付中', 248000, true, -6, -4, 0, 0],
  ['OP-006', 1, '厨房及餐厅定制', 'product', '报价中', 172000, true, -5, -1, null, -1],
  ['OP-007', 1, '方案设计', 'design', '已完成', 15000, true, -6, -5, -2, -1],
  ['OP-008', 2, '整体空间设计', 'design', '已完成', 96000, true, -12, -10, -1, 0],
  ['OP-009', 2, '家具采购意向', 'product', '待接受', 210000, false, -1, null, null, -1],
  ['OP-010', 3, '客餐厅进口家具', 'product', '已完成', 368000, true, -24, -20, -2, -1],
  ['OP-011', 3, '全屋智能照明', 'product', '交付中', 132000, true, -23, -18, -1, -1],
  ['OP-012', 3, '软装搭配设计', 'design', '已完成', 26000, true, -24, -23, -15, -13],
  ['OP-013', 4, '会所公共区家具', 'product', '已输单', 420000, true, -18, -15, -2, -2],
  ['OP-014', 4, '会所包间定制', 'product', '已输单', 195000, true, -17, -14, -2, -2],
  ['OP-015', 4, '会所设计咨询', 'design', '洽谈中', 38000, false, -4, null, null, -3],
  ['OP-016', 5, '办公区系统家具', 'product', '交付中', 285000, true, -9, -8, -3, -3],
  ['OP-017', 5, '接待区软装', 'product', '待下单', 115000, true, -8, -3, null, -2],
  ['OP-018', 5, '会议室声学方案', 'product', '洽谈中', 65000, false, -2, null, null, -1],
  ['OP-019', 6, '客餐厅家具及陈设', 'product', '报价中', 78000, true, 0, 0, null, 0],
  ['OP-020', 6, '展示柜及木作', 'product', '待下单', 92000, true, 0, 0, null, 0],
  ['OP-021', 6, '公寓方案设计', 'design', '洽谈中', 12000, false, 0, null, null, 0],
  ['OP-022', 7, '样板间全屋定制', 'product', '已完成', 356000, true, -37, -33, -12, -10],
  ['OP-023', 7, '样板间软装陈设', 'product', '已完成', 168000, true, -36, -32, -8, -7],
  ['OP-024', 8, '全屋柜体意向', 'product', '待接受', 185000, false, 0, null, null, 0],
  ['OP-025', 8, '露台户外家具', 'product', '已拒绝', 36000, false, 0, null, null, 0],
  ['OP-026', 9, '庭院户外家具', 'product', '已完成', 146000, true, -31, -28, -6, -5],
  ['OP-027', 9, '主楼整体木作', 'product', '交付中', 520000, true, -30, -25, 0, 0],
  ['OP-028', 9, '庭院景观设计', 'design', '洽谈中', 68000, false, -5, null, null, -3],
  ['OP-029', 10, '别墅接待区家具', 'product', '已输单', 156000, true, -15, -13, 0, 0],
  ['OP-030', 10, '家庭书房定制', 'product', '已输单', 98000, false, -14, null, 0, 0],
  ['OP-031', 11, '客餐厅整体定制', 'product', '待下单', 238000, true, -4, -1, null, 0],
  ['OP-032', 11, '儿童房软装', 'product', '已输单', 46000, true, -3, -2, -1, -1],
  ['OP-033', 12, '酒店客房设计', 'design', '已完成', 48000, true, -1, -1, 0, 0],
  ['OP-034', 12, '客房家具采购', 'product', '待接受', 320000, false, -1, null, null, -1],
];

// 每个阶段准备独立采购范围，仅补足本月不足四条的阶段；历史样本与已有 ID 保留。
const monthlyOpportunityCandidates = [
  ['OP-035', 0, '玄关收纳柜', 'product', '洽谈中', 28000, false, -2, null, null, -1],
  ['OP-036', 1, '露台遮阳及户外家具', 'product', '洽谈中', 74000, false, -5, null, null, -3],
  ['OP-037', 5, '员工休息区家具', 'product', '洽谈中', 42000, false, -6, null, null, -2],
  ['OP-038', 11, '走廊壁柜', 'product', '洽谈中', 36000, false, -3, null, null, -1],
  ['OP-039', 0, '厨房储物五金', 'product', '报价中', 32000, true, -2, -1, null, -1],
  ['OP-040', 1, '衣帽间定制', 'product', '报价中', 96000, true, -6, -3, null, -3],
  ['OP-041', 5, '经理室家具', 'product', '报价中', 68000, true, -7, -4, null, -4],
  ['OP-042', 11, '浴室柜定制', 'product', '报价中', 42000, true, -4, -2, null, -2],
  ['OP-043', 0, '书房家具', 'product', '待下单', 46000, true, -2, -1, null, 0],
  ['OP-044', 1, '客卧整体木作', 'product', '待下单', 78000, true, -6, -4, null, -2],
  ['OP-045', 5, '会议桌及座椅', 'product', '待下单', 54000, true, -8, -5, null, -3],
  ['OP-046', 11, '阳台储物柜', 'product', '待下单', 25000, true, -4, -2, null, -1],
  ['OP-047', 3, '庭院休闲座椅', 'product', '交付中', 68000, true, -9, -7, -4, -4],
  ['OP-048', 9, '湖景餐厅定制', 'product', '交付中', 128000, true, -8, -6, -2, -2],
  ['OP-049', 7, '展示区装饰灯具', 'product', '交付中', 36000, true, -7, -5, -1, -1],
  ['OP-050', 5, '办公储物系统', 'product', '交付中', 72000, true, -6, -4, 0, 0],
  ['OP-051', 7, '展示区成品边桌', 'product', '已完成', 18000, true, -9, -7, -5, -2],
  ['OP-052', 2, '公区灯光方案设计', 'design', '已完成', 24000, true, -8, -6, -4, -1],
  ['OP-053', 9, '客厅窗帘及轨道', 'product', '已完成', 32000, true, -7, -5, -3, 0],
  ['OP-054', 3, '门厅艺术陈设', 'product', '已完成', 26000, true, -6, -4, -2, 0],
  ['OP-055', 5, '会议室地毯', 'product', '已输单', 38000, true, -8, -5, -2, -2],
  ['OP-056', 1, '泳池边户外家具', 'product', '已输单', 86000, true, -6, -4, -1, -1],
  ['OP-057', 11, '入户金属屏风', 'product', '已输单', 29000, true, -4, -2, 0, 0],
  ['OP-058', 0, '厨房电器配套', 'product', '已输单', 56000, true, -2, -1, 0, 0],
];
const monthStart = `${TODAY.slice(0, 7)}-01`;
const supplementaryRows = BOARD_OPPORTUNITY_STAGES.flatMap(stage => {
  const count = opportunityRows.filter(row => row[4] === stage && dayOffset(row[7]) >= monthStart).length;
  return monthlyOpportunityCandidates.filter(row => row[4] === stage).slice(0, Math.max(0, 4 - count));
});
const supplementalIds = new Set(supplementaryRows.map(row => row[0]));

export const opportunities = [...opportunityRows, ...supplementaryRows].map(([id, projectIndex, name, category, status, amount, quoted, age, quoteAge, closeAge, stageAge], index) => {
  const project = projects[projectIndex];
  const departmentEmployees = EMPLOYEES.filter(employee => employee.departmentId === project.departmentId);
  const solutionManager = departmentEmployees[(index + 1) % departmentEmployees.length].name;
  const won = ['交付中', '已完成'].includes(status);
  const hasOrder = !['待接受', '已拒绝', '洽谈中'].includes(status);
  const hasReceipt = hasOrder && status !== '报价中';
  const latestDate = (...dates) => dates.filter(Boolean).sort().at(-1);
  const createdAt = supplementalIds.has(id) ? latestDate(project.createdAt, monthStart, dayOffset(age)) : dayOffset(age);
  const quotedAt = quoteAge === null ? null : latestDate(createdAt, dayOffset(quoteAge));
  const closedAt = closeAge === null ? null : latestDate(createdAt, quotedAt, dayOffset(closeAge));
  const stageEnteredAt = latestDate(createdAt, quotedAt, closedAt, dayOffset(stageAge));
  return {
    id, projectId: project.id, name: `${project.customer.split(' ')[0]} · ${name}`, category, owner: project.owner,
    status, amount, quoted, createdAt, stageEnteredAt,
    opportunityType: category === 'design' ? '设计服务' : id === 'OP-011' ? '增补订单' : '产品订单',
    orderAmount: hasOrder ? amount : null, closedAmount: won ? amount : 0,
    receivedAmount: hasReceipt ? (won ? Math.round(amount * (status === '已完成' ? 1 : 0.6)) : 0) : null,
    solutionManager, ...responsibility(solutionManager),
    opportunityDepartment: ORG_TREE.find(department => department.id === project.departmentId).name,
    quotedAt, closedAt,
  };
});

const isCountedProduct = opportunity => opportunity.category === 'product' && !['待接受', '已拒绝'].includes(opportunity.status);
const isWon = opportunity => ['交付中', '已完成'].includes(opportunity.status);

for (const project of projects) {
  const products = opportunities.filter(item => item.projectId === project.id && isCountedProduct(item));
  project.contribution = products.reduce((total, item) => total + item.closedAmount, 0);
  project.collected = products.reduce((total, item) => total + (item.receivedAmount ?? 0), 0);
}

export function getProjectStats(project, items = opportunities) {
  const included = items.filter(item => item.projectId === project.id && isCountedProduct(item));
  return {
    total: included.length,
    quoted: included.filter(item => item.quoted).length,
    won: included.filter(isWon).length,
    amount: included.reduce((total, item) => total + item.amount, 0),
  };
}

export function getProjectStatus(project, items = opportunities) {
  if (project.lost) return '已输单';
  const { total, won } = getProjectStats(project, items);
  if (total > 0 && won === total) return '全部成交';
  if (won > 0) return '部分成交';
  return '待成交';
}

const taskRows = [
  ['T-001', '确认 Kanchan 全屋柜体报价', '报价', 0, 0, '09:30', 'pending', '与 Kanchan Rajput 确认柜体饰面与五金选型，更新第二版报价。'],
  ['T-002', 'Joseph 别墅门窗交付沟通', '跟进', 1, 0, '11:00', 'pending', '确认现场复尺结果，并同步到货与安装时间。'],
  ['T-003', 'Aster Residence 公寓方案沟通', '项目', 6, 0, '14:00', 'pending', '携带采购方案与材质样板，确认公寓客餐厅布局。'],
  ['T-004', 'Thomas 公寓定制方案回访', '跟进', 11, 0, '16:30', 'pending', '了解客户对客餐厅定制方案的反馈，推进下单确认。'],
  ['T-005', 'Sarah 办公室接待区报价复核', '报价', 5, 0, '10:00', 'completed', '已完成接待区软装产品、数量和交期核对。'],
  ['T-006', 'Emily 别墅照明安装确认', '项目', 3, -1, '15:00', 'pending', '与工程团队确认照明调试及客户验收安排。'],
  ['T-007', 'Lim Family House 首次需求沟通', '跟进', 8, 1, '10:30', 'pending', '了解房屋空间、预算范围及预计入住时间。'],
  ['T-008', 'Nathan 湖景住宅木作交付检查', '项目', 9, 1, '14:00', 'pending', '复核木作安装计划，协调现场交付负责人。'],
  ['T-009', 'Morgan 酒店家具需求确认', '跟进', 12, 2, '11:00', 'pending', '根据已完成的设计方案，确认客房家具采购清单。'],
  ['T-010', 'Sofia 酒店设计成果回访', '跟进', 2, -2, '09:30', 'completed', '已交付完整设计成果，客户反馈已记录。'],
  ['T-011', 'Kanchan 主卧木作报价复核', '报价', 0, 3, '15:30', 'pending', '复核尺寸与饰面差价，准备最终下单报价。'],
  ['T-012', 'Oliver 样板间交付回访', '项目', 7, 5, '10:00', 'pending', '收集样板间使用反馈，核对售后服务需求。'],
];

export const tasks = taskRows.map(([id, title, type, projectIndex, age, time, status, description]) => ({
  id, title, type, projectId: projects[projectIndex].id, owner: projects[projectIndex].owner,
  ...responsibility(projects[projectIndex].owner),
  date: dayOffset(age), time, status, description,
}));

export const dormantCustomers = [
  { id: 'C-001', projectIndex: 0, days: 8, interest: '对进口饰面和隐藏式收纳较感兴趣，待确认样板。' },
  { id: 'C-002', projectIndex: 11, days: 12, interest: '已认可整体风格，希望进一步了解产品交期。' },
  { id: 'C-003', projectIndex: 2, days: 16, interest: '设计服务已完成，可跟进后续家具采购需求。' },
].map(({ projectIndex, ...customer }) => {
  const project = projects[projectIndex];
  return { ...customer, name: project.customer, company: project.name, owner: project.pm,
    ...responsibility(project.pm), projectId: project.id, lastContact: dayOffset(-customer.days) };
});

/** 以最新演示主数据恢复名称与关联，保留用户在本地完成/安排待办的结果。 */
export function hydrateStoredTasks(saved) {
  if (!Array.isArray(saved)) return tasks.map(task => ({ ...task }));
  const stored = new Map(saved.filter(task => task && typeof task.id === 'string').map(task => [task.id, task]));
  const base = tasks.map(task => {
    const previous = stored.get(task.id);
    return { ...task, ...(previous && {
      status: ['pending', 'completed'].includes(previous.status) ? previous.status : task.status,
      date: /^\d{4}-\d{2}-\d{2}$/.test(previous.date) ? previous.date : task.date,
      time: /^\d{2}:\d{2}$/.test(previous.time) ? previous.time : task.time,
    }) };
  });
  const additions = [...stored.values()].filter(task => !tasks.some(baseTask => baseTask.id === task.id)).map(task => {
    const customer = dormantCustomers.find(customer => task.id === `ACT-${customer.id}` || task.customerId === customer.id);
    if (!customer) return task;
    return { ...task, customerId: customer.id, title: `回访${customer.name}，确认近期采购计划`,
      type: '跟进', projectId: customer.projectId, owner: customer.owner,
      departmentId: customer.departmentId, responsibleEmployeeId: customer.responsibleEmployeeId,
      description: `已 ${customer.days} 天未联系。沟通关注点：${customer.interest}` };
  });
  return [...base, ...additions];
}

const owners = ['林悦', '周予安', '许知远', '沈佳宁'];

// 营销与客户类指标使用同一批带日期、负责人的演示事件汇总。
const activityEvents = Array.from({ length: 66 }, (_, day) => {
  const date = dayOffset(-day);
  return owners.map((owner, index) => ({
    date, owner, ...responsibility(owner),
    spend: 560 + ((day * 173 + index * 257) % 1300),
    enquiries: 5 + ((day * 3 + index * 7) % 16),
    transfers: 2 + ((day + index * 3) % 9),
    customers: 1 + ((day * 2 + index) % 6),
    visits: (day + index * 2) % 5,
  }));
}).flat();

function periodRange(period) {
  if (period === '本周') {
    const weekday = new Date(`${TODAY}T12:00:00+08:00`).getUTCDay();
    return { start: dayOffset(-((weekday + 6) % 7)), end: TODAY };
  }
  if (period === '本月') return { start: `${TODAY.slice(0, 7)}-01`, end: TODAY };
  return { start: TODAY, end: TODAY };
}

/** 看板使用创建日期口径，与业务概览线的新建项目/新建商机共用同一周期。 */
export function matchesPeriod(item, period = '本月') {
  const { start, end } = periodRange(period);
  const createdAt = item?.createdAt && dateKey(item.createdAt);
  return Boolean(createdAt) && createdAt >= start && createdAt <= end;
}

function previousRange(period, range) {
  if (period === '本周') return { start: dayOffset(-7, range.start), end: dayOffset(-7, range.end) };
  if (period === '本月') {
    const current = new Date(`${TODAY}T12:00:00+08:00`);
    const year = current.getUTCFullYear();
    const month = current.getUTCMonth();
    const finalPreviousDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const comparisonDay = Math.min(current.getUTCDate(), finalPreviousDay);
    const prefix = dateKey(new Date(Date.UTC(year, month - 1, 1, 4))).slice(0, 7);
    return { start: `${prefix}-01`, end: `${prefix}-${String(comparisonDay).padStart(2, '0')}` };
  }
  return { start: dayOffset(-1), end: dayOffset(-1) };
}

function summarize(range, scope, filter) {
  const within = date => Boolean(date) && date >= range.start && date <= range.end;
  const visible = item => matchesFilters(item, { ...filter, scope });
  const events = activityEvents.filter(item => visible(item) && within(item.date));
  const sum = key => events.reduce((total, item) => total + item[key], 0);
  return {
    spend: sum('spend'), enquiries: sum('enquiries'), transfers: sum('transfers'), customers: sum('customers'),
    projects: projects.filter(item => visible(item) && within(item.createdAt)).length,
    opportunities: opportunities.filter(item => visible(item) && within(item.createdAt)).length,
    quotes: opportunities.filter(item => visible(item) && item.quoted && within(item.quotedAt)).length,
    visits: sum('visits'),
    revenue: opportunities.filter(item => visible(item) && isWon(item) && within(item.closedAt)).reduce((total, item) => total + item.closedAmount, 0),
    lost: projects.filter(item => visible(item) && item.lost && within(item.lostAt)).length,
  };
}

/**
 * change 对比上一等长统计进度：昨日 / 上周同期 / 上月同期。
 * 基期为 0 时返回 null，避免虚构百分比；UI 应显示“—”或“暂无对比”。
 * 业绩金额汇总当期成交的产品与独立设计服务商机，不重复累计项目金额。
 * 新建商机按创建日期统计所有商机；输单项目仅按项目手动输单事件统计，每个项目计一次。
 */
export function getMetrics(period = '本月', scope = '全部数据', filter = {}) {
  const range = periodRange(period);
  const current = summarize(range, scope, filter);
  const previous = summarize(previousRange(period, range), scope, filter);
  const metadata = [
    ['spend', '投放消耗', '元', 'chart', 'blue'],
    ['enquiries', '询盘进线', '条', 'users', 'teal'],
    ['transfers', '线索转派', '条', 'users', 'purple'],
    ['customers', '新建客户', '位', 'users', 'blue'],
    ['projects', '新建项目', '个', 'folder', 'purple'],
    ['opportunities', '新建商机', '个', 'target', 'blue'],
    ['quotes', '新建报价', '份', 'file', 'teal'],
    ['visits', '到店客户', '位', 'shop', 'amber'],
    ['revenue', '业绩金额', '元', 'target', 'blue'],
    ['lost', '输单项目', '个', 'trend', 'red'],
  ];
  return metadata.map(([key, label, unit, icon, color]) => ({
    key, label, value: current[key], unit, icon, color,
    change: previous[key] === 0 ? null : Math.round(((current[key] - previous[key]) / previous[key]) * 1000) / 10,
  }));
}
