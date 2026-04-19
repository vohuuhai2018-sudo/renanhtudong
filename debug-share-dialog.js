/**
 * Click nút Chia sẻ hình ảnh và dump FULL DOM của dialog share để
 * tìm selector chính xác cho nút Tải xuống.
 */
const { chromium } = require('playwright-extra')
const stealth = require('puppeteer-extra-plugin-stealth')
const path = require('path')
const os = require('os')
const fs = require('fs-extra')

chromium.use(stealth())

const TARGET_URL = 'https://chatgpt.com/c/69e3bf09-a314-839d-8a77-2c4e56554abe'

;(async () => {
  const profileDir = path.join(os.homedir(), 'Library', 'Application Support', 'son-hai-ai-render', 'browser-profile-0')
  await fs.ensureDir(profileDir)

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1400, height: 950 },
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled']
  })
  const page = context.pages()[0] || await context.newPage()
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  console.log(`✅ Loaded`)
  await page.waitForTimeout(4000)

  // Click Chia sẻ hình ảnh
  const shareBtn = page.locator('button[aria-label="Chia sẻ hình ảnh này"]').first()
  await shareBtn.click()
  console.log(`📤 Clicked share`)
  await page.waitForTimeout(2500)

  // Dump role=dialog
  const dialogInfo = await page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'))
    return dialogs.map(d => ({
      ariaLabel: d.getAttribute('aria-label') || '',
      text: (d.textContent || '').substring(0, 300),
      html: d.outerHTML.substring(0, 3000)
    }))
  })
  console.log(`\n=== DIALOGS (${dialogInfo.length}) ===`)
  dialogInfo.forEach((d, i) => {
    console.log(`\n--- Dialog ${i} aria-label: "${d.ariaLabel}" ---`)
    console.log(`TEXT: ${d.text}`)
    console.log(`HTML: ${d.html}`)
  })

  // Dump tất cả button trong viewport
  const allVisibleBtns = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => {
      const r = b.getBoundingClientRect()
      if (r.width === 0) return null
      // Check if in dialog
      const inDialog = !!b.closest('[role="dialog"]')
      if (!inDialog) return null
      return {
        ariaLabel: b.getAttribute('aria-label') || '',
        text: (b.textContent || '').trim().substring(0, 80),
        testid: b.getAttribute('data-testid') || '',
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        svgTitle: b.querySelector('svg title')?.textContent || '',
        innerHTML: b.innerHTML.substring(0, 200)
      }
    }).filter(Boolean)
  })
  console.log(`\n=== ALL BUTTONS IN DIALOG (${allVisibleBtns.length}) ===`)
  allVisibleBtns.forEach(b => console.log(JSON.stringify(b)))

  // Also anchors
  const allAnchors = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => {
      const r = a.getBoundingClientRect()
      if (r.width === 0) return null
      const inDialog = !!a.closest('[role="dialog"]')
      if (!inDialog) return null
      return {
        href: a.getAttribute('href'),
        download: a.getAttribute('download'),
        text: (a.textContent || '').trim().substring(0, 40),
        ariaLabel: a.getAttribute('aria-label') || ''
      }
    }).filter(Boolean)
  })
  console.log(`\n=== ALL ANCHORS IN DIALOG (${allAnchors.length}) ===`)
  allAnchors.forEach(a => console.log(JSON.stringify(a)))

  console.log(`\n=== Done. Browser stays 30s ===`)
  await page.waitForTimeout(30000)
  await context.close()
})().catch(e => { console.error(e); process.exit(1) })
