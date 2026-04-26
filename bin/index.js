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

  content = appendIfMissing(content, "BOOTSTRAP_ADMIN_TENANT_NOME", "maess");
  content = appendIfMissing(content, "BOOTSTRAP_ADMIN_TENANT_EMAIL_CONTATO", "admin@maess.dev");
  content = appendIfMissing(content, "BOOTSTRAP_ADMIN_TENANT_TELEFONE_CONTATO", "000000000");

  content = appendIfMissing(content, "MAESS_ENV", "local");
  content = appendIfMissing(content, "MAESS_PLAN", "free");

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

function runDockerCompose(args, successMessage, errorMessage, options = {}) {
  if (!hasDocker()) {
    log("❌ Docker não encontrado.");
    log("👉 Instale o Docker Desktop.");
    return;
  }

  try {
    execSync(
      `docker compose --env-file .env -f .maess/docker-compose.maess.yml ${args}`,
      { stdio: "inherit" }
    );

    if (successMessage) {
      log(`\n${successMessage}`);
    }
  } catch (error) {
    if (options.ignoreInterrupt && error?.signal === "SIGINT") {
      return;
    }

    log(errorMessage);
  }
}

function startDocker() {
  log("🚀 Iniciando Maess Memory...\n");
  runDockerCompose(
    "up -d",
    "🎉 Maess Memory rodando!\n🌐 http://localhost:3000",
    "❌ Erro ao iniciar Docker."
  );
}

function stopDocker() {
  log("🛑 Parando os containers do Maess Memory...\n");
  runDockerCompose(
    "stop",
    "✅ Containers parados.",
    "❌ Erro ao parar os containers."
  );
}

function downDocker() {
  log("🧹 Removendo stack do Maess Memory...\n");
  runDockerCompose(
    "down -v",
    "✅ Stack removida.",
    "❌ Erro ao executar docker compose down -v."
  );
}

function restartDocker() {
  log("🔄 Reiniciando os containers do Maess Memory...\n");
  runDockerCompose(
    "restart",
    "✅ Containers reiniciados.",
    "❌ Erro ao reiniciar os containers."
  );
}

function statusDocker() {
  log("📊 Status atual do Maess Memory...\n");
  runDockerCompose(
    "ps",
    "",
    "❌ Erro ao consultar o status dos containers."
  );
}

function logsDocker(extraArgs = "") {
  log("📜 Exibindo logs do Maess Memory...\n");
  runDockerCompose(
    `logs -f ${extraArgs}`.trim(),
    "",
    "❌ Erro ao exibir os logs.",
    { ignoreInterrupt: true }
  );
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
  const blockName = "[mcp_servers.maess-memory]";

  if (content.includes(blockName)) {
    // atualiza se já existir
    return content.replace(
      /\[mcp_servers\.maess-memory\][\s\S]*?(?=\n\[|$)/,
      `[mcp_servers.maess-memory]
enabled = true
url = "http://127.0.0.1:3000/mcp"

[mcp_servers.maess-memory.http_headers]
ApiKey = "${apiKey}"
`
    );
  }

  // adiciona novo
  return content + `

[mcp_servers.maess-memory]
enabled = true
url = "http://127.0.0.1:3000/mcp"

[mcp_servers.maess-memory.http_headers]
ApiKey = "${apiKey}"
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
  log("👉 Rode: maess start\n");
}

function start() {
  startDocker();
}

function printUsage() {
  log("🧠 Maess Memory CLI");
  log("");
  log("Comandos:");
  log("");
  log("  init      Configura hooks e MCP server");
  log("  start     Sobe o ambiente");
  log("  status    Mostra o estado atual");
  log("  logs      Exibe logs (ex: maess logs host)");
  log("");
  log("  stop      Para o ambiente");
  log("  restart   Reinicia o ambiente");
  log("  down      Remove tudo");
  log("");
  log("💡 Comece com:");
  log("  npx maess init");
  log("  npx maess start");
  log("");
  log("🚀 Fluxo recomendado:");
  log("  maess init → maess start → maess status");
}

// =========================
// Entry (CORRIGIDO)
// =========================
(async () => {
  const [command, ...commandArgs] = process.argv.slice(2);

  switch (command) {
    case "init":
      await init();
      break;
    case "start":
    case "up":
      start();
      break;
    case "stop":
      stopDocker();
      break;
    case "restart":
      restartDocker();
      break;
    case "down":
      downDocker();
      break;
    case "status":
    case "ps":
      statusDocker();
      break;
    case "logs":
      logsDocker(commandArgs.join(" "));
      break;
    case "help":
    case "--help":
    case "-h":
      printUsage();
      break;
    default:
      printUsage();
  }
})();
