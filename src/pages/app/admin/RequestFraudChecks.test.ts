import { describe, expect, test } from 'vitest';

import type { RegistrationRequest } from '../../../lib/api/requests';
import { requestFraudRiskSummary } from './RequestFraudChecks';

function request(values: Partial<RegistrationRequest>): RegistrationRequest {
  return values as RegistrationRequest;
}

describe('request fraud risk summary', () => {
  test('presents completed low scores as clear', () => {
    expect(requestFraudRiskSummary(request({
      ip_checked: true,
      ip_success: true,
      ip_fraud_score: 0,
      mail_checked: true,
      mail_success: true,
      mail_fraud_score: 45,
    }))).toEqual({ state: 'clear', variant: 'ok', maxScore: 45 });
  });

  test('makes elevated and high scores visibly actionable', () => {
    expect(requestFraudRiskSummary(request({
      ip_checked: true,
      ip_success: true,
      ip_fraud_score: 52,
      mail_checked: true,
      mail_success: true,
      mail_fraud_score: 12,
    }))).toEqual({ state: 'elevated', variant: 'warn', maxScore: 52 });

    expect(requestFraudRiskSummary(request({
      ip_checked: true,
      ip_success: true,
      ip_fraud_score: 87,
      mail_checked: true,
      mail_success: true,
      mail_fraud_score: 100,
    }))).toEqual({ state: 'high', variant: 'danger', maxScore: 100 });
  });

  test('does not present incomplete checks as clear', () => {
    expect(requestFraudRiskSummary(request({
      ip_checked: false,
      mail_checked: true,
      mail_success: true,
      mail_fraud_score: 10,
    }))).toEqual({ state: 'pending', variant: 'warn', maxScore: 10 });

    expect(requestFraudRiskSummary(request({
      ip_checked: true,
      ip_success: false,
      mail_checked: true,
      mail_success: true,
      mail_fraud_score: 10,
    }))).toEqual({ state: 'failed', variant: 'danger', maxScore: 10 });
  });
});
