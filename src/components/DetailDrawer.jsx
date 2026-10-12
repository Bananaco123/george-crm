import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import '../detail-drawer.css';

const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function DrawerPane({ title, children, onClose, onBack, backLabel = '返回上一级详情', viewKey, scrollTop = 0, conversation = false, secondary = false }) {
  const panel = useRef(null);
  const body = useRef(null);
  const heading = useRef(null);
  const opener = useRef(document.activeElement);
  const titleId = useId();

  useEffect(() => () => {
    if (secondary && opener.current?.isConnected) opener.current.focus({ preventScroll: true });
  }, [secondary]);

  useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = scrollTop;
    heading.current?.focus({ preventScroll: true });
  }, [viewKey, scrollTop]);

  return <section className={`detail-drawer detail-drawer-${secondary ? 'secondary' : 'primary'} ${conversation ? 'is-conversation' : ''}`} ref={panel} role="region" aria-labelledby={titleId}>
    <header className="detail-drawer-header">
      <div className="detail-drawer-heading">{onBack && <button className="detail-drawer-back" type="button" onClick={onBack} aria-label={backLabel} title={backLabel}><Icon name="chevron" className="back-chevron" size={16} /></button>}<h2 ref={heading} id={titleId} tabIndex={-1}>{title}</h2>{secondary && <span className="detail-drawer-level">关联详情</span>}</div>
      <button className="detail-drawer-close" type="button" onClick={onClose} aria-label={secondary ? '关闭二级详情' : '关闭详情'} title={secondary ? '关闭二级详情' : '关闭详情'}><Icon name="close" size={20} /></button>
    </header>
    <div className="detail-drawer-body" ref={body}>{children}</div>
  </section>;
}

export default function DetailDrawer({ title, children, onClose, onBack, viewKey, scrollTop = 0, conversation = false, secondary }) {
  const stack = useRef(null);
  const opener = useRef(document.activeElement);
  const activeClose = useRef(onClose);
  activeClose.current = secondary?.onClose ?? onClose;

  useEffect(() => {
    const previousFocus = opener.current;
    const previousOverflow = document.body.style.overflow;
    const background = [...document.querySelectorAll('.app-shell > .sidebar, .app-shell > .app-main')];
    const previousInert = background.map(element => element.inert);
    background.forEach(element => { element.inert = true; });
    document.body.style.overflow = 'hidden';
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); activeClose.current(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...stack.current.querySelectorAll(focusableSelector)].filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      background.forEach((element, index) => { element.inert = previousInert[index]; });
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [onClose]);

  return <div className="detail-drawer-layer" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={`detail-drawer-stack ${secondary ? 'has-secondary' : ''}`} ref={stack} role="dialog" aria-modal="true" aria-label={secondary ? `${title}与${secondary.title}` : title}>
      {secondary && <DrawerPane key="secondary" {...secondary} secondary />}
      <DrawerPane key="primary" title={title} onClose={onClose} onBack={onBack} viewKey={viewKey} scrollTop={scrollTop} conversation={conversation}>{children}</DrawerPane>
    </div>
  </div>;
}
