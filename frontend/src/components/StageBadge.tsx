export function StageBadge({ stage }: { stage: string }) {
  return <span className="mono stage-badge">{stage.replace(/_/g, ' ')}</span>
}
