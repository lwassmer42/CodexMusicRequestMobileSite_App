import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonInput,
  IonPage,
  IonToast,
  IonText,
} from '@ionic/react';
import { logoGoogle } from 'ionicons/icons';
import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function appRedirectTo() {
  return `${window.location.origin}${window.location.pathname}`;
}

export function AuthPage() {
  const isConfigured = Boolean(supabase);
  const redirectTo = useMemo(() => appRedirectTo(), []);
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isOauthLoading, setIsOauthLoading] = useState(false);
  const [toast, setToast] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });

  const showToast = (message: string) => setToast({ isOpen: true, message });

  const onEmailLogin = async () => {
    if (!supabase) return;
    const normalized = email.trim();
    if (!normalized) {
      showToast('Enter an email address.');
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      showToast('Check your email for a sign-in link.');
    } catch {
      showToast('Sign-in failed. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const onGoogleLogin = async () => {
    if (!supabase) return;
    setIsOauthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw error;
    } catch {
      showToast('Google sign-in failed. Please try again.');
      setIsOauthLoading(false);
    }
  };

  return (
    <IonPage className="appPage">
      <IonContent fullscreen className="appContent">
        <div className="contentWrap">
          <IonCard className="summaryCard">
            <IonCardContent>
              <h2 style={{ margin: '0 0 6px' }}>Sign in</h2>
              <IonText color="medium">
                Sign in to access your requests across devices.
              </IonText>

              {!isConfigured ? (
                <div style={{ marginTop: 12 }}>
                  <IonText color="danger">
                    Supabase is not configured. Set <code>VITE_SUPABASE_URL</code> and{' '}
                    <code>VITE_SUPABASE_ANON_KEY</code>.
                  </IonText>
                </div>
              ) : (
                <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                  <IonInput
                    value={email}
                    onIonInput={(e) => setEmail(e.detail.value ?? '')}
                    placeholder="Email address"
                    inputMode="email"
                    type="email"
                    fill="outline"
                  />

                  <IonButton expand="block" shape="round" onClick={onEmailLogin} disabled={isSending}>
                    Email sign-in link
                  </IonButton>

                  <IonButton
                    expand="block"
                    shape="round"
                    fill="outline"
                    onClick={onGoogleLogin}
                    disabled={isOauthLoading}
                  >
                    <IonIcon slot="start" icon={logoGoogle} />
                    Continue with Google
                  </IonButton>
                </div>
              )}
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>

      <IonToast
        isOpen={toast.isOpen}
        message={toast.message}
        duration={2500}
        position="bottom"
        onDidDismiss={() => setToast((t) => ({ ...t, isOpen: false }))}
      />
    </IonPage>
  );
}
