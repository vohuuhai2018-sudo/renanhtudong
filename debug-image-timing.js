/**
 * Diagnostic script: mở ChatGPT (login sẵn) và log mọi state của ảnh đang generate
 * Chạy: node debug-image-timing.js [profile-index]
 * Sau khi browser mở, bắt đầu tạo ảnh thủ công. Script sẽ poll mỗi 500ms.
 * Khi "Stop button biến mất", script bắt đầu log naturalWidth + fetch bytes-length
 * để xác định thời điểm ảnh thật sự ổn định vs thời điểm các signal hiện tại trigger.
 */
const { chromium } = require('playwright-extra')
const stealth = require('puppeteer-extra-plugin-stealth')
const path = require('path')
const os = require('os')
const fs = require('fs-extra')

chromium.use(stealth())

;(async () => {
  const profileIndex = parseInt(process.argv[2] || '0', 10)
  const userDataRoot = path.join(os.homedir(), 'Library', 'Application Support', 'son-hai-ai-render')
  const profileDir = path.join(userDataRoot, `browser-profile-${profileIndex}`)
  await fs.ensureDir(profileDir)

  console.log(`📂 Profile: ${profileDir}`)
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled']
  })

  const page = context.pages()[0] || await context.newPage()
  await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('#prompt-textarea', { timeout: 30000 })
  console.log(`✅ ChatGPT đã load. Gửi prompt test...`)

  const prompt = 'Vẽ một cảnh vườn tropical có cổng sắt, cây cọ, bầu trời xanh — phong cách 3D render chi tiết.'
  await page.click('#prompt-textarea')
  await page.keyboard.type(prompt, { delay: 10 })
  await page.waitForTimeout(500)

  // Click nút send hoặc Enter
  const sendBtn = page.locator('button[data-testid="send-button"], button[aria-label="Send prompt"], button[aria-label="Gửi lời nhắc"]').first()
  await sendBtn.click().catch(() => page.keyboard.press('Enter'))
  console.log(`📤 Đã gửi prompt. Bắt đầu log signals mỗi 500ms...`)

  const t0 = Date.now()
  let firstStopGoneAt = null
  let firstEditAt = null
  let firstStableSrc = null
  let firstStableNwAt = null
  let lastNw = 0
  let sameNwCount = 0

  setInterval(async () => {
    try {
      const state = await page.evaluate(() => {
        const stopBtn = document.querySelector(
          'button[data-testid="stop-button"], button[aria-label*="Stop" i], button[aria-label*="Dừng" i]'
        )
        const editBtn = document.querySelector(
          '[aria-label*="Chỉnh sửa" i], [aria-label*="Edit image" i], button:has-text ? null : null'
        ) || Array.from(document.querySelectorAll('button')).find(b =>
          /chỉnh sửa|^edit$/i.test(b.textContent || '')
        )
        let best = null
        document.querySelectorAll('img').forEach(img => {
          const r = img.getBoundingClientRect()
          if (r.width < 200) return
          if (!img.src || img.src.startsWith('data:')) return
          if (img.closest('[data-message-author-role="user"]')) return
          if (!best || r.width * r.height > best.area) {
            best = {
              src: img.src,
              nw: img.naturalWidth,
              nh: img.naturalHeight,
              complete: img.complete,
              alt: img.alt || '',
              area: r.width * r.height
            }
          }
        })
        return { stillGen: !!stopBtn, hasEdit: !!editBtn, best }
      })

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      if (!state.stillGen && firstStopGoneAt === null) {
        firstStopGoneAt = elapsed
        console.log(`[${elapsed}s] ⏹  Stop button biến mất`)
      }
      if (state.hasEdit && firstEditAt === null) {
        firstEditAt = elapsed
        console.log(`[${elapsed}s] ✏️  Edit button xuất hiện`)
      }
      if (state.best) {
        if (firstStableSrc === null) {
          firstStableSrc = state.best.src
          console.log(`[${elapsed}s] 🖼  img.src = ${state.best.src.substring(0, 100)}...`)
        }
        if (state.best.nw !== lastNw) {
          console.log(`[${elapsed}s] 📏 naturalWidth: ${lastNw} → ${state.best.nw} (h=${state.best.nh}) complete=${state.best.complete}`)
          lastNw = state.best.nw
          sameNwCount = 0
        } else {
          sameNwCount++
          if (sameNwCount === 16 && firstStableNwAt === null) {
            // 16 samples × 500ms = 8s ổn định
            firstStableNwAt = elapsed
            console.log(`[${elapsed}s] ✅ naturalWidth ĐÃ ỔN ĐỊNH 8s ở ${lastNw}px`)
          }
        }
      }
    } catch (e) {
      // ignore transient eval errors
    }
  }, 500)
})().catch(err => { console.error(err); process.exit(1) })
