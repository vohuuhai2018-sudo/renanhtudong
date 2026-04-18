// Test: mở 1 conversation đã tạo ảnh, scan + download về máy
const { chromium } = require('playwright-extra')
const stealth = require('puppeteer-extra-plugin-stealth')
const path = require('path')
const os = require('os')
const fs = require('fs-extra')

chromium.use(stealth())

const URL = 'https://chatgpt.com/c/69e3bf09-a314-839d-8a77-2c4e56554abe'
const OUTPUT = '/Users/bephi/Downloads/AI'
const SAVE_PATH = path.join(OUTPUT, `SH_AI_test_${Date.now()}.png`)

;(async () => {
  const profileDir = path.join(os.homedir(), 'Library', 'Application Support', 'son-hai-ai-render', 'browser-profile-0')
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
  })

  const page = context.pages()[0] || await context.newPage()
  console.log(`🌐 Mở ${URL}`)
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(5000)

  // Dismiss popup
  await page.evaluate(() => {
    const keywords = ['đã hiểu', 'got it', 'ok', 'understand', 'tôi hiểu']
    document.querySelectorAll('button').forEach(b => {
      const t = (b.textContent || '').trim().toLowerCase()
      if (keywords.some(k => t.includes(k))) b.click()
    })
  })
  await page.waitForTimeout(1000)

  // ===== Scan ảnh generated =====
  console.log('🔍 Scan ảnh...')
  const imgInfo = await page.evaluate(() => {
    // Scan TẤT CẢ img có kích thước lớn (ảnh generated thường > 300px)
    const imgs = document.querySelectorAll('img')
    const results = []
    imgs.forEach(img => {
      const el = img
      const r = el.getBoundingClientRect()
      if (r.width < 200 || r.height < 200) return
      // Bỏ qua avatar, icon (thường < 100)
      if (!el.src || el.src.startsWith('data:')) return
      results.push({
        src: el.src,
        naturalW: el.naturalWidth,
        naturalH: el.naturalHeight,
        complete: el.complete,
        boxW: Math.round(r.width),
        boxH: Math.round(r.height),
        alt: el.alt || '',
        parentRole: el.closest('[data-message-author-role]')?.getAttribute('data-message-author-role') || 'none'
      })
    })
    const editBtn = Array.from(document.querySelectorAll('button')).find(b => {
      const t = (b.textContent || '').trim().toLowerCase()
      return t === 'chỉnh sửa' || t === 'edit'
    })
    return { images: results, hasEditBtn: !!editBtn }
  })
  console.log(JSON.stringify(imgInfo, null, 2))

  if (imgInfo.images.length === 0) {
    console.log('❌ Không tìm thấy ảnh assistant')
    await new Promise(() => {})
    return
  }

  // Pick ảnh lớn nhất trong assistant (ảnh generated)
  const largest = imgInfo.images
    .filter(i => i.boxW >= 300 && i.boxH >= 300 && i.complete && i.naturalW > 0)
    .sort((a, b) => (b.boxW * b.boxH) - (a.boxW * a.boxH))[0]

  if (!largest) {
    console.log('❌ Không có ảnh lớn + complete')
    await new Promise(() => {})
    return
  }

  console.log(`✅ Target ảnh: ${largest.boxW}x${largest.boxH} natural=${largest.naturalW}x${largest.naturalH}`)
  console.log(`   src: ${largest.src.substring(0, 120)}`)

  // ===== Download qua URL fetch (không cần click lightbox) =====
  await fs.ensureDir(OUTPUT)
  console.log(`📥 Fetch URL + save tới ${SAVE_PATH}`)
  try {
    const bytes = await page.evaluate(async (url) => {
      const r = await fetch(url)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const ab = await r.arrayBuffer()
      return Array.from(new Uint8Array(ab))
    }, largest.src)
    await fs.writeFile(SAVE_PATH, Buffer.from(bytes))
    const stat = await fs.stat(SAVE_PATH)
    console.log(`✅ Đã lưu ${stat.size} bytes tới ${SAVE_PATH}`)
  } catch (err) {
    console.error(`❌ Fetch lỗi: ${err.message}`)

    // ===== Fallback: click nút download icon (↓) =====
    console.log('🔄 Thử click nút download icon (↓) trong overlay...')
    const downloadBtn = page.locator('button[aria-label*="Tải xuống" i], button[aria-label*="Download" i], a[download]').first()
    try {
      const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
      await downloadBtn.click({ timeout: 5000 })
      const dl = await downloadPromise
      await dl.saveAs(SAVE_PATH)
      console.log(`✅ Đã tải qua click button tới ${SAVE_PATH}`)
    } catch (err2) {
      console.error(`❌ Fallback cũng lỗi: ${err2.message}`)
    }
  }

  console.log('\n✅ Done')
  await new Promise(() => {})
})().catch(e => { console.error('❌', e); process.exit(1) })
