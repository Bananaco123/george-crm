import '../project-levels.css';

export default function ProjectLevelTag({ level }) {
  const grade = ['A', 'B', 'C', 'D'].includes(level) ? level : 'unknown';
  return <span className="project-level-tag" data-level={grade} aria-label={grade === 'unknown' ? '项目未评级' : `项目等级 ${grade} 级`}><b>{grade === 'unknown' ? '—' : grade}</b>{grade === 'unknown' ? '未评级' : '级'}</span>;
}
