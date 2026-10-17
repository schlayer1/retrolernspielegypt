import puppeteer from 'puppeteer-core';

const artifactDir = '/Users/nicolekeller/.gemini/antigravity/brain/4ccea14a-c7ef-46ed-9971-f8c95e17bdbc';

async function run() {
  console.log('🚀 Starting mobile test with Chrome Headless...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
  });

  const page = await browser.newPage();

  // 1. Portrait Test (iPhone 14: 390 x 844)
  console.log('📱 Test 1: iPhone Portrait (390 x 844)...');
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173?neu=1', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.state && window.game);
  await new Promise(r => setTimeout(r, 600));

  // Check rotate prompt visibility
  const rotatePromptDisplay = await page.$eval('#rotate-prompt', el => window.getComputedStyle(el).display);
  console.log('Rotate prompt display in portrait:', rotatePromptDisplay);
  if (rotatePromptDisplay !== 'flex') {
    throw new Error(`Expected #rotate-prompt display to be flex, got ${rotatePromptDisplay}`);
  }

  await page.screenshot({ path: `${artifactDir}/mobile_portrait_rotate_prompt.png` });
  console.log('📸 Captured mobile_portrait_rotate_prompt.png');

  // Click dismiss button
  await page.click('#btn-dismiss-rotate');
  await new Promise(r => setTimeout(r, 300));
  const isDismissed = await page.$eval('#rotate-prompt', el => el.classList.contains('dismissed'));
  console.log('Rotate prompt dismissed:', isDismissed);

  // 2. Landscape Test (iPhone 14 Landscape: 844 x 390)
  console.log('📲 Test 2: iPhone Landscape (844 x 390)...');
  await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:5173?neu=1', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.state && window.game);
  await new Promise(r => setTimeout(r, 600));

  // Rotate prompt should be hidden
  const rotatePromptLandscape = await page.$eval('#rotate-prompt', el => window.getComputedStyle(el).display);
  console.log('Rotate prompt display in landscape:', rotatePromptLandscape);
  if (rotatePromptLandscape !== 'none') {
    throw new Error(`Expected #rotate-prompt display to be none in landscape, got ${rotatePromptLandscape}`);
  }

  // Click "#start-go-btn" to enter the game
  const startBtn = await page.$('#start-go-btn');
  if (startBtn) {
    console.log('Starting game by clicking #start-go-btn...');
    await startBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  } else {
    // If not visible, close modal via ui.closeModal()
    await page.evaluate(() => {
      window.game?.scene?.getScene('UI')?.closeModal();
    });
    await new Promise(r => setTimeout(r, 500));
  }

  // Check desktop button row is hidden
  const hudBtnRowDisplay = await page.$eval('.hud-btn-row', el => window.getComputedStyle(el).display);
  console.log('.hud-btn-row display on mobile:', hudBtnRowDisplay);
  if (hudBtnRowDisplay !== 'none') {
    throw new Error(`Expected .hud-btn-row display to be none, got ${hudBtnRowDisplay}`);
  }

  // Check mobile menu button is visible
  const mobileMenuBtnDisplay = await page.$eval('#hud-mobile-menu-btn', el => window.getComputedStyle(el).display);
  console.log('#hud-mobile-menu-btn display on mobile:', mobileMenuBtnDisplay);
  if (mobileMenuBtnDisplay !== 'inline-flex' && mobileMenuBtnDisplay !== 'flex') {
    throw new Error(`Expected #hud-mobile-menu-btn display to be inline-flex/flex, got ${mobileMenuBtnDisplay}`);
  }

  await page.screenshot({ path: `${artifactDir}/mobile_landscape_hud.png` });
  console.log('📸 Captured mobile_landscape_hud.png');

  // Test tap to expand quest box
  console.log('📜 Test 3: Tap to expand quest box...');
  await page.click('#hud-quest-box');
  await new Promise(r => setTimeout(r, 400));
  const questBoxExpanded = await page.$eval('#hud-quest-box', el => el.classList.contains('expanded'));
  console.log('Quest box expanded:', questBoxExpanded);
  if (!questBoxExpanded) {
    throw new Error('Expected #hud-quest-box to have class "expanded" after click');
  }
  await page.screenshot({ path: `${artifactDir}/mobile_quest_expanded.png` });
  console.log('📸 Captured mobile_quest_expanded.png');

  // Collapse quest box again
  await page.click('#hud-quest-box');
  await new Promise(r => setTimeout(r, 300));

  // Test opening pause menu via mobile menu button
  console.log('⏸ Test 4: Opening pause menu via #hud-mobile-menu-btn...');
  await page.click('#hud-mobile-menu-btn');
  await new Promise(r => setTimeout(r, 600));

  const modalBackdropDisplay = await page.$eval('#modal-backdrop', el => window.getComputedStyle(el).display);
  const modalTitle = await page.$eval('#modal-title', el => el.textContent);
  console.log('Modal display:', modalBackdropDisplay, '| Title:', modalTitle);
  if (!modalTitle.includes('Spiel pausiert') && !modalTitle.includes('Pause')) {
    throw new Error(`Expected modal title to contain "Spiel pausiert" or "Pause", got "${modalTitle}"`);
  }

  await page.screenshot({ path: `${artifactDir}/mobile_pause_menu_open.png` });
  console.log('📸 Captured mobile_pause_menu_open.png');

  // Close modal via #pause-resume-btn or #modal-close-btn
  const resumeBtn = await page.$('#pause-resume-btn');
  if (resumeBtn) {
    await resumeBtn.click();
  } else {
    await page.click('#modal-close-btn');
  }
  await new Promise(r => setTimeout(r, 500));

  // 3. Tablet Landscape Test (1024 x 768)
  console.log('📱 Test 5: Tablet Landscape (1024 x 768)...');
  await page.setViewport({ width: 1024, height: 768, isMobile: false, hasTouch: true });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: `${artifactDir}/tablet_landscape.png` });
  console.log('📸 Captured tablet_landscape.png');

  await browser.close();
  console.log('✅ ALL MOBILE TESTS PASSED SUCCESSFULLY!');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
