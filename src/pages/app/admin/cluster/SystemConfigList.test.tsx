// i18n-ignore-file
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SystemConfigItem } from '../../../../lib/api/systemConfig';
import { SystemConfigList } from './SystemConfigList';

vi.mock('../../../../app/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

const config: SystemConfigItem = {
  category: 'core',
  name: 'api_url',
  type: 'String',
  label: 'API URL',
  value: 'https://example.test',
};

describe('SystemConfigList', () => {
  it('keeps the responsive test ids and opens the same config from both views', () => {
    const onEdit = vi.fn();

    render(
      <SystemConfigList
        configs={[config]}
        showCategory
        valuePreview={(item) => `preview:${item.name}`}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByTestId('admin.cluster.system_config.cards')).toBeInTheDocument();
    expect(screen.getByTestId('admin.cluster.system_config.card.core.api_url')).toBeInTheDocument();
    expect(screen.getByTestId('admin.cluster.system_config.table')).toBeInTheDocument();
    expect(screen.getByTestId('admin.cluster.system_config.row.core.api_url')).toBeInTheDocument();
    expect(screen.getAllByText('preview:api_url')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'common.edit: API URL' }));
    fireEvent.click(screen.getByTestId('admin.cluster.system_config.row.core.api_url.edit'));

    expect(onEdit).toHaveBeenNthCalledWith(1, config);
    expect(onEdit).toHaveBeenNthCalledWith(2, config);
  });

  it('hides only the desktop category column when a category is selected', () => {
    render(
      <SystemConfigList
        configs={[config]}
        showCategory={false}
        valuePreview={() => 'preview'}
        onEdit={vi.fn()}
      />,
    );

    const table = screen.getByTestId('admin.cluster.system_config.table');
    expect(within(table).queryByText('admin.cluster.system_config.col.category')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('admin.cluster.system_config.cards')).getByText('admin.cluster.system_config.col.category')).toBeInTheDocument();
  });
});
