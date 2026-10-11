import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { getConversationContext, getRelatedConversations, conversationReference } from '../conversations.js';

export default function ConversationPanel({ context, initialMode = 'conversation', initialConversationId, onBack }) {
  const related = getRelatedConversations(context);
  const { project, opportunity } = getConversationContext(context);
  const [selectedId, setSelectedId] = useState(initialConversationId || related[0]?.id);
  const [mode, setMode] = useState(initialMode);
  const [focusedId, setFocusedId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const messages = useRef(null);
  const selected = related.find(item => item.id === selectedId) || related[0];
  useEffect(() => {
    if (mode !== 'conversation' || !focusedId) return;
    const frame = requestAnimationFrame(() => messages.current?.querySelector(`[data-message-id="${focusedId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [mode, focusedId]);
  const copyReply = async () => {
    try { await navigator.clipboard.writeText(selected.insight.reply); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  };
  if (!selected) return <div className="conversation-empty">暂未关联会话<button className="text-button" onClick={onBack}>返回详情</button></div>;
  const reference = conversationReference(selected);
  return <div className="conversation-panel">
    <div className="conversation-context"><button className="text-button" onClick={onBack}><Icon name="chevron" className="back-chevron" size={13} />返回详情</button><span>{project.name}</span>{opportunity && <span className="context-opportunity">{opportunity.name}</span>}</div>
    <div className="conversation-layout">
      <aside className="conversation-list"><h3>关联会话 <span>{related.length}</span></h3>{related.map(item => <button key={item.id} className={`conversation-option ${item.id === selected.id ? 'selected' : ''}`} onClick={() => { setSelectedId(item.id); setFocusedId(null); setCopied(false); setCopyError(false); }}><span className="conversation-channel"><Icon name={item.type === 'group' ? 'users' : 'user'} size={14} />{item.type === 'group' ? '项目群' : '客户私聊'}<small>{item.channel}</small></span><strong>{item.title}</strong><small>{item.lastMessage}</small></button>)}</aside>
      <section className="conversation-main">
        <div className="conversation-main-heading"><div><strong>{selected.customer}</strong><span>{selected.channel} · {selected.participants.join('、')}</span></div><div className="segmented"><button className={mode === 'conversation' ? 'selected' : ''} onClick={() => setMode('conversation')}>客户会话</button><button className={mode === 'analysis' ? 'selected' : ''} onClick={() => setMode('analysis')}><Icon name="sparkles" size={14} />AI 销冠</button></div></div>
        {mode === 'conversation' ? <div className="conversation-messages" ref={messages}><div className="conversation-date">{selected.updatedAt}</div>{selected.messages.map(item => <article key={item.id} data-message-id={item.id} className={`conversation-message ${item.direction} ${focusedId === item.id ? 'message-focused' : ''}`}><div className="message-meta"><strong>{item.sender}</strong><time>{item.time}</time></div><p>{item.text}</p></article>)}</div> : <div className="sales-assistant-content" data-context-ref={reference.id}>
          <div className="assistant-context-label"><Icon name="briefcase" size={15} /><span>{opportunity ? opportunity.name : project.name}</span><span className="badge blue">{opportunity?.status || '项目会话'}</span></div>
          <article className="assistant-result"><h3>会话摘要</h3><p>{selected.insight.summary}</p><button className="evidence-link" onClick={() => { setFocusedId(selected.messages[0].id); setMode('conversation'); }}><Icon name="eye" size={13} />查看客户原文</button></article>
          <article className="assistant-result"><h3>下一步建议</h3><p>{selected.insight.next}</p></article>
          <article className="assistant-result reply-result"><div><h3>建议回复</h3><button className="text-button" onClick={copyReply}>{copied ? '已复制' : '复制草稿'}</button></div><p lang="en">{selected.insight.reply}</p><small>{copyError ? '复制未成功，可直接选择上方草稿复制。' : '草稿需人工确认，不会自动发送。'}</small></article>
        </div>}
        <div className="conversation-demo-note">演示会话与规则分析，未连接真实消息或 AI 服务。</div>
      </section>
    </div>
  </div>;
}
