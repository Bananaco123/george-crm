import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { getPeriodRange, TODAY } from '../data.js';

export default function DateRangeControl({ period, dateRange, onChange }) {
  const root = useRef(null), opener = useRef(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(dateRange);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') { setOpen(false); opener.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    root.current?.querySelector('input')?.focus();
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const apply = event => {
    event.preventDefault();
    if (!draft.start || !draft.end) { setError('请选择开始和结束日期'); return; }
    if (draft.start > draft.end) { setError('开始日期不能晚于结束日期'); return; }
    if (!getPeriodRange('自由筛选', draft)) { setError('日期范围无效，请重新选择'); return; }
    onChange('自由筛选', draft); setOpen(false); opener.current?.focus();
  };
  return <div className="date-range-control" ref={root}>
    <div className="segmented small global-period" aria-label="统计周期">
      {['昨日', '今日', '近7天', '近30天'].map(value => <button key={value} className={value === period ? 'selected' : ''} aria-pressed={value === period} onClick={() => { onChange(value); setOpen(false); }}>{value.replace('7', ' 7 ').replace('30', ' 30 ')}</button>)}
      <button ref={opener} className={period === '自由筛选' ? 'selected' : ''} aria-label="自由筛选" aria-expanded={open} title={period === '自由筛选' ? `${dateRange.start} 至 ${dateRange.end}` : '选择日期范围'} onClick={() => { setDraft(dateRange); setError(''); setOpen(value => !value); }}>{period === '自由筛选' ? `${dateRange.start.slice(5)} 至 ${dateRange.end.slice(5)}` : '自由筛选'}<Icon name="chevronDown" size={12} /></button>
    </div>
    {open && <form className="date-range-popover" onSubmit={apply} aria-label="自由日期筛选">
      <h3>自由筛选</h3>
      <div className="date-range-fields"><label>开始日期<input type="date" max={TODAY} value={draft.start} onChange={event => { setDraft(value => ({ ...value, start: event.target.value })); setError(''); }} /></label><span>至</span><label>结束日期<input type="date" max={TODAY} value={draft.end} onChange={event => { setDraft(value => ({ ...value, end: event.target.value })); setError(''); }} /></label></div>
      {error && <p className="range-error" role="alert">{error}</p>}
      <div className="date-range-actions"><button type="button" className="text-button" onClick={() => { setOpen(false); opener.current?.focus(); }}>取消</button><button className="primary-button" type="submit">应用筛选</button></div>
    </form>}
  </div>;
}
