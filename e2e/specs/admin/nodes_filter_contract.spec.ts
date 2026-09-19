import { expect, test, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock, setUiSettingsLocalStorage } from '../../fixtures';

type NodeRequest = { pageUrl: string; searchParams: URLSearchParams };

async function installNodesContractMock(
  page: Page,
  level: number,
  requests: NodeRequest[],
  publicStatusPageUrls: string[]
) {
  await installHaveApiMock(page, {
    user: { id: 1, login: level >= 90 ? 'admin' : 'support', level },
    handlers: {
      'GET nodes/public_status': () => {
        publicStatusPageUrls.push(page.url());
        return [{ domain_name: 'node501.example.test', fqdn: 'node501.example.test', status: true }];
      },
      'GET nodes': (ctx) => {
        requests.push({
          pageUrl: page.url(),
          searchParams: new URLSearchParams(ctx.searchParams),
        });

        return {
          nodes: [
            {
              id: 501,
              domain_name: 'node501.example.test',
              fqdn: 'node501.example.test',
              location: { label: 'dc1' },
            },
          ],
        };
      },
    },
  });
}

test('@pr-smoke @pr-smoke-mobile admin nodes only send filters supported by Node.Index', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await setUiSettingsLocalStorage(page, { language: 'en' });

  const requests: NodeRequest[] = [];
  const publicStatusPageUrls: string[] = [];
  await installNodesContractMock(page, 100, requests, publicStatusPageUrls);

  await page.goto('/admin/nodes?q=brno&q=ignored&state=inactive&issues=1&limit=25&from_id=400&page=3');
  await expect(page.getByTestId('admin.nodes.page')).toBeVisible();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  await expect.poll(() => publicStatusPageUrls.length).toBeGreaterThan(0);

  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === '/admin/nodes' &&
      !url.searchParams.has('q') &&
      !url.searchParams.has('from_id') &&
      url.searchParams.get('state') === 'inactive' &&
      url.searchParams.get('issues') === '1' &&
      url.searchParams.get('limit') === '25' &&
      url.searchParams.get('page') === '1'
    );
  });

  expect(
    requests.every((request) => {
      const pageUrl = new URL(request.pageUrl);
      return (
        !pageUrl.searchParams.has('q') &&
        !pageUrl.searchParams.has('from_id') &&
        !request.searchParams.has('node[q]') &&
        !request.searchParams.has('node[from_id]') &&
        !request.searchParams.has('node[issues]') &&
        request.searchParams.get('node[state]') === 'inactive' &&
        request.searchParams.get('node[limit]') === '25'
      );
    })
  ).toBe(true);
  expect(
    publicStatusPageUrls.every((pageUrl) => {
      const url = new URL(pageUrl);
      return (
        !url.searchParams.has('q') &&
        !url.searchParams.has('from_id') &&
        url.searchParams.get('page') !== '3'
      );
    })
  ).toBe(true);

  await expect(page.getByText('Unsupported node filters removed', { exact: true })).toBeVisible();
  await expect(page.getByTestId('admin.nodes.chip.q')).toHaveCount(0);
  await expect(page.getByTestId('admin.nodes.chip.state')).toBeVisible();
  await expect(page.getByTestId('admin.nodes.chip.issues')).toBeVisible();

  await page.getByRole('button', { name: 'Advanced filters' }).click();
  await expect(page.getByTestId('admin.nodes.advanced.state')).toBeVisible();
  await expect(page.getByTestId('admin.nodes.advanced.q')).toHaveCount(0);
  await page.getByTestId('drawer.close').click();

  await page.getByTestId('admin.nodes.smart_help.open').click();
  await expect(page.getByTestId('admin.nodes.smart_help.key.q')).toHaveCount(0);
  await expect(page.getByTestId('admin.nodes.smart_help.key.state')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('admin.nodes.smart_help')).toHaveCount(0);

  const smartInput = page.getByTestId('admin.nodes.search.input');
  await page.getByTestId('admin.nodes.filter.clear').click();
  await expect(page).toHaveURL((url) => !url.searchParams.has('state') && !url.searchParams.has('issues'));

  const requestCountBeforeCompoundFilter = requests.length;
  await smartInput.fill('state:all issues:true');
  await smartInput.press('Enter');
  await expect(page).toHaveURL((url) => {
    return url.searchParams.get('state') === 'all' && url.searchParams.get('issues') === '1';
  });
  await expect
    .poll(() =>
      requests
        .slice(requestCountBeforeCompoundFilter)
        .some((request) => request.searchParams.get('node[state]') === 'all')
    )
    .toBe(true);

  await smartInput.fill('brno');
  await smartInput.press('Enter');
  await expect(page.getByTestId('admin.nodes.chip.error.0')).toContainText(
    'Text search is not supported. Use issues: or a numeric node ID for “brno”.'
  );
  expect(new URL(page.url()).searchParams.has('q')).toBe(false);
  expect(requests.every((request) => !request.searchParams.has('node[q]'))).toBe(true);

  await smartInput.fill('987');
  await smartInput.press('Enter');
  await expect(page).toHaveURL(/\/admin\/nodes\/987$/);
});

test('@pr-smoke @pr-smoke-mobile support nodes stay active-only across links and smart input', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await setUiSettingsLocalStorage(page, { language: 'en' });

  const requests: NodeRequest[] = [];
  const publicStatusPageUrls: string[] = [];
  await installNodesContractMock(page, 50, requests, publicStatusPageUrls);

  await page.goto('/admin/nodes?state=inactive&issues=1&limit=25&from_id=400&page=3');
  await expect(page.getByTestId('admin.nodes.page')).toBeVisible();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  await expect.poll(() => publicStatusPageUrls.length).toBeGreaterThan(0);

  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === '/admin/nodes' &&
      !url.searchParams.has('state') &&
      !url.searchParams.has('from_id') &&
      url.searchParams.get('issues') === '1' &&
      url.searchParams.get('limit') === '25' &&
      url.searchParams.get('page') === '1'
    );
  });
  expect(
    requests.every(
      (request) =>
        !request.searchParams.has('node[state]') &&
        !request.searchParams.has('node[from_id]') &&
        !request.searchParams.has('node[q]')
    )
  ).toBe(true);
  expect(
    publicStatusPageUrls.every((pageUrl) => {
      const url = new URL(pageUrl);
      return (
        !url.searchParams.has('state') &&
        !url.searchParams.has('from_id') &&
        url.searchParams.get('page') !== '3'
      );
    })
  ).toBe(true);

  await page.getByRole('button', { name: 'Advanced filters' }).click();
  await expect(page.getByTestId('admin.nodes.advanced.state')).toHaveCount(0);
  await expect(page.getByTestId('admin.nodes.advanced.issues')).toBeVisible();
  await page.getByTestId('drawer.close').click();

  await page.getByTestId('admin.nodes.smart_help.open').click();
  await expect(page.getByTestId('admin.nodes.smart_help.key.state')).toHaveCount(0);
  await expect(page.getByTestId('admin.nodes.smart_help.key.issues')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('admin.nodes.smart_help')).toHaveCount(0);

  const smartInput = page.getByTestId('admin.nodes.search.input');
  await smartInput.fill('state:inactive');
  await smartInput.press('Enter');
  await expect(page.getByTestId('admin.nodes.chip.error.0')).toContainText(
    'Only administrators can filter inactive or all nodes.'
  );
  expect(new URL(page.url()).searchParams.has('state')).toBe(false);

  await smartInput.fill('id:988');
  await smartInput.press('Enter');
  await expect(page).toHaveURL(/\/admin\/nodes\/988$/);
});
