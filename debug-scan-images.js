// Debug: scan TẤT CẢ img trong conversation, phân biệt user-upload vs assistant-generated
const { chromium } = require('playwright-extra')
const stealth = require('puppeteer-extra-plugin-stealth')
const path = require('path')
const os = require('os')

chromium.use(stealth())

const URL = 'https://chatgpt.com/c/69e3bf09-a314-839d-8a77-2c4e56554abe'

;(async () => {
  const profileDir = path.join(os.homedir(), 'Library', 'Application Support', 'son-hai-ai-render', 'browser-profile-0')
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
  })

  const page = context.pages()[0] || await context.newPage()
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(5000)

  await page.evaluate(() => {
    const kw = ['đã hiểu', 'got it', 'ok', 'understand']
    document.querySelectorAll('button').forEach(b => {
      const t = (b.textContent || '').trim().toLowerCase()
      if (kw.some(k => t.includes(k))) b.click()
    })
  })
  await page.waitForTimeout(1500)

  const analysis = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img')
    const results = []
    imgs.forEach((img, idx) => {
      const el = img
      const r = el.getBoundingClientRect()
      if (r.width < 150 || r.height < 150) return
      if (!el.src || el.src.startsWith('data:')) return

      // Tổ tiên message
      const userMsg = el.closest('[data-message-author-role="user"]')
      const assistantMsg = el.closest('[data-message-author-role="assistant"]')
      // Tổ tiên là button (thumbnail nhỏ trong upload preview)
      const insideButton = el.closest('button')
      // Có nút "Chỉnh sửa" / "Edit" cùng parent?
      const sameParent = el.parentElement?.parentElement?.parentElement
      const hasEditBtn = sameParent ? !!Array.from(sameParent.querySelectorAll('button')).find(b =>
        ['chỉnh sửa', 'edit'].includes((b.textContent || '').trim().toLowerCase())
      ) : false

      results.push({
        idx,
        src: el.src.substring(0, 130),
        alt: (el.alt || '').substring(0, 80),
        naturalW: el.naturalWidth,
        naturalH: el.naturalHeight,
        boxW: Math.round(r.width),
        boxH: Math.round(r.height),
        insideUser: !!userMsg,
        insideAssistant: !!assistantMsg,
        insideButton: !!insideButton,
        hasEditBtn,
        // Text node trước/sau để xác định context
        prevSibling: (el.parentElement?.previousElementSibling?.textContent || '').substring(0, 40).trim(),
        parentRole: el.parentElement?.getAttribute('role') || 'none'
      })
    })
    return results
  })

  console.log('\n=== IMAGE SCAN ANALYSIS ===')
  console.log(JSON.stringify(analysis, null, 2))

  // Lọc: ảnh generated = có alt "Ảnh đã tạo" hoặc hasEditBtn, KHÔNG inside user message
  console.log('\n=== CANDIDATES: GENERATED IMAGES ===')
  const generated = analysis.filter(a =>
    !a.insideUser &&
    !a.insideButton &&
    (a.alt.toLowerCase().startsWith('ảnh đã tạo') ||
     a.alt.toLowerCase().startsWith('generated image') ||
     a.alt.toLowerCase().startsWith('image generated') ||
     a.hasEditBtn)
  )
  console.log(JSON.stringify(generated, null, 2))

  console.log('\n=== CANDIDATES: UPLOADED (SHOULD SKIP) ===')
  const uploaded = analysis.filter(a => a.insideUser)
  console.log(JSON.stringify(uploaded, null, 2))

  console.log('\n✅ Done')
  await new Promise(() => {})
})().catch(e => { console.error('❌', e); process.exit(1) })
