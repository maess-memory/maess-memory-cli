#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import readline from "node:readline";
import os from "node:os";
import net from "node:net";

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

function removePathIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return false;
  }

  fs.rmSync(targetPath, { recursive: true, force: true });
  return true;
}

function removeFileIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return false;
  }

  fs.unlinkSync(targetPath);
  return true;
}

function removeDirIfEmpty(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  if (!fs.lstatSync(targetPath).isDirectory()) {
    return;
  }

  if (fs.readdirSync(targetPath).length === 0) {
    fs.rmdirSync(targetPath);
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

function getHostHttpPort() {
  return getEnvValue("HOST_HTTP_PORT") || "3000";
}

function isValidPort(port) {
  const portNumber = Number(port);
  return Number.isInteger(portNumber) && portNumber >= 1 && portNumber <= 65535;
}

function isPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer();

    server.once("error", error => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }

      resolve(true);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(Number(port), "127.0.0.1");
  });
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

  content = appendIfMissing(content, "MONGO_INITDB_ROOT_USERNAME", "maess");
  content = appendIfMissing(content, "MONGO_INITDB_ROOT_PASSWORD", generateRandom(12));
  content = appendIfMissing(content, "MONGO_DATABASE", "maess_memory");

  content = appendIfMissing(content, "HOST_HTTP_PORT", "3000");
  content = appendIfMissing(content, "ASPNETCORE_ENVIRONMENT", "Development");

  content = appendIfMissing(content, "BOOTSTRAP_ADMIN_USUARIO_EMAIL", "admin@maess.dev");
  content = appendIfMissing(content, "BOOTSTRAP_ADMIN_USUARIO_NOME", "Admin");
  content = appendIfMissing(content, "BOOTSTRAP_ADMIN_USUARIO_SECRET", generateRandom(16));
  content = appendIfMissing(content, "BOOTSTRAP_ADMIN_USUARIO_APIKEY", generateRandom(24));
  content = appendIfMissing(content, "JWT_AUTH_SIGNING_KEY", generateRandom(64));

  content = appendIfMissing(content, "BOOTSTRAP_ADMIN_TENANT_NOME", "maess");
  content = appendIfMissing(content, "BOOTSTRAP_ADMIN_TENANT_EMAIL_CONTATO", "admin@maess.dev");
  content = appendIfMissing(content, "BOOTSTRAP_ADMIN_TENANT_TELEFONE_CONTATO", "000000000");

  content = appendIfMissing(content, "MAESS_ENV", "local");
  content = appendIfMissing(content, "MAESS_PLAN", "free");

  fs.writeFileSync(envPath, content.trim() + "\n");

  log("✅ .env configurado!");
}

const MAESS_ENV_KEYS = [
  "MAESS_MEMORY_SYSTEM_NAME",
  "MAESS_MEMORY_AMBIENTE",
  "MONGO_PORT",
  "MONGO_INITDB_ROOT_USERNAME",
  "MONGO_INITDB_ROOT_PASSWORD",
  "MONGO_DATABASE",
  "HOST_HTTP_PORT",
  "ASPNETCORE_ENVIRONMENT",
  "BOOTSTRAP_ADMIN_USUARIO_EMAIL",
  "BOOTSTRAP_ADMIN_USUARIO_NOME",
  "BOOTSTRAP_ADMIN_USUARIO_SECRET",
  "BOOTSTRAP_ADMIN_USUARIO_APIKEY",
  "JWT_AUTH_SIGNING_KEY",
  "BOOTSTRAP_ADMIN_TENANT_NOME",
  "BOOTSTRAP_ADMIN_TENANT_EMAIL_CONTATO",
  "BOOTSTRAP_ADMIN_TENANT_TELEFONE_CONTATO",
  "MAESS_ENV",
  "MAESS_PLAN",
];

function removeManagedEnvEntries() {
  const envPath = path.join(projectRoot, ".env");

  if (!fs.existsSync(envPath)) {
    log("ℹ️ .env não encontrado, nada para limpar.");
    return;
  }

  const content = fs.readFileSync(envPath, "utf-8");
  const lines = content.split(/\r?\n/);
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return true;
    }

    const [key] = trimmed.split("=", 1);
    return !MAESS_ENV_KEYS.includes(key);
  });

  const cleanedContent = filteredLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  if (!cleanedContent) {
    fs.unlinkSync(envPath);
    log("✅ .env removido.");
    return;
  }

  fs.writeFileSync(envPath, `${cleanedContent}\n`);
  log("✅ Entradas do Maess Memory removidas do .env!");
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

function removeDockerFiles() {
  const dockerDir = path.join(projectRoot, ".maess");

  if (removePathIfExists(dockerDir)) {
    log("✅ Arquivos do Docker removidos do projeto.");
    return;
  }

  log("ℹ️ Diretório .maess não encontrado.");
}

