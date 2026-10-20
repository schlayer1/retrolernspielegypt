import puppeteer from 'puppeteer-core';

const ARTIFACT_DIR = '/Users/nicolekeller/.gemini/antigravity/brain/4ccea14a-c7ef-46ed-9971-f8c95e17bdbc';

async function run() {
  console.log('--- Launching Chrome Headless Browser for Fauna Visual Audit ---');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => window.state && window.game);

  // Helper to start chapter and set camera
  async function setupChapter(ch, playerX, playerY) {
    await page.evaluate(({ ch }) => {
      const s = window.state;
      s.playerName = 'Nakht';
      s.playerGender = 'm';
      s.playerRole = 'builder';
      s.startChapter(ch);
      s.modal = false;
      const ui = window.game.scene.getScene('UI');
      if (ui) {
        ui.closeModal();
        ui.renderHUD();
      }
    }, { ch });
    await new Promise((r) => setTimeout(r, 400));

    await page.evaluate(({ playerX, playerY }) => {
      const world = window.game.scene.getScene('World');
      if (world && world.player) {
        world.player.setPosition(playerX, playerY);
        world.cameras.main.centerOn(playerX, playerY);
      }
    }, { playerX, playerY });
    await new Promise((r) => setTimeout(r, 400));
  }

  // 1. Nile Fauna & Critters (Chapter 1)
  console.log('Capturing Nile Fauna (Ducks, Turtle, Frogs, Fish)...');
  await setupChapter(1, 640, 360);
  await page.screenshot({ path: `${ARTIFACT_DIR}/verify_fauna_nile.png` });

  // 2. Farm Area (Chapter 2: Cow, Calf, Goat, Goat Baby, Chicken, Chick)
  console.log('Capturing Farm Area (Cattle, Goats, Poultry)...');
  await setupChapter(2, 420, 290);
  await page.screenshot({ path: `${ARTIFACT_DIR}/verify_fauna_farm.png` });

  // 3. Royal Granary (Chapter 3: Village Cat)
  console.log('Capturing Granary (Village Cat)...');
  await setupChapter(3, 400, 160);
  await page.screenshot({ path: `${ARTIFACT_DIR}/verify_fauna_granary.png` });

  // 4. Temple Courtyard (Chapter 4: Sacred Bastet Cat & Tesem Dog)
  console.log('Capturing Temple Courtyard (Bastet Cat & Tesem Dog)...');
  await setupChapter(4, 320, 280);
  await page.screenshot({ path: `${ARTIFACT_DIR}/verify_fauna_temple.png` });

  // 5. Gizeh Dunes (Chapter 5: Ostriches)
  console.log('Capturing Gizeh Dunes (Ostriches)...');
  await setupChapter(5, 120, 440);
  await page.screenshot({ path: `${ARTIFACT_DIR}/verify_fauna_gizeh_ostrich.png` });

  // 6. Nilhafen Bazaar (Chapter 6: Punt Parrot)
  console.log('Capturing Nilhafen Bazaar (Punt Parrot)...');
  await setupChapter(6, 560, 490);
  await page.screenshot({ path: `${ARTIFACT_DIR}/verify_fauna_harbor_parrot.png` });

  console.log('All 6 fauna screenshots captured successfully.');
  await browser.close();
}

run().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
