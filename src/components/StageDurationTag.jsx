import Icon from './Icon.jsx';
import { getStageDurationDays } from '../data.js';

export default function StageDurationTag({ item }) {
  return <span className="stage-duration-tag" title={`进入${item.status}：${item.stageEnteredAt}`}>
    <Icon name="clock" size={11} />已停留 {getStageDurationDays(item)} 天
  </span>;
}
