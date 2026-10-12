import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { DEFAULT_METRIC_KEYS, METRIC_CATALOG, getMetrics } from '../data.js';
import '../metric-settings.css';

const STORAGE_KEY = 'george-crm.metric-selection.v1';
const MAX_METRICS = 10;
const catalogKeys = new Set(METRIC_CATALOG.map(metric => metric.key));
const amount = value => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value || 0);
const metricAmount = value => value >= 10000 ? (value / 10000).toFixed(1).replace(/\.0$/, '') : amount(value);

function restoreSelection() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    if (stored?.version !== 1 || !Array.isArray(stored.keys)) return [...DEFAULT_METRIC_KEYS];
    const keys = [...new Set(stored.keys)].filter(key => catalogKeys.has(key)).slice(0, MAX_METRICS);
    return keys.length ? keys : [...DEFAULT_METRIC_KEYS];
  } catch {
    return [...DEFAULT_METRIC_KEYS];
  }
}

function MetricSelection({ selected, onSave, onClose }) {
  const [draft, setDraft] = useState(selected);
  const dialog = useRef(null);
  const isFull = draft.length >= MAX_METRICS;

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  const toggle = key => setDraft(current => current.includes(key)
    ? current.filter(item => item !== key)
    : current.length < MAX_METRICS ? [...current, key] : current);
  const closeOutside = event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  };

  return createPortal(<dialog ref={dialog} className="metric-settings-dialog" aria-labelledby="metric-settings-title" aria-describedby="metric-settings-description" onCancel={event => { event.preventDefault(); onClose(); }} onClick={closeOutside}>
    <header className="metric-settings-heading">
      <div><h2 id="metric-settings-title">设置展示卡片</h2><p id="metric-settings-description">选择业务概览中的指标，最多展示 10 张卡片。</p></div>
      <button type="button" className="icon-button" onClick={onClose} aria-label="关闭卡片设置" autoFocus><Icon name="close" size={18} /></button>
    </header>
    <div className="metric-selection-summary">
      <span>可选指标 <b>{METRIC_CATALOG.length}</b></span>
      <span className={`metric-selected-count ${isFull ? 'at-limit' : ''}`} role="status" aria-live="polite">已选 <strong>{draft.length}</strong> / {MAX_METRICS}</span>
    </div>
    <div className="metric-selection-options">
      {METRIC_CATALOG.map(metric => {
        const checked = draft.includes(metric.key);
        const disabled = !checked && isFull;
        return <label key={metric.key} className={`metric-selection-option ${checked ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`} title={disabled ? '已选满 10 张，请先取消一张卡片' : metric.description}>
          <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(metric.key)} />
          <span className={`metric-option-icon ${metric.color}`}><Icon name={metric.icon} size={19} /></span>
          <span className="metric-option-copy"><strong>{metric.label}</strong><small>{DEFAULT_METRIC_KEYS.includes(metric.key) ? '常用指标' : '备选指标'}</small></span>
          <span className="metric-option-check" aria-hidden="true">{checked && <Icon name="check" size={13} strokeWidth={2.2} />}</span>
        </label>;
      })}
    </div>
    <div className="metric-selection-hint" aria-live="polite"><Icon name="help" size={14} /><span>{isFull ? '已选满 10 张，取消一张后即可选择其他指标。' : draft.length === 0 ? '请至少选择一张卡片。' : `还可以选择 ${MAX_METRICS - draft.length} 张卡片，保存后生效。`}</span></div>
    <footer className="metric-settings-actions">
      <button type="button" className="metric-reset-button" onClick={() => setDraft([...DEFAULT_METRIC_KEYS])}><Icon name="refresh" size={14} />恢复默认</button>
      <div><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="button" className="primary-button" disabled={!draft.length} onClick={() => onSave(METRIC_CATALOG.filter(metric => draft.includes(metric.key)).map(metric => metric.key))}>保存设置</button></div>
    </footer>
  </dialog>, document.body);
}

function MetricValue({ metric }) {
  return <span className="metric-value" title={`${metric.value}${metric.unit}`}>
    {metric.unit === '元' && <span className="currency">¥</span>}
    {metric.unit === '元' ? metricAmount(metric.value) : amount(metric.value)}
    {metric.unit === '元' ? metric.value >= 10000 && <small>万</small> : <small>{metric.unit}</small>}
  </span>;
}

export default function Metrics({ filter, onNavigate }) {
  const [selected, setSelected] = useState(restoreSelection);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [notice, setNotice] = useState('');
  const settingsButton = useRef(null);
  const metrics = getMetrics(filter.period, filter.scope, filter);
  const visible = selected.map(key => metrics.find(metric => metric.key === key)).filter(Boolean);
  const rows = [visible.slice(0, 5), visible.slice(5)].filter(row => row.length);
  const closeSettings = () => {
    setIsConfiguring(false);
    window.requestAnimationFrame(() => settingsButton.current?.focus());
  };
  const saveSettings = keys => {
    setSelected(keys);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, keys }));
      setNotice('已保存展示设置');
    } catch {
      setNotice('已更新展示，当前浏览器无法保存设置');
    }
    closeSettings();
  };
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return <section className="panel metrics-section configurable-metrics" aria-label="业务概览">
    <div className="section-heading"><h2>业务概览</h2><div className="metric-heading-actions"><span className="metric-settings-notice" role="status">{notice}</span><button ref={settingsButton} type="button" className="icon-button metric-settings-trigger" title="设置展示卡片" aria-label="设置展示卡片" aria-haspopup="dialog" onClick={() => setIsConfiguring(true)}><Icon name="settings" size={16} /></button></div></div>
    <div className="metric-cards">{rows.map((row, rowIndex) => <div className="metric-card-row" key={rowIndex}>{row.map(metric => <button type="button" className={`metric-card metric-navigation-card ${metric.gradeBreakdown ? 'has-grade-breakdown' : ''}`} key={metric.key} data-metric-key={metric.key} onClick={() => onNavigate?.(metric)} aria-label={`${metric.label}：${amount(metric.value)}${metric.unit}${metric.gradeBreakdown ? `，A 类 ${metric.gradeBreakdown.A} 条` : ''}，查看相关页面`}>
      <span className="metric-label"><span>{metric.label}</span><span className={`metric-icon ${metric.color}`}><Icon name={metric.icon} size={15} /></span></span>
      <span className="metric-main-value"><MetricValue metric={metric} />{metric.gradeBreakdown && <span className="metric-grade-highlight" aria-label={`A 类线索 ${metric.gradeBreakdown.A} 条`} title={`A 类线索 ${metric.gradeBreakdown.A} 条`}><i>A 类</i><b>{amount(metric.gradeBreakdown.A)}</b></span>}</span>
      <span className="metric-footer"><span>较上周期</span><span className={metric.change > 0 ? 'trend-up' : metric.change < 0 ? 'trend-down' : 'trend-flat'}>{metric.change === null ? '—' : `${metric.change > 0 ? '+' : ''}${metric.change}%`}</span></span>
    </button>)}</div>)}</div>
    {isConfiguring && <MetricSelection selected={selected} onSave={saveSettings} onClose={closeSettings} />}
  </section>;
}
