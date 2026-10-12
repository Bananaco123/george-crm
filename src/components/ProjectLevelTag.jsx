export default function ProjectLevelTag({ level }) {
  return <span className="project-level-tag" aria-label={`项目等级 ${level || 'C'} 级`}>{level || 'C'} 级项目</span>;
}
