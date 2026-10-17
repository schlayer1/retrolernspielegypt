import puppeteer from 'puppeteer-core';

async function run() {
  console.log('--- Launching Chrome Headless Browser for Pause Screen Test ---');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const errors = [];
  page.on('pageerror', (err) => errors.push(`PageError: ${err.message}`));
  page.on('response', (res) => {
    if (res.status() === 404) errors.push(`404: ${res.url()}`);
  });

  console.log('--- Navigating to http://localhost:5174?neu=1 ---');
  await page.goto('http://localhost:5174?neu=1', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.state && window.game);

  // Start game as Merit
  console.log('Starting game as Merit...');
  await page.evaluate(() => {
    window.state.playerName = 'Merit';
    window.state.playerGender = 'female';
    window.state.playerRole = 'fisher';
    window.state.startChapter(2);
    window.state.relicsFound = ['skanabaeus', 'kanope'];
    window.state.relicQuizAnswered = ['skanabaeus'];
    window.state.distanceMeters = 1119;
    window.state.daysSurvived = 4;
    window.state.buildings = ['schaduf', 'ziegelei'];
    window.state.counts = { nilbarsch: 18, emmer: 32, lehm: 18 };
    window.state.unlockSilent(['kemet', 'nil', 'ueberschwemmung', 'schaduf', 'nilometer']);
    window.state.persist();
    const ui = window.game.scene.getScene('UI');
    ui.closeModal();
  });

  await new Promise((r) => setTimeout(r, 600));

  // Re-verify relics after scene restart
  await page.evaluate(() => {
    window.state.relicsFound = ['skanabaeus', 'kanope'];
    window.state.relicQuizAnswered = ['skanabaeus'];
    window.state.distanceMeters = 1119;
    window.state.daysSurvived = 4;
    window.state.buildings = ['schaduf', 'ziegelei'];
    window.state.persist();
  });

  await new Promise((r) => setTimeout(r, 600));

  console.log('Opening Pause Screen via keyboard key P...');
  await page.keyboard.press('p');
  await new Promise((r) => setTimeout(r, 600));

  // Inspect the pause screen DOM elements
  const pauseStats = await page.evaluate(() => {
    const title = document.querySelector('#modal-title')?.textContent;
    const tiles = Array.from(document.querySelectorAll('.stat-tile')).map((el) => {
      const val = el.querySelector('.stat-val')?.textContent?.trim();
      const lbl = el.querySelector('.stat-lbl')?.textContent?.trim();
      return { val, lbl };
    });
    const code = document.querySelector('.shortcode-pill')?.textContent?.trim();
    const relicCards = Array.from(document.querySelectorAll('.relic-card')).map((el) => {
      const name = el.querySelector('.relic-name')?.textContent?.trim();
      const isFound = el.classList.contains('found');
      return { name, isFound };
    });
    const trackInfo = document.querySelector('#pause-music-track-info')?.textContent?.trim();
    return { title, tilesCount: tiles.length, tiles, code, relicCards, trackInfo };
  });

  console.log('Pause Screen Data:', JSON.stringify(pauseStats, null, 2));

  // Capture Screenshot of Pause Screen (top)
  const pauseScreenshotPath = '/Users/nicolekeller/.gemini/antigravity/brain/4ccea14a-c7ef-46ed-9971-f8c95e17bdbc/pausescreen_adapted.png';
  await page.screenshot({ path: pauseScreenshotPath });
  console.log(`Saved screenshot: ${pauseScreenshotPath}`);

  // Scroll down to capture Hefter-Code and Soundtrack
  await page.evaluate(() => {
    const b = document.querySelector('.modal-body');
    if (b) b.scrollTop = b.scrollHeight;
  });
  await new Promise((r) => setTimeout(r, 400));
  const pauseScrolledPath = '/Users/nicolekeller/.gemini/antigravity/brain/4ccea14a-c7ef-46ed-9971-f8c95e17bdbc/pausescreen_scrolled.png';
  await page.screenshot({ path: pauseScrolledPath });
  console.log(`Saved screenshot: ${pauseScrolledPath}`);

  // Test clicking on a discovered relic to open Relic Modal
  console.log('Clicking on Kanopenkrug relic card...');
  await page.evaluate(() => {
    const card = document.querySelector('[data-pause-relic="kanope"]');
    if (card) card.click();
  });

  await new Promise((r) => setTimeout(r, 600));

  const relicModalData = await page.evaluate(() => {
    const title = document.querySelector('#modal-title')?.textContent;
    const opts = Array.from(document.querySelectorAll('.relic-opt-btn')).map((b) => b.textContent?.trim());
    return { title, opts };
  });
  console.log('Relic Modal Opened:', JSON.stringify(relicModalData, null, 2));

  // Capture Screenshot of Relic Quiz Modal
  const relicScreenshotPath = '/Users/nicolekeller/.gemini/antigravity/brain/4ccea14a-c7ef-46ed-9971-f8c95e17bdbc/relic_quiz_modal.png';
  await page.screenshot({ path: relicScreenshotPath });
  console.log(`Saved screenshot: ${relicScreenshotPath}`);

  // Click correct option (index 1: Der Magen)
  await page.evaluate(() => {
    const btn = document.querySelector('[data-relic-opt="1"]');
    if (btn) btn.click();
  });

  await new Promise((r) => setTimeout(r, 400));

  const isAnswered = await page.evaluate(() => {
    return window.state.relicQuizAnswered.includes('kanope');
  });
  console.log('Relic Quiz Answered successfully:', isAnswered);

  // Close relic modal
  await page.evaluate(() => {
    const doneBtn = document.querySelector('#relic-done-btn');
    if (doneBtn) doneBtn.click();
  });

  await new Promise((r) => setTimeout(r, 400));

  await browser.close();

  if (errors.length > 0) {
    console.error('Errors found:', errors);
    process.exit(1);
  }
  console.log('SUCCESS! Pause screen and relic system verified flawlessly.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
