import Icon from './Icon.jsx';
import ProjectLevelTag from './ProjectLevelTag.jsx';
import StageDurationTag from './StageDurationTag.jsx';
import { ORG_TREE, opportunities, projects, getProjectStatus, getProjectStageEnteredAt, getProjectStats } from '../data.js';
import { getRelatedConversations } from '../conversations.js';
import '../business-details.css';

const numberFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });
const amount = value => value == null ? '—' : `¥ ${numberFormat.format(value)}`;
const departmentName = id => ORG_TREE.find(item => item.id === id)?.name ?? '—';
const displayDesignStatus = value => !value || value === '暂无' ? '未发起' : value;
const displayDesignType = value => !value || value === '暂无' ? '方案设计' : value;
const isWon = item => ['交付中', '已完成'].includes(item.status);

function StatusTag({ status }) {
  return <span className="bd-status" data-status={status}>{status}</span>;
}

function Fields({ items, compact = false }) {
  return <dl className={`bd-fields${compact ? ' bd-fields-compact' : ''}`}>{items.map(([label, value]) => <div className="bd-field" key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>;
}

function ConversationActions({ context, onConversation }) {
  const related = getRelatedConversations(context);
  return <div className="bd-conversation-actions">
    <button className="bd-conversation-link" onClick={() => onConversation(context, 'conversation')}><Icon name="messageIn" size={17} /><span>关联会话</span><b>{related.length}</b><Icon name="chevron" size={13} /></button>
    <button className="bd-assistant-link" onClick={() => onConversation(context, 'analysis')}><Icon name="sparkles" size={16} />AI 销冠分析<Icon name="arrow" size={14} /></button>
  </div>;
}

function IdentityCard({ item, kind, status, stageItem, children, onConversation }) {
  return <section className="bd-card bd-identity">
    <div className="bd-identity-heading"><span className="bd-object-icon"><Icon name={kind === 'project' ? 'folder' : 'briefcase'} size={25} /></span><div className="bd-title-block"><h3>{item.name}</h3><p>{kind === 'project' ? '项目编号' : '商机编号'}<span>{item.id}</span></p></div></div>
    <div className="bd-identity-tags"><ProjectLevelTag level={item.level} /><StatusTag status={status} /><span className="bd-duration">{(stageItem ?? item).stageEnteredAt ? <StageDurationTag item={stageItem ?? item} /> : <span className="bd-duration-unknown"><Icon name="clock" size={12} />阶段停留 —</span>}</span></div>
    {children}
    <ConversationActions context={{ kind, id: item.id }} onConversation={onConversation} />
  </section>;
}

function AmountCards({ values, compact = false }) {
  return <div className={`bd-amount-grid${compact ? ' bd-amount-grid-compact' : ''}`}>{values.map(({ label, value, icon, note }) => <div className="bd-amount-card" key={label} title={note}><span className="bd-amount-label">{icon && <Icon name={icon} size={15} />}{label}</span><strong>{amount(value)}</strong></div>)}</div>;
}

function opportunityAmounts(item) {
  return [
    { label: '订单金额', value: item.orderAmount, icon: 'quoteSheet' },
    { label: '成单金额', value: item.closedAmount, icon: 'checkCircle' },
    { label: '实收金额', value: item.receivedAmount, icon: 'banknote' },
  ];
}

function RelatedOpportunity({ item, onOpportunity, expanded, onToggle }) {
  const contentId = `bd-opportunity-${item.id}`;
  return <article className="bd-related-opportunity">
    <div className="bd-related-opportunity-heading"><button className="bd-opportunity-name" onClick={() => onOpportunity(item)} title="打开商机详情"><span>{item.name}</span><Icon name="arrow" size={15} /></button><button className="bd-expand-button" aria-label={`${expanded ? '收起' : '展开'} ${item.name}`} aria-expanded={expanded} aria-controls={contentId} onClick={() => onToggle(item.id)}><Icon name="chevronDown" size={17} /></button></div>
    <div className="bd-related-meta"><span className="bd-record-id">{item.id}</span><StatusTag status={item.status} /><span className="bd-duration"><StageDurationTag item={item} /></span></div>
    {expanded && <div className="bd-related-content" id={contentId}>
      <Fields compact items={[
        ['方案经理', item.solutionManager], ['商机部门', item.opportunityDepartment], ['创建于', <time dateTime={item.createdAt}>{item.createdAt}</time>],
      ]} />
      <AmountCards compact values={opportunityAmounts(item)} />
    </div>}
  </article>;
}

export function ProjectDetail({ item, onOpportunity, onConversation, collapsedOpportunityIds = [], onToggleOpportunity }) {
  const related = opportunities.filter(opportunity => opportunity.projectId === item.id);
  const stats = getProjectStats(item);
  const status = getProjectStatus(item);
  const stageItem = { status, stageEnteredAt: getProjectStageEnteredAt(item) };
  const closedAmount = related.filter(opportunity => opportunity.category === 'product' && isWon(opportunity)).reduce((total, opportunity) => total + (opportunity.closedAmount ?? 0), 0);
  return <div className="business-details bd-project-details">
    <IdentityCard item={item} kind="project" status={status} stageItem={stageItem} onConversation={onConversation}>
      <Fields items={[
        ['客户名称', item.customer], ['国家地区', item.region], ['负责人', item.pm], ['交付经理', item.deliveryManager],
        ['所属部门', departmentName(item.departmentId)], ['创建于', <time dateTime={item.createdAt}>{item.createdAt}</time>],
        ['设计类型', displayDesignType(item.designType)], ['设计状态', <StatusTag status={displayDesignStatus(item.designStatus)} />],
      ]} />
      <AmountCards values={[
        { label: '项目金额', value: item.contribution, icon: 'folder', note: '已成交产品商机金额合计' },
        { label: '成单金额', value: closedAmount, icon: 'checkCircle', note: '已成交产品商机的成单金额合计' },
        { label: '实收金额', value: item.collected, icon: 'banknote', note: '产品商机实收金额合计' },
      ]} />
    </IdentityCard>
    <section className="bd-opportunities-section"><div className="bd-section-heading"><h3>商机明细</h3><span>全部 {related.length} 个商机</span><span className="bd-opportunity-counts">已报价 {stats.quoted} · 已成交 {stats.won}</span></div><div className="bd-opportunities-list">{related.map(opportunity => <RelatedOpportunity key={opportunity.id} item={opportunity} onOpportunity={onOpportunity} expanded={!collapsedOpportunityIds.includes(opportunity.id)} onToggle={onToggleOpportunity} />)}</div>{!related.length && <div className="bd-empty">暂无关联商机</div>}</section>
  </div>;
}

function StageProgress({ item }) {
  const stages = ['洽谈中', '报价中', '待下单', '交付中', '已完成'];
  const activeIndex = stages.indexOf(item.status);
  return <section className="bd-card bd-progress-section"><div className="bd-section-heading"><h3>阶段进展</h3><span>进入当前阶段 <time dateTime={item.stageEnteredAt}>{item.stageEnteredAt}</time></span></div>
    <ol className="bd-stage-progress">{stages.map((stage, index) => <li key={stage} className={`${index < activeIndex ? 'bd-stage-completed' : ''}${index === activeIndex ? ' bd-stage-current' : ''}`} aria-current={index === activeIndex ? 'step' : undefined}><span className="bd-stage-node">{index < activeIndex ? <Icon name="check" size={12} /> : index + 1}</span><span className="bd-stage-label">{stage}</span></li>)}</ol>
    {activeIndex < 0 && <div className="bd-special-stage"><StatusTag status={item.status} /><span>{item.status === '待接受' ? '接受后进入洽谈阶段' : item.status === '已拒绝' ? '商机已拒绝' : '商机已结束'}</span></div>}
  </section>;
}

export function OpportunityDetail({ item, onProject, onConversation }) {
  const project = projects.find(project => project.id === item.projectId);
  return <div className="business-details bd-opportunity-details">
    <IdentityCard item={{ ...item, level: project?.level ?? item.level }} kind="opportunity" status={item.status} onConversation={onConversation}>
      <Fields items={[
        ['客户名称', project?.customer], ['国家地区', project?.region], ['方案经理', item.solutionManager], ['项目负责人', project?.pm],
        ['商机部门', item.opportunityDepartment], ['交付经理', project?.deliveryManager], ['商机类型', item.opportunityType], ['创建于', <time dateTime={item.createdAt}>{item.createdAt}</time>],
        ['设计类型', displayDesignType(project?.designType)], ['设计状态', <StatusTag status={displayDesignStatus(project?.designStatus)} />],
        ['报价情况', item.quoted ? '已创建报价' : '暂未报价'], ['报价日期', item.quotedAt ? <time dateTime={item.quotedAt}>{item.quotedAt}</time> : '—'],
      ]} />
      <AmountCards values={opportunityAmounts(item)} />
      {project && <button className="bd-linked-project" onClick={() => onProject(project)}><span className="bd-project-link-label">关联项目</span><span className="bd-project-link-copy"><strong>{project.name}</strong><span><ProjectLevelTag level={project.level} /><StatusTag status={getProjectStatus(project)} /><small>{project.id}</small></span></span><Icon name="chevron" size={17} /></button>}
    </IdentityCard>
    <StageProgress item={item} />
  </div>;
}
