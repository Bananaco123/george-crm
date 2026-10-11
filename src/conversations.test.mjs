import test from 'node:test';
import assert from 'node:assert/strict';
import { projects, opportunities } from './data.js';
import { conversations, getRelatedConversations, getConversationContext, conversationReference } from './conversations.js';

test('会话和消息标识唯一，项目详情只关联本项目客户', () => {
  assert.equal(new Set(conversations.map(item => item.id)).size, conversations.length);
  const messages = conversations.flatMap(item => item.messages);
  assert.equal(new Set(messages.map(item => item.id)).size, messages.length);
  for (const project of projects) {
    const related = getRelatedConversations({ kind: 'project', id: project.id });
    assert.ok(related.length >= 1);
    assert.ok(related.every(item => item.projectId === project.id && item.customer === project.customer));
    assert.ok(related.every(item => item.messages.filter(message => message.direction === 'in').every(message => message.sender === project.customer)));
  }
});

test('商机上下文只包含本商机私聊和所属项目群，销冠引用可定位真实消息', () => {
  for (const opportunity of opportunities) {
    const context = { kind: 'opportunity', id: opportunity.id };
    assert.equal(getConversationContext(context).project.id, opportunity.projectId);
    const related = getRelatedConversations(context);
    assert.equal(related.length, 2);
    assert.equal(related[0].type, 'private');
    assert.ok(related.every(item => item.projectId === opportunity.projectId && item.opportunityIds.includes(opportunity.id)));
    for (const conversation of related) {
      const reference = conversationReference(conversation);
      assert.equal(reference.id, `scrm-${conversation.id}`);
      assert.equal(reference.conversationId, conversation.id);
      assert.ok(conversation.messages[0].id && conversation.insight.summary && conversation.insight.reply);
    }
  }
});
