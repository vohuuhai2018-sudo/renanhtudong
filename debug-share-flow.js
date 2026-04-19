/**
 * Mở URL ChatGPT anh đưa, inspect UI share/download để tìm selector chính xác.
 * Sẽ log:
 * - Các button có aria-label liên quan download/share
 * - DOM structure của action bar quanh ảnh
 * - Kết quả khi click share → menu share hiện
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
  console.log(`✅ Đã load chat URL`)
  await page.waitForTimeout(5000)

  // 1) Find all images
  const imgs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src,
      alt: img.alt,
      nw: img.naturalWidth,
      w: img.getBoundingClientRect().width,
      inUserMsg: !!img.closest('[data-message-author-role="user"]')
    })).filter(i => i.w >= 200)
  })
  console.log(`🖼 Images found:`, JSON.stringify(imgs, null, 2))

  // 2) Hover vào assistant image để lộ action buttons
  const assistantImg = page.locator('img:not([alt*=""])').filter({
    has: page.locator('xpath=ancestor::*[@data-message-author-role="assistant"]')
  }).first()

  const imgLocator = page.locator('[data-message-author-role="assistant"] img').first()
  try {
    await imgLocator.scrollIntoViewIfNeeded()
    await imgLocator.hover()
    await page.waitForTimeout(1000)
  } catch (e) { console.log('hover fail:', e.message) }

  // 3) Liệt kê tất cả button có thể là download/share
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => {
      const r = b.getBoundingClientRect()
      return {
        visible: r.width > 0 && r.height > 0,
        ariaLabel: b.getAttribute('aria-label') || '',
        testid: b.getAttribute('data-testid') || '',
        text: (b.textContent || '').trim().substring(0, 60),
        hasSvg: !!b.querySelector('svg'),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
      }
    }).filter(b => b.visible && (
      /download|tải|share|chia sẻ/i.test(b.ariaLabel) ||
      /download|tải|share|chia sẻ/i.test(b.text)
    ))
  })
  console.log(`\n🔘 Buttons related download/share:`)
  buttons.forEach(b => console.log(JSON.stringify(b)))

  // 4) Click share button và xem menu share
  console.log(`\n--- Clicking share button... ---`)
  try {
    const shareBtn = page.locator(
      'button[aria-label*="share" i], button[aria-label*="chia sẻ" i]'
    ).first()
    await shareBtn.click({ timeout: 5000 })
    await page.waitForTimeout(2000)

    const shareMenu = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a')).map(el => {
        const r = el.getBoundingClientRect()
        return {
          tag: el.tagName,
          visible: r.width > 0 && r.height > 0,
          text: (el.textContent || '').trim().substring(0, 40),
          ariaLabel: el.getAttribute('aria-label') || '',
          href: el.tagName === 'A' ? el.getAttribute('href') : null
        }
      }).filter(b => b.visible && /tải xuống|download/i.test(b.text + ' ' + b.ariaLabel))
    })
    console.log(`📥 Download elements in share menu:`)
    shareMenu.forEach(b => console.log(JSON.stringify(b)))

    // Set up download handler
    const downloadsDir = path.join(os.homedir(), 'Downloads', 'shtest')
    await fs.ensureDir(downloadsDir)
    const dlPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null)

    const downloadBtn = page.locator(
      'button:has-text("Tải xuống"), button:has-text("Download"), a[download]'
    ).first()
    await downloadBtn.click({ timeout: 5000 }).catch(e => console.log('click dl fail:', e.message))

    const dl = await dlPromise
    if (dl) {
      const savePath = path.join(downloadsDir, `test-${Date.now()}.png`)
      await dl.saveAs(savePath)
      const stat = await fs.stat(savePath)
      console.log(`✅ Đã tải ${(stat.size / 1024).toFixed(0)} KB → ${savePath}`)
    } else {
      console.log(`⚠️ Không bắt được download event`)
    }
  } catch (e) {
    console.log(`❌ Share flow error: ${e.message}`)
  }

  console.log(`\n=== DONE. Browser stays open for 30s ===`)
  await page.waitForTimeout(30000)
  await context.close()
})().catch(e => { console.error(e); process.exit(1) })
