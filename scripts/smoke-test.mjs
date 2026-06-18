import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { createConnection } from "node:net";

const PORT = 5108;
const BASE_URL = `http://localhost:${PORT}`;
const STARTUP_TIMEOUT = 30000;
const PAGE_WAIT_TIMEOUT = 10000;

let serverProc = null;
let browser = null;
let failed = false;

function log(msg) {
  console.log(`[smoke] ${msg}`);
}

function fail(msg) {
  console.error(`[smoke] FAIL: ${msg}`);
  failed = true;
}

async function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function startServer() {
  const portInUse = await isPortInUse(PORT);
  if (portInUse) {
    throw new Error(`端口 ${PORT} 已被占用，请先关闭占用该端口的进程`);
  }

  log("启动预览服务...");
  serverProc = spawn("npx", ["vite", "preview", "--host", "0.0.0.0", "--port", String(PORT)], {
    stdio: "pipe",
    shell: false,
  });

  serverProc.stderr.on("data", (data) => {
    process.stderr.write(`[server] ${data}`);
  });

  const start = Date.now();
  while (Date.now() - start < STARTUP_TIMEOUT) {
    try {
      const res = await fetch(`${BASE_URL}/`);
      if (res.ok) {
        log("预览服务已就绪");
        return;
      }
    } catch {
      // 服务还没起来，继续等
    }
    await setTimeout(500);
  }

  throw new Error("预览服务启动超时");
}

async function runChecks() {
  const { chromium } = await import("playwright");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  log("访问首页...");
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: PAGE_WAIT_TIMEOUT });
  await page.waitForLoadState("networkidle", { timeout: PAGE_WAIT_TIMEOUT });

  log("检查 1: 首页标题和内容加载");
  const title = await page.title();
  const hasHeroTitle = await page.locator("h1").first().isVisible();
  const heroText = await page.locator("h1").first().textContent();
  if (!title) {
    fail("页面没有 title");
  } else {
    log(`  页面标题: ${title}`);
  }
  if (!hasHeroTitle || !heroText?.includes("葡萄酒盲品训练")) {
    fail("首页标题未正确渲染");
  } else {
    log("  ✓ 首页标题正确");
  }

  log("检查 2: IndexedDB 初始化不阻塞页面");
  const idbResult = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const req = indexedDB.open("hxwl-08-unified-store", 1);
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        resolve({ ok: false, error: "timeout" });
      }, 5000);

      req.onsuccess = () => {
        if (timedOut) return;
        clearTimeout(timer);
        req.result.close();
        resolve({ ok: true });
      };
      req.onerror = () => {
        if (timedOut) return;
        clearTimeout(timer);
        resolve({ ok: false, error: req.error?.message || "unknown" });
      };
      req.onblocked = () => {
        if (timedOut) return;
        clearTimeout(timer);
        resolve({ ok: false, error: "blocked" });
      };
    });
  });

  if (!idbResult.ok) {
    fail(`IndexedDB 初始化失败或阻塞: ${idbResult.error}`);
  } else {
    log("  ✓ IndexedDB 初始化正常");
  }

  if (errors.length > 0) {
    fail(`页面有 JS 错误: ${errors.join("; ")}`);
  }

  log("检查 3: 记录列表区域渲染");
  const recordsSection = page.locator("section.records");
  const recordsHeading = page.locator("section.records h2");
  const hasRecordsSection = await recordsSection.isVisible({ timeout: 3000 }).catch(() => false);
  const hasRecordsHeading = await recordsHeading.isVisible({ timeout: 3000 }).catch(() => false);
  if (!hasRecordsSection || !hasRecordsHeading) {
    fail("记录列表区域未渲染");
  } else {
    const headingText = await recordsHeading.textContent();
    log(`  ✓ 记录列表区域已渲染（${headingText}）`);
  }

  log("检查 4: 盲品测验入口渲染");
  const quizSection = page.locator("section.blind-quiz").first();
  const quizHeading = quizSection.locator("h2").first();
  const hasQuizSection = await quizSection.isVisible({ timeout: 3000 }).catch(() => false);
  const hasQuizHeading = await quizHeading.isVisible({ timeout: 3000 }).catch(() => false);
  if (!hasQuizSection || !hasQuizHeading) {
    fail("盲品测验入口未渲染");
  } else {
    const quizText = await quizHeading.textContent();
    log(`  ✓ 测验入口已渲染（${quizText}）`);
  }

  await browser.close();
  browser = null;
}

async function cleanup() {
  log("清理资源...");
  if (browser) {
    try { await browser.close(); } catch {}
    browser = null;
  }
  if (serverProc) {
    serverProc.kill("SIGTERM");
    await setTimeout(500);
    if (!serverProc.killed) {
      serverProc.kill("SIGKILL");
    }
    serverProc = null;
  }
}

async function main() {
  try {
    await startServer();
    await runChecks();

    if (failed) {
      log("❌ 冒烟测试未通过");
      process.exit(1);
    } else {
      log("✅ 冒烟测试通过");
      process.exit(0);
    }
  } catch (err) {
    console.error(`[smoke] 错误: ${err.message}`);
    await cleanup();
    process.exit(1);
  } finally {
    await cleanup();
  }
}

process.on("SIGINT", async () => {
  await cleanup();
  process.exit(1);
});

main();
