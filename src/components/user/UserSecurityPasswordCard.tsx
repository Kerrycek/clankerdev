import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';
import { useToasts } from '../../app/toasts';
import { updateUser } from '../../lib/api/users';
import { copyTextToClipboard } from '../../lib/clipboard';
import { formatErrorMessage } from '../../lib/errors';
import { generateSecurePassword } from '../../lib/passwordGeneration';

import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Checkbox } from '../ui/Checkbox';
import { CopyButton } from '../ui/CopyButton';
import { Input } from '../ui/Input';

import { buildPasswordChangeReview, buildPasswordPayload, type UserSecurityVariant } from './UserSecurityModel';

export function UserSecurityPasswordCard(props: {
  userId: number;
  variant: UserSecurityVariant;
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const toasts = useToasts();
  const qc = useQueryClient();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [logoutSessions, setLogoutSessions] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const draft = useMemo(
    () => ({ currentPassword, newPassword, newPassword2, logoutSessions }),
    [currentPassword, newPassword, newPassword2, logoutSessions]
  );
  const review = useMemo(() => buildPasswordChangeReview(props.variant, draft), [draft, props.variant]);

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setNewPassword2('');
    setLogoutSessions(true);
  };

  const passwordM = useMutation({
    mutationFn: async () => {
      const nextReview = buildPasswordChangeReview(props.variant, draft);
      if (!nextReview.canSubmit) {
        throw new Error(t(nextReview.validationKey ?? 'security.password.validation.new_required'));
      }

      await updateUser(props.userId, buildPasswordPayload(props.variant, draft));
    },
    onSuccess: async () => {
      reset();
      await qc.invalidateQueries({ queryKey: ['users', props.userId] });
      await qc.invalidateQueries({ queryKey: ['user', 'current'] });
      toasts.pushToast({ variant: 'ok', title: t('security.password.toast.saved.title'), body: t('security.password.toast.saved.body') });
    },
    onError: (e) => {
      toasts.pushToast({ variant: 'danger', title: t('security.password.toast.failed.title'), body: formatErrorMessage(e) });
    },
  });

  const prefix = props.testIdPrefix;

  const generateAndCopy = async () => {
    setIsGenerating(true);

    try {
      const generatedPassword = generateSecurePassword();
      setNewPassword(generatedPassword);
      setNewPassword2(generatedPassword);

      const copied = await copyTextToClipboard(generatedPassword);
      toasts.pushToast({
        variant: copied ? 'ok' : 'warn',
        title: t(
          copied
            ? 'security.password.generated.copied.title'
            : 'security.password.generated.copy_failed.title'
        ),
        body: t(
          copied
            ? 'security.password.generated.copied.body'
            : 'security.password.generated.copy_failed.body'
        ),
      });
    } catch {
      toasts.pushToast({
        variant: 'danger',
        title: t('security.password.generated.failed.title'),
        body: t('security.password.generated.failed.body'),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card testId={`${prefix}.password.card`}>
      <CardHeader
        title={t('security.password.title')}
        subtitle={props.variant === 'profile' ? t('security.password.subtitle_self') : t('security.password.subtitle_admin')}
      />
      <CardBody>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {props.variant === 'profile' ? (
            <div className="md:col-span-2">
              <div className="text-xs font-medium text-muted">{t('security.password.current')}</div>
              <div className="mt-1">
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  testId={`${prefix}.password.current`}
                />
              </div>
            </div>
          ) : null}

          <div>
            <div className="text-xs font-medium text-muted">{t('security.password.new')}</div>
            <div className="mt-1">
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                testId={`${prefix}.password.new`}
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-muted">{t('security.password.new_repeat')}</div>
            <div className="mt-1">
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword2}
                onChange={(e) => setNewPassword2(e.target.value)}
                testId={`${prefix}.password.new2`}
              />
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-faint">{t('security.password.generate.hint')}</div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void generateAndCopy()}
                loading={isGenerating}
                disabled={passwordM.isPending || isGenerating}
                testId={`${prefix}.password.generate`}
              >
                {t('security.password.generate')}
              </Button>

              {newPassword ? (
                <CopyButton
                  text={newPassword}
                  label={t('security.password.copy')}
                  testId={`${prefix}.password.copy`}
                />
              ) : null}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm" data-testid={`${prefix}.password.logout_sessions`}>
              <Checkbox checked={logoutSessions} onCheckedChange={(v) => setLogoutSessions(Boolean(v))} />
              <span>{t('security.password.logout_sessions')}</span>
            </label>
            <div className="mt-1 text-xs text-faint">{t('security.password.logout_sessions.hint')}</div>
          </div>

          <div className="md:col-span-2 flex items-center gap-2">
            <Button
              onClick={() => passwordM.mutate()}
              loading={passwordM.isPending}
              disabled={!review.canSubmit || passwordM.isPending || isGenerating}
              testId={`${prefix}.password.save`}
            >
              {t('common.save')}
            </Button>

            <Button
              variant="secondary"
              onClick={reset}
              disabled={passwordM.isPending || isGenerating}
              testId={`${prefix}.password.reset`}
            >
              {t('common.reset')}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
