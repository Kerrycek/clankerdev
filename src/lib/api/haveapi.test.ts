import { describe, expect, it } from 'vitest';

import { HaveApiError, unwrapSingleResponse } from './haveapi';

describe('unwrapSingleResponse', () => {
  it('throws on status=false', () => {
    expect(() => unwrapSingleResponse({ status: false, message: 'nope' })).toThrow(HaveApiError);
  });

  it('unwraps single namespace and returns meta', () => {
    const r = unwrapSingleResponse<{ foo: number }>({
      status: true,
      response: {
        meta: { elapsed: 1 },
        cluster: { foo: 123 },
      },
    });

    expect(r.data).toEqual({ foo: 123 });
    expect(r.meta).toEqual({ elapsed: 1 });
  });

  it('returns whole response if multiple namespaces are present', () => {
    const r = unwrapSingleResponse<any>({
      status: true,
      response: {
        meta: { elapsed: 1 },
        a: { x: 1 },
        b: { y: 2 },
      },
    });

    expect(r.data).toEqual({ meta: { elapsed: 1 }, a: { x: 1 }, b: { y: 2 } });
  });
});
