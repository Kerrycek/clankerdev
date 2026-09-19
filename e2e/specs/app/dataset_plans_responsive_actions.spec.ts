import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test('@pr-smoke @pr-smoke-mobile @smoke-mobile dataset plan removal stays reachable on mobile', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  if (mobile) await page.setViewportSize({ width: 320, height: 900 });

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 1 },
    handlers: {
      'GET datasets': () => ({
        datasets: [
          {
            id: 42,
            full_name: 'tank/users/alice',
            name: 'alice',
            environment: { id: 7, label: 'Production with a deliberately long label' },
            object_state: 'active',
            user: { id: 10, login: 'alice' },
          },
        ],
        _meta: { total_count: 1 },
      }),
      'GET datasets/42': () => ({
        dataset: {
          id: 42,
          full_name: 'tank/users/alice',
          name: 'alice',
          environment: { id: 7, label: 'Production with a deliberately long label' },
          object_state: 'active',
        },
      }),
      'GET transaction_chains': () => ({ transaction_chains: [] }),
      'GET datasets/42/plans': () => ({
        plans: [
          {
            id: 2,
            environment_dataset_plan: {
              id: 12,
              label: 'Daily backup with a deliberately long operator-facing name',
              dataset_plan: {
                id: 3,
                label: 'daily_backup_with_a_deliberately_long_technical_name',
                description: 'A deliberately long description that still needs to remain readable on a narrow phone.',
              },
              user_add: true,
              user_remove: true,
            },
          },
          {
            id: 4,
            environment_dataset_plan: {
              id: 14,
              label: 'Protected weekly backup',
              dataset_plan: { id: 5, label: 'protected_weekly', description: 'A protected plan.' },
              user_add: false,
              user_remove: false,
            },
          },
        ],
      }),
      'GET environments/7/dataset_plans': () => ({ dataset_plans: [] }),
    },
  });

  await page.goto('/app/datasets/42/plans');

  const table = page.getByTestId('dataset.plans.table');
  const cards = page.getByTestId('dataset.plans.cards');
  const card = page.getByTestId('dataset.plans.card.2');
  const desktopRow = page.getByTestId('dataset.plans.row.2');
  const entry = mobile ? card : desktopRow;
  const remove = page.getByTestId(mobile ? 'dataset.plans.card.2.remove' : 'dataset.plans.row.2.remove');
  const restrictedEntry = mobile ? page.getByTestId('dataset.plans.card.4') : page.getByTestId('dataset.plans.row.4');

  await expect(entry).toBeVisible();
  await expect(entry).toContainText('Daily backup with a deliberately long operator-facing name');
  await expect(entry).toContainText('daily_backup_with_a_deliberately_long_technical_name');
  await expect(entry).toContainText('A deliberately long description that still needs to remain readable on a narrow phone.');
  await expect(entry).toContainText('User can add');
  await expect(entry).toContainText('User can remove');
  await expect(restrictedEntry).toContainText('Removal restricted');
  await expect(restrictedEntry.getByRole('button', { name: /Remove/ })).toHaveCount(0);

  if (mobile) {
    await expect(cards).toBeVisible();
    await expect(table).toBeHidden();
    await card.scrollIntoViewIfNeeded();
    await expectNoDocumentHorizontalOverflow(page);

    const cardMetrics = await card.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(cardMetrics.scrollWidth).toBeLessThanOrEqual(cardMetrics.clientWidth);

    await expect(remove).toBeInViewport();
    await expect(remove).toHaveAccessibleName('Remove: Daily backup with a deliberately long operator-facing name');
    const removeBox = await remove.boundingBox();
    expect(removeBox).not.toBeNull();
    expect(removeBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(removeBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((removeBox?.x ?? 0) + (removeBox?.width ?? 0)).toBeLessThanOrEqual(320);
  } else {
    await expect(cards).toBeHidden();
    await expect(table).toBeVisible();
  }

  await remove.click();
  const confirm = page.getByTestId('dataset.plans.remove.confirm');
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('Daily backup with a deliberately long operator-facing name');
  await page.getByTestId('dataset.plans.remove.confirm.cancel').click();
  await expect(confirm).toBeHidden();

  if (!mobile) {
    const list = page.getByTestId('dataset.plans.list');
    await list.evaluate((element) => {
      element.style.width = '700px';
    });
    await expect(cards).toBeVisible();
    await expect(table).toBeHidden();

    const constrainedCard = page.getByTestId('dataset.plans.card.2');
    const constrainedRemove = page.getByTestId('dataset.plans.card.2.remove');
    const [listBox, actionBox] = await Promise.all([list.boundingBox(), constrainedRemove.boundingBox()]);
    expect(listBox).not.toBeNull();
    expect(actionBox).not.toBeNull();
    expect(actionBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(actionBox?.x ?? -1).toBeGreaterThanOrEqual(listBox?.x ?? 0);
    expect((actionBox?.x ?? 0) + (actionBox?.width ?? 0)).toBeLessThanOrEqual(
      (listBox?.x ?? 0) + (listBox?.width ?? 0),
    );
    const cardMetrics = await constrainedCard.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(cardMetrics.scrollWidth).toBeLessThanOrEqual(cardMetrics.clientWidth);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/app/backups?tab=plans&dataset=42');
    const embeddedWorkspace = page.getByTestId('backups.plans.workspace');
    const embeddedCards = embeddedWorkspace.getByTestId('dataset.plans.cards');
    const embeddedTable = embeddedWorkspace.getByTestId('dataset.plans.table');
    const embeddedRemove = embeddedWorkspace.getByTestId('dataset.plans.card.2.remove');
    await expect(embeddedCards).toBeVisible();
    await expect(embeddedTable).toBeHidden();
    await embeddedRemove.scrollIntoViewIfNeeded();
    await expect(embeddedRemove).toBeInViewport();
    const embeddedActionBox = await embeddedRemove.boundingBox();
    expect(embeddedActionBox).not.toBeNull();
    expect(embeddedActionBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expectNoDocumentHorizontalOverflow(page);
  }
});