function hasCodexCli() {
  try {
    execSync("codex --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
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
  log("🔄 Verificando atualizações...");
  
  runDockerCompose(
    "up -d --pull always --force-recreate",
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

function removeCodexProjectFiles() {
  const codexRoot = path.join(projectRoot, ".codex");
  const hooksDir = path.join(codexRoot, "hooks");
  const hooksConfigPath = path.join(codexRoot, "hooks.json");

  const removedHooks = removePathIfExists(hooksDir);
  const removedHooksConfig = removeFileIfExists(hooksConfigPath);

  removeDirIfEmpty(codexRoot);

  if (removedHooks || removedHooksConfig) {
    log("✅ Arquivos do Codex removidos do projeto.");
    return;
  }

  log("ℹ️ Arquivos do Codex não encontrados no projeto.");
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

function getDefaultCodexConfigPath() {
  return path.join(os.homedir(), ".codex", "config.toml");
}

function ensureCodexConfigPath() {
  const existingConfigPath = findCodexConfig();

  if (existingConfigPath) {
    return existingConfigPath;
  }

  const defaultConfigPath = getDefaultCodexConfigPath();
  ensureDir(path.dirname(defaultConfigPath));

  if (!fs.existsSync(defaultConfigPath)) {
    fs.writeFileSync(defaultConfigPath, "");
    log("✅ Arquivo inicial do Codex criado em `~/.codex/config.toml`.");
  }

  return defaultConfigPath;
}

const MAESS_HOOKS_START = "# >>> Maess Memory Hooks";
const MAESS_HOOKS_END = "# <<< Maess Memory Hooks";
const MAESS_MCP_START = "# >>> Maess Memory MCP";
const MAESS_MCP_END = "# <<< Maess Memory MCP";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripManagedBlock(content, startMarker, endMarker) {
  const start = escapeRegExp(startMarker);
  const end = escapeRegExp(endMarker);
  const blockRegex = new RegExp(`\\n?${start}[\\s\\S]*?${end}\\n?`, "g");
  return content.replace(blockRegex, "\n");
}

function removeTomlTable(content, tableName) {
  const table = escapeRegExp(tableName);
  const tableRegex = new RegExp(`\\n?${table}\\n[\\s\\S]*?(?=\\n\\[[^\\n]+\\]|$)`, "g");
  return content.replace(tableRegex, "\n");
}

function cleanupTomlSpacing(content) {
  return content
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim() + "\n";
}

function upsertFeaturesSection(content, transformSection) {
  const featuresRegex = /\[features\]\n[\s\S]*?(?=\n\[[^\n]+\]|$)/;
  const match = content.match(featuresRegex);

  if (match) {
    const currentSection = match[0];
    const updatedSection = transformSection(currentSection);

    if (!updatedSection.trim()) {
      return cleanupTomlSpacing(content.replace(currentSection, "\n"));
    }

    return cleanupTomlSpacing(content.replace(currentSection, updatedSection));
  }

  const newSection = transformSection("[features]\n");
  if (!newSection.trim()) {
    return cleanupTomlSpacing(content);
  }

  return cleanupTomlSpacing(`${content.trim()}\n\n${newSection}`);
}

function ensureHooksEnabled(content) {
  const managedHooksBlock = `${MAESS_HOOKS_START}\nhooks = true\n${MAESS_HOOKS_END}`;

  return upsertFeaturesSection(content, section => {
    let normalizedSection = stripManagedBlock(section, MAESS_HOOKS_START, MAESS_HOOKS_END);
    normalizedSection = normalizedSection.replace(/(^|\n)hooks\s*=\s*(true|false)\s*(?=\n|$)/g, "$1");
    normalizedSection = normalizedSection.replace(/\n{3,}/g, "\n\n").trimEnd();
    normalizedSection = normalizedSection.replace(/\[features\]\n+/g, "[features]\n");

    if (normalizedSection === "[features]") {
      return `${normalizedSection}\n${managedHooksBlock}\n`;
    }

    return `${normalizedSection}\n${managedHooksBlock}\n`;
  });
}

function disableHooks(content) {
  return upsertFeaturesSection(content, section => {
    let normalizedSection = stripManagedBlock(section, MAESS_HOOKS_START, MAESS_HOOKS_END);
    normalizedSection = normalizedSection.replace(/(^|\n)hooks\s*=\s*true\s*(?=\n|$)/g, "$1");
    normalizedSection = normalizedSection.replace(/\n{3,}/g, "\n\n").trim();
    normalizedSection = normalizedSection.replace(/\[features\]\n+/g, "[features]\n");

    return normalizedSection === "[features]" ? "" : `${normalizedSection}\n`;
  });
}

function ensureMcpServer(content, apiKey) {
  const managedMcpBlock = `${MAESS_MCP_START}
[mcp_servers.maess-memory]
enabled = true
url = "http://127.0.0.1:3000/mcp"

[mcp_servers.maess-memory.http_headers]
ApiKey = "${apiKey}"
${MAESS_MCP_END}`;

  let normalizedContent = stripManagedBlock(content, MAESS_MCP_START, MAESS_MCP_END);
  normalizedContent = removeTomlTable(normalizedContent, "[mcp_servers.maess-memory.http_headers]");
  normalizedContent = removeTomlTable(normalizedContent, "[mcp_servers.maess-memory]");

  return cleanupTomlSpacing(`${normalizedContent.trim()}\n\n${managedMcpBlock}`);
}

function removeMcpServer(content) {
  let normalizedContent = stripManagedBlock(content, MAESS_MCP_START, MAESS_MCP_END);
  normalizedContent = removeTomlTable(normalizedContent, "[mcp_servers.maess-memory.http_headers]");
  normalizedContent = removeTomlTable(normalizedContent, "[mcp_servers.maess-memory]");
  return cleanupTomlSpacing(normalizedContent);
}

async function setupCodexConfig() {
  const configPath = ensureCodexConfigPath();

  let content = fs.readFileSync(configPath, "utf-8");

  const apiKey = getEnvValue("BOOTSTRAP_ADMIN_USUARIO_APIKEY");

  content = ensureHooksEnabled(content);
  content = ensureMcpServer(content, apiKey);

  fs.writeFileSync(configPath, content);

  log("✅ Codex configurado com MCP!");
}

async function clearCodexConfig() {
  const configPath = findCodexConfig();

  if (!configPath) {
    log("⚠️ Codex não encontrado.");
    return;
  }

  let content = fs.readFileSync(configPath, "utf-8");
  content = disableHooks(content);
  content = removeMcpServer(content);

  fs.writeFileSync(configPath, content);

  log("✅ Configurações do Maess Memory removidas do Codex!");
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

function validateInitRequirements() {
  const hasDockerInstalled = hasDocker();
  const hasCodexInstalled = hasCodexCli();

  if (hasDockerInstalled && hasCodexInstalled) {
    return true;
  }

  log("❌ Pré-requisitos não atendidos para executar `maess init`.");
  log("");

  if (!hasDockerInstalled) {
    log("• Docker não encontrado.");
    log("  Instale o Docker Desktop e garanta que o comando `docker` esteja disponível.");
    log("");
  }

  if (!hasCodexInstalled) {
    log("• Codex CLI não encontrado.");
    log("  Instale o Codex e garanta que o comando `codex` esteja disponível no terminal.");
    log("");
  }

  log("👉 Depois disso, rode novamente: `npx maess init`");
  return false;
}

function validateStartRequirements() {
  const dockerComposePath = path.join(projectRoot, ".maess", "docker-compose.maess.yml");

  if (!fs.existsSync(dockerComposePath)) {
    log("❌ Projeto ainda não configurado.");
    log("👉 Rode primeiro: `npx maess init`");
    return false;
  }

  return true;
}

// =========================
// CLI
// =========================
async function init() {
  log("🚀 Configurando Maess Memory...\n");

  validateEnvironment();
  if (!validateInitRequirements()) {
    return;
  }

  createEnv();
  setupDocker();
  setupCodex();
  await setupCodexConfig();

  log("\n🎉 Setup concluído!");
  log("👉 Rode: maess start\n");
}

async function start() {
  if (!validateStartRequirements()) {
    return;
  }

  const hostHttpPort = getHostHttpPort();
  if (!isValidPort(hostHttpPort)) {
    log(`❌ Porta inválida em HOST_HTTP_PORT: ${hostHttpPort}`);
    log("👉 Defina uma porta válida no arquivo `.env`.");
    return;
  }

  const portAvailable = await isPortAvailable(hostHttpPort);
  if (!portAvailable) {
    log(`❌ A porta ${hostHttpPort} já está em uso.`);
    log("👉 Libere a porta ou altere HOST_HTTP_PORT no `.env`.");
    return;
  }

  startDocker();
}

async function clearConfig() {
  log("🧹 Removendo configurações do Maess Memory do Codex...\n");
  await clearCodexConfig();
}

async function uninstall() {
  log("🧹 Desinstalando Maess Memory deste projeto...\n");

  const dockerComposePath = path.join(projectRoot, ".maess", "docker-compose.maess.yml");
  if (fs.existsSync(dockerComposePath)) {
    downDocker();
    log("");
  }

  await clearCodexConfig();
  removeCodexProjectFiles();
  removeDockerFiles();
  removeManagedEnvEntries();

  log("\n✅ Desinstalação concluída!");
}

function printUsage() {
  log("🧠 Maess Memory CLI");
  log("");
  log("Comandos:");
  log("");
  log("  init      Configura hooks e MCP server");
  log("  clear-config  Remove hooks e MCP server do config.toml do Codex");
  log("  uninstall  Remove configuração global e arquivos locais do projeto");
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
      await start();
      break;
    case "clear-config":
    case "remove-config":
      await clearConfig();
      break;
    case "uninstall":
    case "remove":
      await uninstall();
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
