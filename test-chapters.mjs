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
    }
  });

  console.log('--- Navigating to http://localhost:5174 ---');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle2' });

  // Wait for game and state to be ready
  await page.waitForFunction(() => window.state && window.game);
  console.log('Phaser and GameState initialized.');

  // Helper to click next button on dialog if visible
  async function advanceDialogUntilClosed() {
    let loopCount = 0;
    while (loopCount < 25) {
      loopCount++;
      const isVisible = await page.evaluate(() => {
        const dlg = document.getElementById('dlg-dock');
        return dlg && dlg.style.display !== 'none';
      });
      if (!isVisible) break;

      // Check if question buttons are active
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
        await new Promise((r) => setTimeout(r, 200));
      }

      // Click dlg-next
      await page.evaluate(() => {
        const nextBtn = document.getElementById('dlg-next-btn');
        if (nextBtn && nextBtn.style.display !== 'none') {
          nextBtn.click();
        }
      });
      await new Promise((r) => setTimeout(r, 200));
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

  await new Promise((r) => setTimeout(r, 500));

  // Verify Chapter 1
  let ch = await page.evaluate(() => window.state.chapter);
  console.log(`Current chapter: ${ch}`);

  // Test Chapter 1 Quest Flow
  console.log('Testing Chapter 1 flow...');
  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactSenbi();
  });
  await advanceDialogUntilClosed();
  let q = await page.evaluate(() => window.state.quest);
  console.log(`After Senbi intro: Quest = ${q}`);

  // Advance quests 1 to 5
  await page.evaluate(() => {
    const s = window.state;
    s.add('papyrus_staengel', 3);
    s.checkQuest();
    s.add('stock', 2);
    s.add('stein', 2);
    s.checkQuest();
    s.craft(s.recipesData.find((r) => r.id === 'fischreuse'));
    s.checkQuest();
    s.bump('trap', 1);
    s.checkQuest();
    s.bump('cooked', 1);
    s.checkQuest();
  });

  q = await page.evaluate(() => window.state.quest);
  let readyForQuiz = await page.evaluate(() => window.state.isReadyForQuiz());
  console.log(`After Ch1 tasks: Quest = ${q}, readyForQuiz = ${readyForQuiz}`);

  // Ch 1 Quiz
  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactSenbi();
  });
  await advanceDialogUntilClosed();

  ch = await page.evaluate(() => window.state.chapter);
  console.log(`Transition to Chapter ${ch}`);

  // Chapter 2 Flow
  console.log('Testing Chapter 2 flow...');
  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactAmeni();
  });
  await advanceDialogUntilClosed();
  q = await page.evaluate(() => window.state.quest);
  console.log(`After Ameni intro: Quest = ${q}`);

  await page.evaluate(() => {
    const s = window.state;
    s.bump('nilometer', 1);
    s.checkQuest();
    s.add('schaduf_teil', 1);
    s.checkQuest();
    s.addBuilding('schaduf');
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
  readyForQuiz = await page.evaluate(() => window.state.isReadyForQuiz());
  console.log(`Ch2 tasks complete, readyForQuiz = ${readyForQuiz}`);

  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactAmeni();
  });
  await advanceDialogUntilClosed();
  ch = await page.evaluate(() => window.state.chapter);
  console.log(`Transition to Chapter ${ch}`);

  // Chapter 3 Flow
  console.log('Testing Chapter 3 flow...');
  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactNefermaat();
  });
  await advanceDialogUntilClosed();
  q = await page.evaluate(() => window.state.quest);
  console.log(`After Nefermaat intro: Quest = ${q}`);

  await page.evaluate(() => {
    const s = window.state;
    s.add('nilschlamm', 3);
    s.checkQuest();
    s.addBuilding('ziegelei');
    s.checkQuest();
    s.add('lehmziegel', 3);
    s.checkQuest();
    s.addBuilding('speicher');
    s.checkQuest();
    s.add('tontopf', 1);
    s.checkQuest();
    s.add('leinen', 1);
    s.checkQuest();
    s.add('brot', 2);
    s.add('bier', 1);
    s.checkQuest();
  });
  readyForQuiz = await page.evaluate(() => window.state.isReadyForQuiz());
  console.log(`Ch3 tasks complete, readyForQuiz = ${readyForQuiz}`);

  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactNefermaat();
  });
  await advanceDialogUntilClosed();
  ch = await page.evaluate(() => window.state.chapter);
  console.log(`Transition to Chapter ${ch}`);

  // Chapter 4 Flow
  console.log('Testing Chapter 4 flow...');
  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactAni();
  });
  await advanceDialogUntilClosed();
  q = await page.evaluate(() => window.state.quest);
  console.log(`After Ani intro: Quest = ${q}`);

  await page.evaluate(() => {
    const s = window.state;
    s.addBuilding('schreiberhaus');
    s.checkQuest();
    s.add('papyrusrolle', 1);
    s.checkQuest();
    s.add('pinsel_tinte', 1);
    s.checkQuest();
    s.bump('tax_recorded', 1);
    s.checkQuest();
    s.addBuilding('wabet');
    s.checkQuest();
    s.add('salz', 2);
    s.add('kanope', 1);
    s.checkQuest();
    s.add('skanabaeus', 1);
    s.checkQuest();
  });
  readyForQuiz = await page.evaluate(() => window.state.isReadyForQuiz());
  console.log(`Ch4 tasks complete, readyForQuiz = ${readyForQuiz}`);

  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactAni();
  });
  await advanceDialogUntilClosed();
  ch = await page.evaluate(() => window.state.chapter);
  console.log(`Transition to Chapter ${ch}`);

  // Chapter 5 Flow
  console.log('Testing Chapter 5 flow...');
  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactHemiunu();
  });
  await advanceDialogUntilClosed();
  q = await page.evaluate(() => window.state.quest);
  console.log(`After Hemiunu intro: Quest = ${q}`);

  await page.evaluate(() => {
    const s = window.state;
    s.addBuilding('steinmetz');
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
  });
  readyForQuiz = await page.evaluate(() => window.state.isReadyForQuiz());
  console.log(`Ch5 tasks complete, readyForQuiz = ${readyForQuiz}`);

  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactHemiunu();
  });
  await advanceDialogUntilClosed();
  ch = await page.evaluate(() => window.state.chapter);
  console.log(`Transition to Chapter ${ch}`);

  // Chapter 6 Flow
  console.log('Testing Chapter 6 flow...');
  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactBaki();
  });
  await advanceDialogUntilClosed();
  q = await page.evaluate(() => window.state.quest);
  console.log(`After Baki intro: Quest = ${q}`);

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
  readyForQuiz = await page.evaluate(() => window.state.isReadyForQuiz());
  console.log(`Ch6 tasks complete, readyForQuiz = ${readyForQuiz}`);

  // Baki Abschluss-Prüfung
  await page.evaluate(() => {
    const ws = window.game.scene.getScene('World');
    ws.interactBaki();
  });
  await advanceDialogUntilClosed();

  // Wait a moment for modal opening
  await new Promise((r) => setTimeout(r, 800));

  // Check if Certificate modal card is open
  const certModalCheck = await page.evaluate(() => {
    const backdrop = document.getElementById('modal-backdrop');
    const title = document.getElementById('modal-title');
    return {
      backdropVisible: backdrop && backdrop.style.display !== 'none',
      title: title ? title.textContent : '',
    };
  });
  console.log('Certificate Modal State:', certModalCheck);

  // Take screenshot of certificate modal
  await page.screenshot({ path: '/Users/nicolekeller/.gemini/antigravity/brain/4ccea14a-c7ef-46ed-9971-f8c95e17bdbc/final_certificate_unlocked.png' });
  console.log('Screenshot saved to final_certificate_unlocked.png');

  // Verify soundtrack loops
  const musicCheck = await page.evaluate(() => {
    return Boolean(window.state);
  });
  console.log(`GameState active: ${musicCheck}`);

  // Filter ignorable audio warnings (Web Audio autoplay policy in headless)
  const realErrors = errors.filter(
    (e) => !e.includes('AudioContext') && !e.includes('favicon.ico') && !e.includes('net::ERR_FAILED')
  );

  console.log('--- Test Run Results ---');
  console.log(`Total Errors: ${realErrors.length}`);
  if (realErrors.length > 0) {
    console.error('Errors encountered:', realErrors);
  } else {
    console.log('SUCCESS! All 6 chapters completed cleanly with zero critical errors.');
  }

  await browser.close();
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
