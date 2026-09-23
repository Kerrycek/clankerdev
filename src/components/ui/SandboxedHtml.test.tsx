// i18n-ignore-file
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SandboxedHtml } from './SandboxedHtml';

describe('SandboxedHtml network isolation', () => {
  it('places a restrictive CSP before resources in an HTML fragment', () => {
    render(<SandboxedHtml html={'<img src="https://tracker.example/pixel">'} testId="preview" />);

    const srcDoc = screen.getByTestId('preview').getAttribute('srcdoc') ?? '';
    expect(srcDoc).toContain("default-src 'none'");
    expect(srcDoc).toContain('img-src data: blob:');
    expect(srcDoc.indexOf('Content-Security-Policy')).toBeLessThan(srcDoc.indexOf('tracker.example'));
  });

  it('rebuilds a full document with the CSP before its original head and body', () => {
    render(
      <SandboxedHtml
        html={'<!doctype html><html><head><link rel="stylesheet" href="https://tracker.example/style.css"><style>p{color:red}</style></head><body><p>Preview</p><img src="https://tracker.example/pixel"></body></html>'}
        testId="full-preview"
      />
    );

    const srcDoc = screen.getByTestId('full-preview').getAttribute('srcdoc') ?? '';
    expect(srcDoc.indexOf('Content-Security-Policy')).toBeLessThan(srcDoc.indexOf('tracker.example'));
    expect(srcDoc).toContain('<style>p{color:red}</style>');
    expect(srcDoc).toContain('<p>Preview</p>');
  });
});
