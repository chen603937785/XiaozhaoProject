async (page) => {
  const assert = (ok, message = 'Assertion failed') => { if (!ok) throw Error(message); };
  assert.equal = (actual, expected) => assert(actual === expected, `${actual} !== ${expected}`);
  assert.deepEqual = (actual, expected) => assert(JSON.stringify(actual) === JSON.stringify(expected), `${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
  const baseline = await page.evaluate(() => window.runCases());
  assert(baseline.results.every(item => item.ok && item.check.ok), JSON.stringify(baseline));
  const results = await page.evaluate(async () => {
    const outcomes = [];
    for (const [id, desired] of [
      ['ph-province', '浙江'],
      ['ph-city', '浙江杭州'],
      ['ph-area', '浙江省杭州市西湖区']
    ]) {
      const root = document.querySelector('#' + id + ' .phoenix-select');
      const result = await XiaomaiControls.fill(root, desired);
      outcomes.push({id, ok: result.ok, check: XiaomaiControls.check(root), selected: XiaomaiControls.value(root)});
    }
    // Reuse an already-open picker from a child branch, then reset to province.
    const root = document.querySelector('#ph-province .phoenix-select');
    await XiaomaiControls.open(root);
    const popup = XiaomaiPhoenix.openPopup(root, '.area-selector-container');
    const row = [...popup.querySelectorAll('.area-item-container')].find(node => node.querySelector('.area-text-label')?.textContent === '浙江省');
    row.querySelector('.area-icon-right.visible').dispatchEvent(new MouseEvent('click', {bubbles: true}));
    await new Promise(resolve => setTimeout(resolve, 100));
    const reopened = await XiaomaiControls.fill(root, '浙江省');
    outcomes.push({id: 'open-child-reset', ok: reopened.ok, selected: XiaomaiControls.value(root)});
    return {outcomes, commits: window.commits, searches: window.searches};
  });
  assert(results.outcomes.every(item => item.ok && (!item.check || item.check.ok)), JSON.stringify(results));
  assert.deepEqual(results.commits.province, ['330000']);
  assert.deepEqual(results.commits.city, ['330100']);
  assert.deepEqual(results.commits.area, ['330106']);
  assert.equal(results.searches, 0);
  const restricted = await page.evaluate(async () => {
    const root = document.querySelector('#ph-restricted .phoenix-select');
    try { await XiaomaiControls.fill(root, '浙江省'); return {unexpectedSuccess: true}; }
    catch (error) { return {reason: error.code, commit: window.commits.restricted || null}; }
  });
  assert.equal(restricted.reason, 'incomplete_cascade');
  assert.equal(restricted.commit, null);
  await page.locator('.area-footer-button').getByText('取消', {exact: true}).click();
  await page.screenshot({path: 'output/playwright/cinda-region-controls.png', fullPage: true});
  return {baseline, results, restricted};
}
