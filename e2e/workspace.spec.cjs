const { expect, test } = require('@playwright/test');

test.describe('desktop campaign workflow', () => {
test.skip(({ isMobile }) => isMobile, 'Campaign creation is covered in the desktop flow; mobile coverage focuses on drawer and dialog behavior.');
test('GM can create a live campaign and open the character workflow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /server access/i }).first().click();
  await page.getByRole('heading', { name: /create a live campaign/i }).waitFor();
  await page.getByLabel('Campaign name').fill('Browser E2E Campaign');
  await page.getByRole('button', { name: /create campaign/i }).click();
  await expect(page.getByRole('heading', { name: /campaign overview/i })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Characters', exact: true }).click();
  await page.getByRole('button', { name: /add character/i }).first().click();
  await page.getByLabel('Character name').fill('Browser Hero');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Ancestry').selectOption({ label: 'Human' });
  await page.getByLabel('Class').selectOption({ label: 'Bard' });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create character' }).click();
  await expect(page.getByRole('heading', { name: 'Browser Hero' })).toBeVisible();
});
});

test('mobile navigation and Help are keyboard reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open help' }).click();
  await expect(page.getByRole('dialog', { name: /daggerforge help/i })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /daggerforge help/i })).toBeHidden();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.getByRole('button', { name: 'Overview' }).click();
  await expect(page.locator('.sidebar.open')).toHaveCount(0);
});

test('player join flow is scoped to player tools and can claim a character', async ({ page, request }) => {
  const createdResponse = await request.post('http://127.0.0.1:8787/api/campaigns', { data: { name: 'Player Browser Campaign' } });
  const created = await createdResponse.json();
  const characterResponse = await request.post('http://127.0.0.1:8787/api/campaigns/' + created.campaign.id + '/characters', {
    headers: { authorization: 'Bearer ' + created.gmToken },
    data: { name: 'Player Browser Hero', className: 'Bard', ancestry: 'Human' },
  });
  expect(characterResponse.ok()).toBeTruthy();
  await page.goto('/?campaign=' + encodeURIComponent(created.campaign.id) + '&token=' + encodeURIComponent(created.playerToken));
  await page.getByLabel('Nickname').fill('Browser Player');
  await page.getByRole('button', { name: 'Join campaign' }).click();
  await expect(page.getByRole('heading', { name: 'Player workspace' })).toBeVisible({ timeout: 15000 });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Player workspace' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'GM Library', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Participants', exact: true })).toHaveCount(0);
  if (page.viewportSize().width < 760) await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Characters', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Claim character' })).toBeVisible();
  await page.getByRole('button', { name: 'Claim character' }).click();
  await expect(page.getByText('Player Browser Hero')).toBeVisible();
});
