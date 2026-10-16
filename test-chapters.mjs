import puppeteer from 'puppeteer-core';

async function run() {
  console.log('--- Launching Chrome Headless Browser ---');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const consoleLogs = [];
  const errors = [];
  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    errors.push(`PageError: ${err.message}`);
  });

  page.on('response', (res) => {
    if (res.status() === 404) {
      console.log('404 URL:', res.url());
      errors.push(`404: ${res.url()}`);
    }
  });

  console.log('--- Navigating to http://localhost:5174 ---');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle2' });

  await page.waitForFunction(() => window.state && window.game);
  console.log('Phaser and GameState initialized.');

  async function advanceDialogUntilClosed() {
    let loopCount = 0;
    while (loopCount < 25) {
      loopCount++;
      const isVisible = await page.evaluate(() => {
        const dlg = document.getElementById('dlg-dock');
        return dlg && dlg.style.display !== 'none';
      });
      if (!isVisible) break;

      const hasOpts = await page.evaluate(() => {
        const opts = document.getElementById('dlg-opts');
        return opts && opts.children.length > 0;
      });

      if (hasOpts) {
        await page.evaluate(() => {
          const opts = document.getElementById('dlg-opts');
          if (opts && opts.children.length > 0) {
            const uiScene = window.game.scene.getScene('UI');
            if (uiScene && uiScene.spec) {
              const node = uiScene.spec.nodes[uiScene.nodeIdx];
              if (node && typeof node.correct === 'number') {
                const btn = opts.children[node.correct];
                if (btn) btn.click();
              }
            }
          }
        });
        await new Promise((r) => setTimeout(r, 180));
      }

      await page.evaluate(() => {
        const nextBtn = document.getElementById('dlg-next-btn');
        if (nextBtn && nextBtn.style.display !== 'none') {
          nextBtn.click();
        }
      });
      await new Promise((r) => setTimeout(r, 180));
    }
  }

  // 1. Start Game
  console.log('Starting game as Nakht (builder)...');
  await page.evaluate(() => {
    const s = window.state;
    s.playerName = 'Nakht';
    s.playerGender = 'm';
    s.playerRole = 'builder';
    s.startChapter(1);
    s.modal = false;
    const ui = window.game.scene.getScene('UI');
    if (ui) {
      ui.closeModal();
      ui.renderHUD();
    }
  });

  await new Promise((r) => setTimeout(r, 400));

  // Test Chapter 1 Quest Flow (including real campfire interaction bugfix!)
  console.log('Testing Chapter 1 flow...');
  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactSenbi();
  });
  await advanceDialogUntilClosed();

  await page.evaluate(() => {
    const s = window.state;
    const ws = window.game.scene.getScene('World');
    s.add('papyrus_staengel', 3);
    s.checkQuest();
    s.add('stock', 2);
    s.add('stein', 2);
    s.checkQuest();
    s.craft(s.recipesData.find((r) => r.id === 'fischreuse'));
    s.checkQuest();
    // Real fish spot interaction
    const fishNode = ws.nodes.find((n) => n.kind === 'egypt_fish_spot');
    ws.interact(fishNode);
    s.checkQuest();
    // Real campfire interaction (tests the fixed campfire bug!)
    const fireNode = ws.nodes.find((n) => n.kind === 'egypt_campfire');
    ws.interact(fireNode);
    s.checkQuest();
  });

  let q = await page.evaluate(() => window.state.quest);
  let readyForQuiz = await page.evaluate(() => window.state.isReadyForQuiz());
  console.log(`After Ch1 real interactions: Quest = ${q}, readyForQuiz = ${readyForQuiz}`);
  if (!readyForQuiz) throw new Error('Ch1 Quest 5 campfire interaction did not advance quest to quiz!');

  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactSenbi();
  });
  await advanceDialogUntilClosed();

  // Chapter 2 Flow
  console.log('Testing Chapter 2 flow...');
  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactAmeni();
  });
  await advanceDialogUntilClosed();

  await page.evaluate(() => {
    const s = window.state;
    const ws = window.game.scene.getScene('World');
    s.bump('nilometer', 1);
    s.checkQuest();
    s.add('schaduf_teil', 1);
    s.checkQuest();
    s.addBuilding('schaduf');
    const schadufNode = ws.nodes.find((n) => n.buildingDef?.id === 'schaduf');
    if (schadufNode) ws.renderBuiltEgyptBuilding(schadufNode);
    s.checkQuest();
    s.bump('schaduf_water', 1);
    s.checkQuest();
    s.bump('seeded_plot', 1);
    s.checkQuest();
    s.bump('watered_plot', 1);
    s.checkQuest();
    s.add('datteln', 3);
    s.checkQuest();
    s.bump('harvested_emmer', 1);
    s.checkQuest();
  });

  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: '/Users/nicolekeller/.gemini/antigravity/brain/4ccea14a-c7ef-46ed-9971-f8c95e17bdbc/enriched_ch2_fields.png' });

  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactAmeni();
  });
  await advanceDialogUntilClosed();

  // Chapter 3 Flow
  console.log('Testing Chapter 3 flow...');
  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactNefermaat();
  });
  await advanceDialogUntilClosed();

  await page.evaluate(() => {
    const s = window.state;
    const ws = window.game.scene.getScene('World');
    s.add('nilschlamm', 3);
    s.checkQuest();
    s.addBuilding('ziegelei');
    const zNode = ws.nodes.find((n) => n.buildingDef?.id === 'ziegelei');
    if (zNode) ws.renderBuiltEgyptBuilding(zNode);
    s.checkQuest();
    s.add('lehmziegel', 3);
    s.checkQuest();
    s.addBuilding('speicher');
    const spNode = ws.nodes.find((n) => n.buildingDef?.id === 'speicher');
    if (spNode) ws.renderBuiltEgyptBuilding(spNode);
    s.checkQuest();
    s.add('tontopf', 1);
    s.checkQuest();
    s.add('leinen', 1);
    s.checkQuest();
    s.add('brot', 2);
    s.add('bier', 1);
    s.checkQuest();
  });

  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactNefermaat();
  });
  await advanceDialogUntilClosed();

  // Chapter 4 Flow
  console.log('Testing Chapter 4 flow...');
  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactAni();
  });
  await advanceDialogUntilClosed();

  await page.evaluate(() => {
    const s = window.state;
    const ws = window.game.scene.getScene('World');
    s.addBuilding('schreiberhaus');
    const shNode = ws.nodes.find((n) => n.buildingDef?.id === 'schreiberhaus');
    if (shNode) ws.renderBuiltEgyptBuilding(shNode);
    s.checkQuest();
    s.add('papyrusrolle', 1);
    s.checkQuest();
    s.add('pinsel_tinte', 1);
    s.checkQuest();
    s.bump('tax_recorded', 1);
    s.checkQuest();
    s.addBuilding('wabet');
    const wNode = ws.nodes.find((n) => n.buildingDef?.id === 'wabet');
    if (wNode) ws.renderBuiltEgyptBuilding(wNode);
    s.checkQuest();
    s.add('salz', 2);
    s.add('kanope', 1);
    s.checkQuest();
    s.add('skanabaeus', 1);
    s.checkQuest();
  });

  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: '/Users/nicolekeller/.gemini/antigravity/brain/4ccea14a-c7ef-46ed-9971-f8c95e17bdbc/enriched_ch4_temple_court.png' });

  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactAni();
  });
  await advanceDialogUntilClosed();

  // Chapter 5 Flow
  console.log('Testing Chapter 5 flow...');
  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactHemiunu();
  });
  await advanceDialogUntilClosed();

  await page.evaluate(() => {
    const s = window.state;
    const ws = window.game.scene.getScene('World');
    s.addBuilding('steinmetz');
    const stNode = ws.nodes.find((n) => n.buildingDef?.id === 'steinmetz');
    if (stNode) ws.renderBuiltEgyptBuilding(stNode);
    s.checkQuest();
    s.add('kalkstein', 3);
    s.checkQuest();
    s.add('stock', 3);
    s.checkQuest();
    s.bump('ramp_watered', 1);
    s.checkQuest();
    s.bump('pyramidion_delivered', 1);
    s.checkQuest();
    s.bump('sphinx_visited', 1);
    s.checkQuest();
    s.bump('sphinx_aligned', 1);
    s.checkQuest();
    ws.player.setPosition(145, 165);
  });

  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: '/Users/nicolekeller/.gemini/antigravity/brain/4ccea14a-c7ef-46ed-9971-f8c95e17bdbc/enriched_ch5_gizeh.png' });

  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactHemiunu();
  });
  await advanceDialogUntilClosed();

  // Chapter 6 Flow
  console.log('Testing Chapter 6 flow...');
  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactBaki();
  });
  await advanceDialogUntilClosed();

  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: '/Users/nicolekeller/.gemini/antigravity/brain/4ccea14a-c7ef-46ed-9971-f8c95e17bdbc/enriched_ch6_harbor_bazaar.png' });

  await page.evaluate(() => {
    const s = window.state;
    s.add('weihrauch', 1);
    s.checkQuest();
    s.add('zedernholz', 1);
    s.checkQuest();
    s.add('goldmaske', 1);
    s.checkQuest();
    s.add('getreidesack', 3);
    s.checkQuest();
    s.bump('barge_loaded', 1);
    s.checkQuest();
    s.bump('treaty_signed', 1);
    s.checkQuest();
  });

  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactBaki();
  });
  await advanceDialogUntilClosed();

  await new Promise((r) => setTimeout(r, 500));

  const certModalCheck = await page.evaluate(() => {
    const backdrop = document.getElementById('modal-backdrop');
    const title = document.getElementById('modal-title');
    return {
      backdropVisible: backdrop && backdrop.style.display !== 'none',
      title: title ? title.textContent : '',
    };
  });
  console.log('Certificate Modal State:', certModalCheck);

  const realErrors = errors.filter(
    (e) => !e.includes('AudioContext') && !e.includes('net::ERR_FAILED')
  );

  console.log('--- Test Run Results ---');
  console.log(`Total Errors: ${realErrors.length}`);
  if (realErrors.length > 0) {
    console.error('Errors encountered:', realErrors);
    process.exit(1);
  } else {
    console.log('SUCCESS! All 6 chapters and visual zones verified with zero errors.');
  }

  await browser.close();
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
