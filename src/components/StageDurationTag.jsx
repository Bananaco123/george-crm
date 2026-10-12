import Icon from './Icon.jsx';
import { getStageDurationDays } from '../data.js';

export default function StageDurationTag({ item }) {
  const days = getStageDurationDays(item);
  const overdue = days >= 10;
  return <span className={`stage-duration-tag ${overdue ? 'is-overdue' : ''}`} title={`进入${item.status}：${item.stageEnteredAt}`}>
    <Icon name={overdue ? 'warning' : 'clock'} size={11} />{days === 0 ? '停留不足 1 天' : `已停留 ${days} 天`}{overdue && <b>超时</b>}
  </span>;
}
