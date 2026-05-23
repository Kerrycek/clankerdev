import React from 'react';
import { render, screen } from '@testing-library/react';

import { Table } from './Table';

describe('Table', () => {
  it('uses tabular numerals by default for numeric scanability', () => {
    render(
      <Table testId="t">
        <tbody>
          <tr>
            <td>123</td>
          </tr>
        </tbody>
      </Table>
    );

    expect(screen.getByTestId('t')).toHaveClass('tabular-nums');
  });

  it('uses list variant styling by default', () => {
    render(
      <Table testId="t">
        <tbody>
          <tr>
            <td>Row</td>
          </tr>
        </tbody>
      </Table>
    );

    expect(screen.getByTestId('t')).toHaveClass('table-list');
  });
});
