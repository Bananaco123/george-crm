import { useEffect, useId, useState } from 'react';
import Icon from './Icon.jsx';
import { getPeriodRange, TODAY } from '../data.js';

export default function DateRangeControl({ period, dateRange, onChange }) {
  const activeRange = getPeriodRange(period, dateRange);
  const [draft, setDraft] = useState(activeRange);
  const [error, setError] = useState('');
  const errorId = useId();

  useEffect(() => {
    setDraft({ start: activeRange.start, end: activeRange.end });
    setError('');
  }, [activeRange.start, activeRange.end]);

  const selectPreset = value => {
    setDraft(getPeriodRange(value));
    setError('');
    onChange(value);
  };
  const changeDate = (field, value) => {
    const next = { ...draft, [field]: value };
    setDraft(next);
    if (!next.start || !next.end) { setError('请选择完整的起止日期'); return; }
    if (next.start > next.end) { setError('开始日期不能晚于结束日期'); return; }
    if (next.end > TODAY) { setError('结束日期不能晚于今天'); return; }
    if (!getPeriodRange('自由筛选', next)) { setError('日期范围无效，请重新选择'); return; }
    setError('');
    onChange('自由筛选', next);
  };
  const dateField = (field, label) => <label className={`range-date-field ${error ? 'has-error' : ''}`}>
    <span aria-hidden="true">{draft[field] ? draft[field].replaceAll('-', '/') : label}</span>
    <Icon name="calendar" size={14} />
    <input type="date" aria-label={label} title={label} max={TODAY} value={draft[field]}
      aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
      onChange={event => changeDate(field, event.target.value)}
      onClick={event => { try { event.currentTarget.showPicker?.(); } catch { /* Native keyboard editing remains available. */ } }}
      onKeyDown={event => { if (event.key === 'Escape') { setDraft(activeRange); setError(''); } }} />
  </label>;

  return <div className="date-range-control inline-date-range">
    <div className="segmented small global-period" aria-label="统计周期">
      {['昨日', '今日', '近7天', '近30天'].map(value => <button key={value} type="button"
        className={value === period ? 'selected' : ''} aria-pressed={value === period}
        onClick={() => selectPreset(value)}>{value}</button>)}
    </div>
    <div className="inline-date-fields" role="group" aria-label="自由日期筛选">
      {dateField('start', '开始日期')}<span className="date-range-separator">至</span>{dateField('end', '结束日期')}
      {error && <p id={errorId} className="inline-range-error" role="alert">{error}</p>}
    </div>
  </div>;
}
