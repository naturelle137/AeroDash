/* eslint-disable no-console */
/**
 * Standalone Playwright test for the prep-card sticky breadcrumb stack on
 * the Mass & Balance / Flight Preparation view.
 *
 * Not part of the regular E2E suite — this is a scripted manual-style test
 * driven from a Cursor cloud agent, used to capture artifacts proving the
 * UI fix works at iPhone-portrait viewport. Skipped from CI.
 *
 * Console output is intentional (it's the script's only reporting
 * channel), hence the file-level disable of `no-console`.
 */

import path from 'node:path'
import { mkdirSync, readdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

// `playwright` is only available under pnpm's hidden virtual store
// (node_modules/.pnpm/playwright@<version>/...) — there's no top-level
// `node_modules/playwright` symlink in this workspace. Resolve it
// dynamically so the script works regardless of pnpm version bumps.
const HERE = path.dirname(fileURLToPath(import.meta.url))
// frontend/scripts/foo.mjs → repo root is two levels up
const REPO_ROOT = path.resolve(HERE, '..', '..')
async function resolvePlaywright() {
  try {
    const m = await import('playwright')
    return m.chromium
  } catch {
    /* fall through to manual lookup */
  }
  const pnpmDir = path.join(REPO_ROOT, 'node_modules', '.pnpm')
  const entry = readdirSync(pnpmDir).find((d) => d.startsWith('playwright@'))
  if (!entry) throw new Error('playwright is not installed')
  const url = pathToFileURL(
    path.join(pnpmDir, entry, 'node_modules', 'playwright', 'index.mjs'),
  ).href
  const m = await import(url)
  return m.chromium
}
const chromium = await resolvePlaywright()

const ARTIFACT_DIR = '/opt/cursor/artifacts'
mkdirSync(ARTIFACT_DIR, { recursive: true })

const SEED = `(async () => {
  const profile = {
    id: 'aaaaaaaa-1111-4000-a000-000000000001',
    ownerId: 'demo-owner',
    registration: 'D-EBPF',
    manufacturer: 'Tecnam',
    model: 'P2008 JC',
    icaoTypeDesignator: 'P208',
    sourceUnit: 'kg',
    referenceDatumDescription: 'Leading edge',
    referenceDatumLocation: 'Station 0',
    shareCode: null,
    status: 'verified',
    schemaVersion: 1,
    passengerProfiles: [],
    weighingReports: [
      { bem: 433, emptyCg: 1.877, weighingDate: '2025-01-01', validFrom: '2025-01-01' },
    ],
    loadPoints: [
      { name: 'Pilot & Passenger', arm: 1.8,   armLookup: [], operationalLimit: 200, defaultQuantity: 0, unit: 'kg', allowableCategories: ['Normal'], fuelTank: null },
      { name: 'Baggage',           arm: 2.417, armLookup: [], operationalLimit: 20,  defaultQuantity: 0, unit: 'kg', allowableCategories: ['Normal'], fuelTank: null },
      { name: 'Fuel',              arm: 2.209, armLookup: [], operationalLimit: 75,  defaultQuantity: 0, unit: 'kg', allowableCategories: ['Normal'], fuelTank: { unusableFuel: 3, permissibleFuelTypes: ['AvGas 100LL'], burnSequences: [] } },
    ],
    certificationCategories: [
      {
        category: 'Normal', mtom: 650, maxZeroFuelMass: null, graphType: 'arm',
        envelope: [
          { armOrMoment: 1.841, mass: 433 },
          { armOrMoment: 1.841, mass: 650 },
          { armOrMoment: 1.978, mass: 650 },
          { armOrMoment: 1.978, mass: 433 },
        ],
      },
    ],
  };
  await new Promise((res, rej) => {
    const r = indexedDB.open('aerodash-fleet', 2);
    r.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('aircraft_profiles')) {
        const s = db.createObjectStore('aircraft_profiles', { keyPath: 'id' });
        s.createIndex('ownerId', 'ownerId', { unique: false });
        s.createIndex('registration', 'registration', { unique: false });
      }
    };
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction('aircraft_profiles', 'readwrite');
      const p = tx.objectStore('aircraft_profiles').put(profile);
      p.onsuccess = () => res(); p.onerror = () => rej(p.error);
    };
    r.onerror = () => rej(r.error);
  });
})()`

async function main() {
  const browser = await chromium.launch({ headless: true })
  // 390x720 mimics an iPhone-portrait viewport with the iOS Safari URL bar
  // visible (it eats ~120 px of vertical), giving enough scroll headroom to
  // push the last prep-card's top above the strip-threshold line so all 5
  // strips can stack simultaneously.
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 540 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  })
  const page = await ctx.newPage()

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[browser ${msg.type()}]`, msg.text())
    }
  })
  page.on('pageerror', (err) => {
    console.log('[browser pageerror]', err.message)
  })

  console.log('1. nav home & seed aircraft …')
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  await page.evaluate(SEED)

  console.log('2. nav to /mass-balance …')
  await page.goto('http://localhost:5173/mass-balance', { waitUntil: 'networkidle' })

  // Wait briefly then debug what's on screen
  await page.waitForTimeout(2000)
  const hasSelect = await page.locator('select#aircraft-select').count()
  console.log('   select count =', hasSelect)
  if (hasSelect === 0) {
    const bodyText = await page.locator('body').innerText()
    console.log('   body text:', bodyText.slice(0, 800))
  } else {
    const opts = await page.locator('select#aircraft-select option').count()
    console.log('   option count =', opts)
  }
  await page.waitForFunction(() => {
    const sel = document.querySelector('select#aircraft-select')
    return !!sel && sel.options.length > 1
  }, { timeout: 5000 })

  console.log('3. select Tecnam …')
  await page.selectOption('select#aircraft-select', 'aaaaaaaa-1111-4000-a000-000000000001')

  // Wait for the M&B card to unlock and station inputs to appear
  await page.waitForSelector('input#station-0')

  console.log('4. enter station weights …')
  await page.fill('input#station-0', '80')
  await page.fill('input#station-1', '5')
  await page.fill('input#station-2', '40')
  await page.waitForTimeout(300)

  console.log('5. screenshot top of page …')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mb_top_no_strips.png'),
    fullPage: false,
  })

  // Switch to dark mode (matching the user's iOS Safari screenshot) to
  // verify the strip styling reads well against the dark surface, then
  // capture the deep-scroll state that originally bisected the chart.
  console.log('5b. flip to dark mode …')
  const themeBtn = page.locator('button[aria-label*="Switch to"]').first()
  await themeBtn.click().catch(() => {})
  await page.waitForTimeout(200)

  // Helper: scroll to bottom in a few discrete jumps so each step settles
  async function scrollToBottom() {
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => window.scrollBy(0, 400))
      await page.waitForTimeout(40)
    }
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    )
    await page.waitForTimeout(200)
  }

  console.log('6. scroll bottom + screenshot 5-strip stack …')
  await scrollToBottom()
  const stuckCount = await page.locator('.prep-sticky-strip').count()
  console.log('   .prep-sticky-strip count =', stuckCount)
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mb_bottom_5_strips_stacked.png'),
    fullPage: false,
  })

  // 6b. The exact state from the bug report: scroll to where the M&B chart
  // is in view but card 02's title bar is offscreen. With the OLD code,
  // card 01's strip vanished here and the bare title hovered "weirdly in
  // front" of the chart. With the fix, both 01 + 02 strips are pinned at
  // the top and the chart renders cleanly below.
  console.log('6b. screenshot mid-scroll state (chart in view, mb title past) …')
  await page.evaluate(() => {
    const card = document.getElementById('prep-card-mb')
    if (!card) return
    // Scroll so card 02's chart is roughly centred in the viewport.
    const target = card.getBoundingClientRect().top + window.scrollY + 360
    window.scrollTo(0, target)
  })
  await page.waitForTimeout(200)
  const midStuck = await page.locator('.prep-sticky-strip').count()
  console.log('   mid-scroll strip count =', midStuck, '(expect ≥ 2)')
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mb_mid_scroll_chart_in_view.png'),
    fullPage: false,
  })

  console.log('7. tap "01 Aircraft" strip → smooth-scroll back to card 01 …')
  // Scroll position before
  const yBefore = await page.evaluate(() => window.scrollY)
  await page.locator('.prep-sticky-strip', { hasText: 'Aircraft' }).first().click()
  // Sample y at midpoint of animation to confirm it's not a snap (the eased
  // animation lasts 500 ms; sample at 200 ms — y must be strictly between
  // start and final).
  await page.waitForTimeout(200)
  const yMid = await page.evaluate(() => window.scrollY)
  await page.waitForTimeout(800)
  const yAfter = await page.evaluate(() => window.scrollY)
  console.log('   yBefore=', yBefore, 'yMid=', yMid, 'yAfter=', yAfter)
  console.log(
    '   smooth-scroll detected:',
    yMid !== yBefore && yMid !== yAfter && Math.abs(yMid - yBefore) > 50 &&
      Math.abs(yAfter - yMid) > 50,
  )
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mb_after_tap_01_aircraft.png'),
    fullPage: false,
  })

  console.log('8. scroll bottom + tap "03 Performance" …')
  await scrollToBottom()
  await page.locator('.prep-sticky-strip', { hasText: 'Performance' }).first().click()
  await page.waitForTimeout(900)
  // Confirm 2 strips remain pinned ("01 Aircraft" + "02 Mass & Balance")
  const remaining = await page.locator('.prep-sticky-strip').count()
  console.log('   remaining strips above card 03 =', remaining)
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mb_after_tap_03_performance.png'),
    fullPage: false,
  })

  // Variant capture: drive the M&B card into ERROR_CRITICAL and verify the
  // sticky strip's right-aligned badge swaps colour + label to match the
  // in-flow header.
  console.log('8b. screenshot strip with CRITICAL state (overload pilot) …')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(150)
  await page.fill('input#station-0', '210') // overload → MTOM_EXCEEDED → CRITICAL
  await page.waitForTimeout(150)
  await scrollToBottom()
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mb_bottom_strips_critical.png'),
    fullPage: false,
  })

  // Restore valid weights for the final assertion below
  await page.fill('input#station-0', '80')
  await page.waitForTimeout(150)

  console.log('9. confirm card 01 strip never disappears between cards …')
  // Scroll down slowly: track when "01 Aircraft" first appears in the stack
  // and confirm it stays in the stack as later strips are added.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  let card01InStack = false
  let everDisappeared = false
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => window.scrollBy(0, 250))
    await page.waitForTimeout(60)
    const has01 = (await page.locator('.prep-sticky-strip', { hasText: 'Aircraft' }).count()) > 0
    if (has01) card01InStack = true
    else if (card01InStack) everDisappeared = true
  }
  console.log('   card-01 strip first seen:', card01InStack)
  console.log('   card-01 strip ever disappeared again:', everDisappeared, '(should be false)')

  await browser.close()
  console.log('done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
