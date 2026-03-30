import { test, expect } from '@playwright/test';

const TEST_PAPER_ID = '66ed061d-6610-447f-aa03-3f2729a8b35a';

test.describe('PDF Viewer E2E Tests', () => {
  test('PDF viewer should load and display PDF content', async ({ page }) => {
    // Track network requests
    const requests: { url: string; status: number }[] = [];
    page.on('response', res => {
      requests.push({ url: res.url(), status: res.status() });
    });

    // Capture console
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Navigate
    await page.goto(`/paper/${TEST_PAPER_ID}`);
    await page.waitForLoadState('networkidle');

    // Wait for PDF to load
    await page.waitForTimeout(8000);

    // Check worker request
    const workerRequests = requests.filter(r => r.url.includes('worker'));
    const workerOk = workerRequests.some(r => r.status === 200);

    // Check PDF API requests
    const pdfApiRequests = requests.filter(r => r.url.includes('/api/paper') && r.url.includes('/pdf'));
    const pdfApiOk = pdfApiRequests.some(r => r.status === 200);

    // Check canvas
    const canvasCount = await page.locator('canvas').count();

    // Check loading text - should NOT be visible
    const loadingVisible = await page.locator('text=Loading PDF...').isVisible();

    // Check page number display (format: "X / Y")
    const pageNumberVisible = await page.locator('text=/\\d+ \\//').isVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/pdf-final-test.png', fullPage: true });

    console.log('\n=== Test Results ===');
    console.log(`Worker loaded: ${workerOk}`);
    console.log(`PDF API called: ${pdfApiOk}`);
    console.log(`Canvas count: ${canvasCount}`);
    console.log(`Loading visible: ${loadingVisible}`);
    console.log(`Page number visible: ${pageNumberVisible}`);

    // Assertions
    expect(workerOk).toBe(true);
    expect(pdfApiOk).toBe(true);
    expect(canvasCount).toBeGreaterThan(0);
    expect(loadingVisible).toBe(false);
    expect(pageNumberVisible).toBe(true);
  });

  test('PDF API should return valid PDF file', async ({ request }) => {
    const response = await request.get(`/api/paper/${TEST_PAPER_ID}/pdf`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/pdf');

    const body = await response.body();
    const header = body.slice(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });
});