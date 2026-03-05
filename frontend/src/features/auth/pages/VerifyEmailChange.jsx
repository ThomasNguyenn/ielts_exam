import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { api } from '@/shared/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function VerifyEmailChange() {
  const [searchParams] = useSearchParams();
  const token = String(searchParams.get('token') || '').trim();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Verifying your email change...');

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Missing verification token.');
        return;
      }

      try {
        const res = await api.confirmEmailChange(token);
        if (!res?.success) {
          throw new Error('Unable to verify email change');
        }
        await api.logout().catch(() => {
          api.removeToken();
          api.removeUser();
        });
        if (!active) return;
        setStatus('success');
        setMessage('Email updated successfully. Please log in again.');
      } catch (error) {
        if (!active) return;
        setStatus('error');
        setMessage(error?.message || 'Email verification failed. Token may be invalid or expired.');
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-120px)] w-full max-w-xl items-center px-4 py-8">
      <Card className="w-full rounded-xl border-zinc-200 shadow-sm">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-xl">Verify Email Change</CardTitle>
          <CardDescription>Confirming ownership of your new email address.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-center">
            {status === 'loading' ? (
              <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            ) : null}
            {status === 'success' ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            ) : null}
            {status === 'error' ? (
              <XCircle className="h-8 w-8 text-rose-600" />
            ) : null}
            <p className="text-sm text-zinc-700">{message}</p>
          </div>

          <div className="flex justify-center">
            <Button asChild className="rounded-lg">
              <Link to="/login">Go to Login</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
