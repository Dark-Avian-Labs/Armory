import type { IncarnonData, IncarnonSelection } from '../../types/incarnon';
import { IncarnonUpgradeBar } from './IncarnonUpgradeBar';

interface IncarnonUpgradePanelProps {
  incarnonData: IncarnonData;
  selections: IncarnonSelection[];
  incarnonEnabled: boolean;
  activeTier: number | null;
  onTierClick: (tier: number) => void;
  readOnly?: boolean;
}

export function IncarnonUpgradePanel(props: IncarnonUpgradePanelProps) {
  if (!props.incarnonEnabled) return null;

  return (
    <div className="glass-panel p-4">
      <IncarnonUpgradeBar {...props} />
    </div>
  );
}
