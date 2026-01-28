import { IonButton, IonIcon } from '@ionic/react';
import { moonOutline, sunnyOutline } from 'ionicons/icons';

export function ThemeToggleButton({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <IonButton
      fill="clear"
      size="small"
      className="themeToggleButton"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={onToggle}
    >
      <IonIcon slot="icon-only" icon={isDark ? sunnyOutline : moonOutline} />
    </IonButton>
  );
}

