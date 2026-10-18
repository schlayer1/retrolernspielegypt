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

  // 1. Chapter 1: Relic Marker at (574, 396)
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
      ui.renderHUD();
    }
    const ws = window.game.scene.getScene('World');
    ws.player.setPosition(560, 396);
    ws.cameras.main.centerOn(574, 396);
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(artifactDir, 'verify_relic_marker.png') });
  console.log('Saved verify_relic_marker.png');

  // 2. Chapter 2: Move to pasture/farm area (400, 310) to see ox (scale 0.55), goat, chicken & campfire (445, 345)
  await page.evaluate(() => {
    const s = window.state;
    s.startChapter(2);
    s.modal = false;
    const ui = window.game.scene.getScene('UI');
    if (ui) {
      ui.closeModal();
      ui.renderHUD();
    }
    const ws = window.game.scene.getScene('World');
    ws.scene.restart();
  });
  // Wait for scene restart
  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.player.setPosition(420, 320);
    ws.cameras.main.centerOn(415, 310);
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(artifactDir, 'verify_farm_obstacles.png') });
  console.log('Saved verify_farm_obstacles.png');

  // 3. Chapter 4: Move to temple courtyard (330, 320) to see baboon at (348, 305), Schreiberhaus site at (280, 345) and Totenbuch relic at (235, 415)
  await page.evaluate(() => {
    const s = window.state;
    s.startChapter(4);
    s.modal = false;
    const ui = window.game.scene.getScene('UI');
    if (ui) {
      ui.closeModal();
      ui.renderHUD();
    }
    const ws = window.game.scene.getScene('World');
    ws.scene.restart();
  });
  // Wait for scene restart
  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.player.setPosition(320, 325);
    ws.cameras.main.centerOn(320, 325);
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(artifactDir, 'verify_temple_court.png') });
  console.log('Saved verify_temple_court.png');

  await browser.close();
  console.log('All verification screenshots captured.');
})();
