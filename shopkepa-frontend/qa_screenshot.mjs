import { launch } from 'puppeteer-core'

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5174'

const browser = await launch({
  executablePath: EDGE_PATH,
  headless: true,
  args: ['--no-sandbox'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })

await page.type('input[type="email"]', 'qa-verify-temp@example.com')
await page.type('input[type="password"]', 'TempPass123!')
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}),
  page.click('button[type="submit"]'),
])
await new Promise(r => setTimeout(r, 1500))

console.log('URL after login:', page.url())
await page.screenshot({ path: 'qa_shot_desktop_collapsed.png' })

// Hover over the rail to trigger the expand state
await page.mouse.move(30, 300)
await new Promise(r => setTimeout(r, 400))
await page.screenshot({ path: 'qa_shot_desktop_expanded.png' })

// Mobile viewport
await page.setViewport({ width: 390, height: 800 })
await new Promise(r => setTimeout(r, 400))
await page.screenshot({ path: 'qa_shot_mobile_collapsed.png' })

// Tap the hamburger
const hamburger = await page.$('.rail-hamburger')
if (hamburger) {
  await hamburger.click()
  await new Promise(r => setTimeout(r, 400))
  await page.screenshot({ path: 'qa_shot_mobile_open.png' })
} else {
  console.log('hamburger not found')
}

await browser.close()
console.log('done')
