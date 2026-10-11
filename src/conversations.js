import { projects, opportunities, TODAY } from './data.js';

// 参考 GOS 会话结构建立独立演示记录。客户、项目和商机不会共用其他客户的历史消息。
const scenarios = {
  '待接受': { request: 'We would like to discuss the scope and material options before moving forward.', summary: '客户希望先确认需求范围和材质选项，尚未进入正式洽谈。', next: '确认负责人接受商机，收集图纸与采购范围。', reply: 'Thank you for your enquiry. Please share the floor plans and your preferred materials so we can review the scope with you.' },
  '已拒绝': { request: 'This scope is outside our current project. Please put this enquiry on hold.', summary: '客户说明本次需求不在当前项目范围内。', next: '记录不匹配的范围，确认是否存在可单独跟进的新需求。', reply: 'Thank you for clarifying. We will keep this enquiry on hold. Please let us know if the project scope changes.' },
  '洽谈中': { request: 'Could you share the available materials and finish options? We will confirm the measurements before requesting a quotation.', summary: '客户在确认材质、饰面与尺寸，尚未要求正式报价。', next: '收集尺寸与饰面偏好，再明确可报价范围；此阶段尚无订单或收款。', reply: 'Thank you. We can prepare material and finish options for your review. Please share the confirmed measurements and any reference images before we prepare the quotation.' },
  '报价中': { request: 'Please revise the quotation with the selected finishes. Could you list shipping and installation separately and confirm the lead time?', summary: '客户要求按已选饰面修订报价，并单列运输、安装与交期。', next: '复核报价版本、费用范围和交期，发送前由方案经理确认；尚无实收金额。', reply: 'Thank you for the feedback. We will revise the quotation with the selected finishes and list shipping and installation separately. We will also confirm the lead time in the updated version.' },
  '待下单': { request: 'The quotation looks good. Please confirm the final specifications and payment schedule before we place the order.', summary: '客户认可报价，要求下单前核对最终规格与付款安排。', next: '确认规格及付款条件，待实际收款和生产确认后推进交付。', reply: 'Thank you for reviewing the quotation. We will confirm the final specifications and payment schedule with you before proceeding with the order.' },
  '交付中': { request: 'Could you share the latest production update and the expected delivery schedule? Our site team needs to coordinate installation.', summary: '客户关注生产进度、交付时间与现场安装配合。', next: '向交付经理核实生产和物流节点，再同步可确认的交付计划。', reply: 'Thank you. We are checking the latest production and logistics updates with our delivery team. We will share the confirmed schedule so your site team can coordinate installation.' },
  '已完成': { request: 'The installation is complete. Please send the care instructions and warranty information for our records.', summary: '客户确认安装完成，需要保养说明和质保资料。', next: '整理已交付产品的保养与质保资料，并确认客户签收。', reply: 'Thank you for confirming completion. We will prepare the care instructions and warranty information for your records. Please let us know if any further support is needed.' },
  '已输单': { request: 'We have decided to proceed with another supplier for this scope. Thank you for your time and proposal.', summary: '客户明确本次范围选择其他供应商。', next: '记录输单原因和客户反馈，不将该商机自动恢复或改写其他商机状态。', reply: 'Thank you for letting us know and for considering our proposal. We appreciate the opportunity and would be glad to support future projects.' },
};

function message(conversationId, index, direction, sender, text, time) {
  return { id: `${conversationId}-m${index}`, type: 'text', direction, sender, text, time, status: 'read' };
}

export const conversations = projects.flatMap(project => {
  const related = opportunities.filter(item => item.projectId === project.id);
  const groupId = `conversation-${project.id}`;
  const group = {
    id: groupId, projectId: project.id, opportunityIds: related.map(item => item.id),
    accountId: `wa-${project.responsibleEmployeeId}`, type: 'group', channel: 'WhatsApp',
    title: `${project.name} · 项目群`, customer: project.customer,
    participants: [project.customer, project.pm, project.deliveryManager],
    messages: [
      message(groupId, 1, 'in', project.customer, `For ${project.name}, please keep the scope, finish samples and delivery arrangements in this group so our team can review them together.`, '09:10'),
      message(groupId, 2, 'out', project.pm, 'We will keep a separate record for each scope and confirm any specification or quotation changes with you before proceeding.', '09:18'),
      message(groupId, 3, 'in', project.customer, 'Thank you. Please send the current documents and highlight any items that still need our confirmation.', '09:24'),
    ],
    insight: { summary: '客户要求在项目群集中沟通采购范围、色板与交付安排，并标出待确认事项。', next: '按商机整理当前有效资料，分别列出已确认项和待客户确认项。', reply: 'Thank you. We will organise the current documents by scope and clearly highlight the items that need your confirmation.' },
  };
  const direct = related.map(item => {
    const id = `conversation-${item.id}`, scenario = scenarios[item.status];
    return {
      id, projectId: project.id, opportunityIds: [item.id],
      accountId: `wa-${item.responsibleEmployeeId}`, type: 'private', channel: 'WhatsApp',
      title: `${project.customer} · ${item.name}`, customer: project.customer,
      participants: [project.customer, item.solutionManager],
      messages: [
        message(id, 1, 'in', project.customer, `Regarding ${item.name}: ${scenario.request}`, '10:06'),
        message(id, 2, 'out', item.solutionManager, 'Thank you. I have noted your requirements and will coordinate the next update with the project team.', '10:12'),
        message(id, 3, 'in', project.customer, 'Please keep me updated here. Thank you.', '10:15'),
      ],
      insight: scenario,
    };
  });
  return [group, ...direct].map(item => ({ ...item, updatedAt: TODAY, lastMessage: item.messages.at(-1).text }));
});

export function getConversationContext(context) {
  const opportunity = context.kind === 'opportunity' ? opportunities.find(item => item.id === context.id) : null;
  const project = projects.find(item => item.id === (opportunity?.projectId || context.id));
  return { project, opportunity };
}

export function getRelatedConversations(context) {
  const { project, opportunity } = getConversationContext(context);
  return conversations.filter(item => item.projectId === project?.id && (!opportunity || item.opportunityIds.includes(opportunity.id)))
    .sort((a, b) => opportunity ? Number(a.type === 'group') - Number(b.type === 'group') : Number(b.type === 'group') - Number(a.type === 'group'));
}

export function conversationReference(conversation) {
  return { id: `scrm-${conversation.id}`, type: conversation.type === 'group' ? 'group' : 'conversation', conversationId: conversation.id, accountId: conversation.accountId, label: conversation.title };
}
