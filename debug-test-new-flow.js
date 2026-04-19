/**
 * Test flow DOWNLOAD MỚI: share → Tải xuống trên URL ChatGPT anh đưa.
 * Kiểm tra bytes tải về có validate đúng không.
 */
const { chromium } = require('playwright-extra')
const stealth = require('puppeteer-extra-plugin-stealth')
const path = require('path')
const os = require('os')
const fs = require('fs-extra')
const Jimp = require('jimp')

chromium.use(stealth())

const TARGET_URL = 'https://chatgpt.com/c/69e3bf09-a314-839d-8a77-2c4e56554abe'
const OUTPUT = path.join(os.homedir(), 'Downloads', 'sh-new-flow-test.png')

;(async () => {
  const profileDir = path.join(os.homedir(), 'Library', 'Application Support', 'son-hai-ai-render', 'browser-profile-0')
  const ctx = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1400, height: 950 },
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled']
  })
  const page = ctx.pages()[0] || await ctx.newPage()
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(4000)

  // Scan target image
  const info = await page.evaluate(() => {
    let best = null
    document.querySelectorAll('img').forEach(img => {
      const r = img.getBoundingClientRect()
      if (r.width < 200 || !img.src || img.src.startsWith('data:')) return
      if (img.closest('[data-message-author-role="user"]')) return
      const a = r.width * r.height
      if (!best || a > best.a) best = { src: img.src, nw: img.naturalWidth, nh: img.naturalHeight, a }
    })
    return best
  })
  console.log(`🎯 Target: nw=${info.nw}, nh=${info.nh}`)
  console.log(`   URL: ${info.src.substring(0, 100)}...`)

  // FLOW MỚI: share → Tải xuống
  const imgLoc = page.locator(`img[src="${info.src.replace(/"/g, '\\"')}"]`).first()
  await imgLoc.scrollIntoViewIfNeeded().catch(() => {})
  await imgLoc.hover().catch(() => {})
  await page.waitForTimeout(500)

  console.log(`📤 Click share...`)
  await page.locator('button[aria-label="Chia sẻ hình ảnh này"]').first().click({ timeout: 8000 })
  await page.waitForTimeout(2500)

  console.log(`📥 Click Tải xuống...`)
  const dlPromise = page.waitForEvent('download', { timeout: 20000 })
  await page.locator('[role="dialog"] button:has-text("Tải xuống")').first().click({ timeout: 8000 })
  const dl = await dlPromise
  await dl.saveAs(OUTPUT)

  const stat = await fs.stat(OUTPUT)
  console.log(`✅ Downloaded ${(stat.size / 1024).toFixed(0)} KB → ${OUTPUT}`)

  // Validate with Jimp
  const img = await Jimp.read(OUTPUT)
  console.log(`📐 Decoded: ${img.getWidth()}x${img.getHeight()}`)
  console.log(`   Expected nw ${info.nw}, got ${img.getWidth()} — diff ${Math.abs(img.getWidth() - info.nw)}`)
  if (Math.abs(img.getWidth() - info.nw) / info.nw < 0.08) {
    console.log(`✅ VALID — ảnh khớp kích thước DOM`)
  } else {
    console.log(`❌ LỆCH — có thể là partial`)
  }

  await page.waitForTimeout(5000)
  await ctx.close()
})().catch(e => { console.error(e); process.exit(1) })
