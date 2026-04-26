# 🧠 Maess Memory CLI

Maess Memory é uma camada de memória externa para agentes de IA.

Ele captura, organiza e reutiliza conhecimento automaticamente — sem você precisar repetir contexto a cada interação.

---

## ⚡ Teste em 1 minuto

### 1. Instale

```bash
npm i @maess-systems/memory-cli
```

---

### 2. Configure

```bash
npx maess init
```

---

### 3. Suba o ambiente

```bash
npx maess start
```

---

### 4. Teste a memória

👉 Prompt 1 — registrar memória:

Estou iniciando um projeto chamado "Sistema de Gestão de Sinistros".

Decisão importante:
- Backend será .NET com arquitetura DDD + Hexagonal
- Banco de dados MongoDB
- Multi-tenant obrigatório

Registre isso como uma memória técnica de longo prazo.

---

👉 Prompt 2 — recuperar memória:

Quais decisões técnicas já foram registradas para o sistema de gestão de sinistros?

---

👉 Prompt 3 — usar memória automaticamente:

Sugira arquitetura para meu projeto

---

💡 O sistema vai lembrar automaticamente do contexto e responder com base nisso.

---

### 5. Veja a memória persistida

Abra:

http://localhost:3000

---

### 6. Acesso ao sistema

As credenciais de acesso são geradas automaticamente no arquivo `.env` durante o `init`.

Use:

- **Usuário:** `BOOTSTRAP_ADMIN_USUARIO_EMAIL`
- **Senha:** `BOOTSTRAP_ADMIN_USUARIO_SECRET`

💡 Esses valores ficam disponíveis no arquivo `.env` na raiz do projeto.

---

## 🧠 O que está acontecendo

- Memórias são capturadas automaticamente via hooks
- O sistema recupera contexto relevante em cada prompt
- O modelo responde considerando histórico real
- Tudo fica persistido e auditável

---

## 🚀 Comandos principais

```bash
npx maess init
npx maess start
npx maess status
npx maess logs
```

---

## 🔧 Comandos avançados

```bash
npx maess stop
npx maess restart
npx maess down
```

---

## ⚙️ O que o `init` faz

- cria ou atualiza `.env`
- instala hooks do Codex (`.codex/`)
- prepara integração com MCP
- deixa o projeto pronto para usar memória

---

## 💡 Por que usar

Sem Maess Memory:

- você repete contexto
- perde decisões
- respostas são genéricas

Com Maess Memory:

- o agente lembra
- decisões são reutilizadas
- respostas evoluem com o projeto

## 🧠 Conceito

Maess Memory não é só armazenamento.

É uma **infra de memória contextual para agentes**:

- multi-tenant  
- orientado a contexto  
- auditável  
- pronto para escalar  

---

## 💡 Dica

Você também pode usar:

```bash
npx maess-memory
```

Mas o recomendado é:

```bash
npx maess
```

---

## 🚀 Próximos passos

- suporte a múltiplos usuários  
- planos com funcionalidades avançadas  
- versão cloud (sem necessidade de infra local)
