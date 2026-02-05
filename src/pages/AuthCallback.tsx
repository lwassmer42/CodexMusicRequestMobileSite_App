import { IonContent, IonPage, IonSpinner, IonText } from '@ionic/react';
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

function clearAuthParamsFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('error');
  url.searchParams.delete('error_code');
  url.searchParams.delete('error_description');
  window.history.replaceState({}, document.title, `${url.pathname}${url.hash}`);
}

export function AuthCallbackPage() {
  const history = useHistory();
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    if (!supabase) {
      history.replace('/home');
      return;
    }

    const errorDescription = new URLSearchParams(window.location.search).get('error_description');
    if (errorDescription) setMessage(decodeURIComponent(errorDescription));

    let didNavigate = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (didNavigate) return;
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        didNavigate = true;
        clearAuthParamsFromUrl();
        history.replace('/home');
      }
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (didNavigate) return;
        if (data.session) {
          didNavigate = true;
          clearAuthParamsFromUrl();
          history.replace('/home');
        }
      })
      .catch(() => {
        if (didNavigate) return;
        setMessage('Sign-in failed. Please try again.');
      });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [history]);

  return (
    <IonPage className="appPage">
      <IonContent fullscreen className="appContent">
        <div className="contentWrap" style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
          <div style={{ textAlign: 'center' }}>
            <IonSpinner />
            <div style={{ marginTop: 12 }}>
              <IonText color="medium">{message}</IonText>
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}

