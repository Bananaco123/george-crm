import Icon from './Icon.jsx';
import { CRM_PAGES, conditionEntries } from '../navigation.js';

export default function DestinationPage({ route, onBack, onDetail }) {
  const conditions = conditionEntries(route.conditions);
  return <main className="workspace destination-workspace">
    <div className="destination-heading"><h1>{CRM_PAGES[route.page]}</h1><button className="secondary-button" onClick={onBack}><Icon name="arrow" className="back-chevron" size={15} />返回工作台</button></div>
    <section className="panel destination-panel">
      <span className="destination-icon"><Icon name="filter" size={24} /></span>
      <h2>已跳转到{CRM_PAGES[route.page]}</h2>
      <p>携带条件筛选，跳转到相关页面。本页仅展示跳转与筛选条件，暂不加载业务列表。</p>
      {conditions.length ? <dl className="destination-filters">{conditions.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <div className="destination-default">当前未附加筛选条件。</div>}
      {onDetail && <button className="primary-button" onClick={onDetail}>查看关联详情<Icon name="arrow" size={14} /></button>}
    </section>
  </main>;
}
