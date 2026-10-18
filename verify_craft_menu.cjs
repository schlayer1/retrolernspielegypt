const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.state && window.game);

  const artifactDir = '/Users/nicolekeller/.gemini/antigravity/brain/4ccea14a-c7ef-46ed-9971-f8c95e17bdbc';

  // 1. Chapter 1: open craft modal
  await page.evaluate(() => {
    const s = window.state;
    s.playerName = 'Nakht';
    s.playerGender = 'male';
    s.playerRole = 'builder';
    s.startChapter(1);
    s.modal = false;
    const ui = window.game.scene.getScene('UI');
    if (ui) {
      ui.closeModal();
      ui.openCraft();
    }
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(artifactDir, 'craft_menu_chapter1.png') });
  console.log('Saved craft_menu_chapter1.png');

  // 2. Chapter 3: open craft modal with some resources
  await page.evaluate(() => {
    const s = window.state;
    s.startChapter(3);
    s.add('nilschlamm', 4);
    s.add('papyrus_staengel', 4);
    s.add('emmer', 2);
    s.add('wasser', 2);
    s.modal = false;
    const ui = window.game.scene.getScene('UI');
    if (ui) {
      ui.openCraft();
    }
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(artifactDir, 'craft_menu_chapter3.png') });
  console.log('Saved craft_menu_chapter3.png');

  // 3. Mobile Landscape view for craft menu
  await page.setViewport({ width: 780, height: 410 });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(artifactDir, 'craft_menu_mobile_landscape.png') });
  console.log('Saved craft_menu_mobile_landscape.png');

  await browser.close();
  console.log('Done!');
})();
