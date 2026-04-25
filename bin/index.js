#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import readline from "node:readline";
import os from "node:os";

// =========================
// Paths
// =========================
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.cwd();

// =========================
// Utils
// =========================
function log(msg) {
  console.log(msg);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Template não encontrado: ${src}`);
  }

  ensureDir(dest);

  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);

    const stat = fs.lstatSync(srcPath);

    if (stat.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

function generateRandom(length) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function appendIfMissing(content, key, value) {
  if (!content.includes(`${key}=`)) {
    return content + `\n${key}=${value}`;
  }
  return content;
}

function getEnvValue(key) {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) return null;

  const content = fs.readFileSync(envPath, "utf-8");
  const match = content.match(new RegExp(`${key}=(.*)`));
  return match ? match[1].trim() : null;
}

// =========================
// .env
// =========================
function createEnv() {
  const envPath = path.join(projectRoot, ".env");

  let content = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf-8")
    : "";

  const projectName = path.basename(projectRoot);

  content = appendIfMissing(content, "MAESS_MEMORY_SYSTEM_NAME", projectName);
  content = appendIfMissing(content, "MAESS_MEMORY_AMBIENTE", "dev");

  content = appendIfMissing(content, "MONGO_PORT", "27017");
  content = appendIfMissing(content, "MONGO_INITDB_ROOT_USERNAME", "maess");
  content = appendIfMissing(content, "MONGO_INITDB_ROOT_PASSWORD", generateRandom(12));
  content = appendIfMissing(content, "MONGO_DATABASE", "maess_memory");

  content = appendIfMissing(content, "HOST_HTTP_PORT", "3000");
  content = appendIfMissing(content, "ASPNETCORE_ENVIRONMENT", "Development");

  content = appendIfMissing(content, "BOOTSTRAP_ADMIN_USUARIO_EMAIL", "admin@maess.dev");
  content = appendIfMissing(content, "BOOTSTRAP_ADMIN_USUARIO_NOME", "Admin");
  content = appendIfMissing(content, "BOOTSTRAP_ADMIN_USUARIO_SECRET", generateRandom(16));
  content = appendIfMissing(content, "BOOTSTRAP_ADMIN_USUARIO_APIKEY", generateRandom(24));

  fs.writeFileSync(envPath, content.trim() + "\n");

  log("✅ .env configurado!");
}

// =========================
// Docker
// =========================
function setupDocker() {
  const dockerSrc = path.join(__dirname, "../templates/docker");
  const dockerDest = path.join(projectRoot, ".maess");

  log("🐳 Configurando Docker...");
  copyRecursive(dockerSrc, dockerDest);
  log("✅ Docker configurado!");
}

function hasDocker() {
  try {
    execSync("docker --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function startDocker() {
  if (!hasDocker()) {
    log("❌ Docker não encontrado.");
    log("👉 Instale o Docker Desktop.");
    return;
  }

  try {
    log("🚀 Iniciando Maess Memory...\n");

    execSync(
      "docker compose -f .maess/docker-compose.maess.yml up -d",
      { stdio: "inherit" }
    );

    log("\n🎉 Maess Memory rodando!");
    log("🌐 http://localhost:3000\n");
  } catch {
    log("❌ Erro ao iniciar Docker.");
  }
}

// =========================
// Codex
// =========================
function setupCodex() {
  const hooksDest = path.join(projectRoot, ".codex/hooks");
  const hooksSrc = path.join(__dirname, "../templates/hooks");

  const hooksConfigSrc = path.join(__dirname, "../templates/codex/hooks.json");
  const hooksConfigDest = path.join(projectRoot, ".codex/hooks.json");

  log("📦 Instalando hooks do Codex...");

  ensureDir(path.join(projectRoot, ".codex"));
  copyRecursive(hooksSrc, hooksDest);

  fs.copyFileSync(hooksConfigSrc, hooksConfigDest);

  try {
    const hookProbePath = path.join(hooksDest, "hook_probe.sh");
    const currentMode = fs.statSync(hookProbePath).mode;
    fs.chmodSync(hookProbePath, currentMode | 0o111);
  } catch {
    log("⚠️ chmod ignorado (Windows)");
  }

  log("✅ Hooks configurados!");
}

// =========================
// Codex Config
// =========================
function findCodexConfig() {
  const home = os.homedir();

  return [
    path.join(home, ".codex", "config.toml"),
    path.join(home, ".config", "codex", "config.toml"),
  ].find(p => fs.existsSync(p));
}

function ensureHooksEnabled(content) {
  if (content.includes("hooks =")) {
    return content.replace(/hooks\s*=\s*(true|false)/, "hooks = true");
  }

  if (content.includes("[features]")) {
    return content.replace("[features]", `[features]\nhooks = true`);
  }

  return content + `\n[features]\nhooks = true\n`;
}

function ensureMcpServer(content, apiKey) {
  if (content.includes("[mcp_servers.maess]")) {
    return content;
  }

  return content + `
[mcp_servers.maess]
command = "npx"
args = ["maess-memory", "mcp"]
env = { MAESS_API_KEY = "${apiKey}" }
`;
}

async function setupCodexConfig() {
  const configPath = findCodexConfig();

  if (!configPath) {
    log("⚠️ Codex não encontrado.");
    return;
  }

  let content = fs.readFileSync(configPath, "utf-8");

  const apiKey = getEnvValue("BOOTSTRAP_ADMIN_USUARIO_APIKEY");

  content = ensureHooksEnabled(content);
  content = ensureMcpServer(content, apiKey);

  fs.writeFileSync(configPath, content);

  log("✅ Codex configurado com MCP!");
}

// =========================
// Validação
// =========================
function validateEnvironment() {
  try {
    execSync("python3 --version", { stdio: "ignore" });
  } catch {
    log("⚠️ python3 não encontrado");
  }
}

// =========================
// CLI
// =========================
async function init() {
  log("🚀 Configurando Maess Memory...\n");

  validateEnvironment();
  createEnv();
  setupDocker();
  setupCodex();
  await setupCodexConfig();

  log("\n🎉 Setup concluído!");
  log("👉 Rode: npx maess-memory start\n");
}

function start() {
  startDocker();
}

// =========================
// Entry (CORRIGIDO)
// =========================
(async () => {
  const command = process.argv[2];

  switch (command) {
    case "init":
      await init();
      break;
    case "start":
      start();
      break;
    default:
      log("Uso:");
      log("  npx maess-memory init");
      log("  npx maess-memory start");
  }
})();