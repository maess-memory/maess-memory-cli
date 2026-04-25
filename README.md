# maess-memory-cli

Maess Memory é uma camada de memória externa para agentes de IA. Ele captura, consolida e recupera conhecimento útil com contexto de tenant, organização, usuário, tarefa e origem.

Este pacote é o CLI para usar e administrar o Maess Memory na sua máquina local. Com ele, você prepara o projeto, sobe o ambiente e instala a integração com o Codex usando o comando `maess`.

## Instalar

No diretório do projeto onde você quer usar o Maess Memory:

```bash
npm i @maess-systems/memory-cli
```

## Começar

Rode o comando na raiz do projeto:

```bash
npx maess init
```

Depois, para subir o ambiente:

```bash
npx maess start
```

## Comandos mais usados

```bash
npx maess init
npx maess start
npx maess up
npx maess stop
npx maess restart
npx maess down
npx maess status
npx maess logs
```

## O que acontece

- cria ou atualiza o arquivo `.env`;
- instala os hooks do Codex em `.codex/`;
- deixa o projeto pronto para usar o Maess Memory localmente.

## Dica rápida

Se quiser, o pacote também responde a `npx maess-memory`, mas o caminho recomendado é `npx maess`.
