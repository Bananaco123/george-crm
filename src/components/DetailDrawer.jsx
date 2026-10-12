import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import '../detail-drawer.css';

const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function DetailDrawer({ title, children, onClose, onBack, viewKey, scrollTop = 0, conversation = false }) {
  const panel = useRef(null);
  const body = useRef(null);
  const heading = useRef(null);
  const opener = useRef(document.activeElement);
  const titleId = useId();

  useEffect(() => {
    const previousFocus = opener.current;
    const previousOverflow = document.body.style.overflow;
    const background = [...document.querySelectorAll('.app-shell > .sidebar, .app-shell > .app-main')];
    const previousInert = background.map(element => element.inert);
    background.forEach(element => { element.inert = true; });
    document.body.style.overflow = 'hidden';
    heading.current?.focus({ preventScroll: true });
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...panel.current.querySelectorAll(focusableSelector)].filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); heading.current?.focus(); return; }
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

  useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = scrollTop;
    heading.current?.focus({ preventScroll: true });
  }, [viewKey, scrollTop]);

  return <div className="detail-drawer-layer" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`detail-drawer ${conversation ? 'is-conversation' : ''}`} ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="detail-drawer-header">
        <div className="detail-drawer-heading">{onBack && <button className="detail-drawer-back" type="button" onClick={onBack} aria-label="返回上一级详情" title="返回上一级详情"><Icon name="chevron" className="back-chevron" size={16} /></button>}<h2 ref={heading} id={titleId} tabIndex={-1}>{title}</h2></div>
        <button className="detail-drawer-close" type="button" onClick={onClose} aria-label="关闭详情" title="关闭详情"><Icon name="close" size={21} /></button>
      </header>
      <div className="detail-drawer-body" ref={body}>{children}</div>
    </section>
  </div>;
}
