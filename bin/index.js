#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

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
      // não sobrescreve se já existir
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

// =========================
// .env
// =========================
function createEnv() {
  const envPath = path.join(projectRoot, ".env");

  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf-8");
  }

  const projectName = path.basename(projectRoot);

  if (!content.includes("MAESS_MEMORY_SYSTEM_NAME")) {
    content += `\nMAESS_MEMORY_SYSTEM_NAME=${projectName}`;
  }

  if (!content.includes("MAESS_MEMORY_AMBIENTE")) {
    content += `\nMAESS_MEMORY_AMBIENTE=dev`;
  }

  fs.writeFileSync(envPath, content.trim() + "\n");
}

// =========================
// Codex Setup
// =========================
function setupCodex() {
  const hooksDest = path.join(projectRoot, ".codex/hooks");
  const hooksSrc = path.join(__dirname, "../templates/hooks");

  const hooksConfigSrc = path.join(__dirname, "../templates/codex/hooks.json");
  const hooksConfigDest = path.join(projectRoot, ".codex/hooks.json");

  log("📦 Instalando hooks do Codex...");

  ensureDir(path.join(projectRoot, ".codex"));
  copyRecursive(hooksSrc, hooksDest);

  // sempre sobrescreve o hooks.json (controle centralizado)
  fs.copyFileSync(hooksConfigSrc, hooksConfigDest);

  // garantir permissão no shell script
  try {
    execSync(`chmod +x ${path.join(hooksDest, "hook_probe.sh")}`);
  } catch {
    log("⚠️ Não foi possível aplicar chmod automaticamente (ok no Windows)");
  }

  log("✅ Hooks do Codex configurados!");
}

// =========================
// Validações
// =========================
function validateEnvironment() {
  try {
    execSync("python3 --version", { stdio: "ignore" });
  } catch {
    log("⚠️ python3 não encontrado. Os hooks podem não funcionar.");
  }
}

// =========================
// Main
// =========================
function main() {
  log("🚀 Configurando Maess Memory...\n");

  validateEnvironment();
  createEnv();
  setupCodex();

  log("\n🎉 Configuração concluída com sucesso!");
  log("");
  log("Próximos passos:");
  log("1. Abra o projeto no Codex");
  log("2. Comece a usar normalmente");
  log("3. A memória já estará ativa automaticamente");
}

main();