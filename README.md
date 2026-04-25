# maess-memory-cli

CLI para configurar o Maess Memory em um projeto local / CLI to configure Maess Memory in a local project. Ele cria ou atualiza `.env` com variáveis do projeto e instala os hooks do Codex em `.codex/` / It creates or updates `.env` and installs Codex hooks under `.codex/`.

![version](https://img.shields.io/badge/version-0.1.2-blue)

## Início rápido / Quick Start

```bash
node bin/index.js
```

Rode o comando na raiz do projeto alvo / Run the command from the target project root.
O pacote expõe os binários `maess` e `maess-memory` / The package exposes the `maess` and `maess-memory` binaries.

## O que ele faz / What it does

- adiciona `MAESS_MEMORY_SYSTEM_NAME` com o nome da pasta do projeto / adds `MAESS_MEMORY_SYSTEM_NAME` using the project folder name;
- adiciona `MAESS_MEMORY_AMBIENTE=dev` se a variável ainda não existir / adds `MAESS_MEMORY_AMBIENTE=dev` if missing;
- copia os hooks de [`templates/hooks/`](templates/hooks/) para `.codex/hooks/` / copies hooks from [`templates/hooks/`](templates/hooks/) into `.codex/hooks/`;
- sobrescreve [`templates/codex/hooks.json`](templates/codex/hooks.json) em `.codex/hooks.json` / overwrites `.codex/hooks.json` with the packaged config.
- `maess start` sobe os serviços com `docker compose up -d` / starts the services with `docker compose up -d`;
- `maess up` é um alias de `start` / `up` is an alias for `start`;
- `maess stop` para todos os containers do stack / stops all stack containers;
- `maess restart` reinicia os containers sem recriar a stack / restarts containers without rebuilding the stack;
- `maess down` executa `docker compose down -v` / runs `docker compose down -v`;
- `maess status` mostra o estado atual com `docker compose ps` / shows current state with `docker compose ps`;
- `maess logs [serviços/opções]` mostra os logs em modo follow, como `docker compose logs -f` / shows logs in follow mode, like `docker compose logs -f`.

## Instalação / Installation

Durante o desenvolvimento, execute a partir de um checkout local / During development, run it from a local checkout:

```bash
node bin/index.js
```

Se o pacote for publicado no npm, uma instalação global ficaria assim / If the package is published to npm, a global install would look like:

```bash
npm install -g @maess-systems/memory-cli
maess
```

Ou execute sob demanda com `npx` após publicar o pacote / Or run it ad hoc with `npx` once the package is published:

```bash
npx @maess-systems/memory-cli
```

Ou use o binário curto exposto pelo pacote / Or use the short binary exposed by the package:

```bash
maess
maess start
maess up
maess stop
maess restart
maess down
maess status
maess logs
maess help
```

O alias `maess-memory` também continua disponível / The `maess-memory` alias is also still available.

## Estrutura / Structure

- [`bin/index.js`](bin/index.js): ponto de entrada do CLI / CLI entry point.
- [`templates/hooks/`](templates/hooks/): scripts usados pelos hooks / hook scripts.
- [`templates/codex/hooks.json`](templates/codex/hooks.json): configuração oficial dos hooks / official hook configuration.

## Exemplo / Example

Após executar o CLI, `.env` pode conter / After running the CLI, `.env` may contain:

```env
MAESS_MEMORY_SYSTEM_NAME=meu-projeto
MAESS_MEMORY_AMBIENTE=dev
```

E `.codex/hooks.json` é escrito a partir do template incluído / And `.codex/hooks.json` is written from the bundled template, for example:

```json
{
  "hooks": {
    "SessionStart": [],
    "UserPromptSubmit": []
  }
}
```

## Requisitos / Requirements

- Node.js com suporte a ES Modules / Node.js with ES Modules support.
- `python3` disponível para os hooks Python / `python3` available for Python hooks.
- Permissão de escrita no diretório do projeto alvo / write access to the target project directory.

## Desenvolvimento / Development

Este repositório expõe scripts mínimos em `package.json`. Para testar alterações, rode o CLI em um diretório de testes e confira os arquivos gerados / This repo exposes minimal scripts in `package.json`. To test changes, run the CLI in a throwaway project and inspect the generated files.

## Troubleshooting

- `python3: command not found`: instale Python 3 ou garanta que ele esteja no `PATH` / install Python 3 or ensure it is on `PATH`.
- Hooks do Codex não aparecem / Codex hooks do not appear: verifique se `.codex/hooks.json` e `.codex/hooks/` foram criados na raiz do projeto alvo / check that `.codex/hooks.json` and `.codex/hooks/` exist in the target project root.
- Falha de permissão / Permission denied: execute o CLI em um diretório onde você possa escrever `.env` e `.codex/` / run the CLI in a directory where you can write `.env` and `.codex/`.

## Contribuição / Contributing

- Mantenha o estilo atual do código: ESM, 2 espaços e nomes descritivos / keep the current ESM style, 2-space indentation, and descriptive names.
- Evite commitar arquivos gerados como `.env` e `.codex/` / avoid committing generated `.env` and `.codex/` files.
- Use mensagens curtas no formato `feat: ...`, `fix: ...` etc. / use short conventional commit messages like `feat: ...` and `fix: ...`.
