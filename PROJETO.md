# aprovi.ai — portal de aprovação de conteúdo

**Documento mestre — ler primeiro ao retomar.**

Produto próprio da Luh Panda (nome comercial: **aprovi.ai**, ex-"Posta Aí"): portal
onde o cliente aprova (ou pede ajuste em) cada criativo antes de ir pro ar, sem
WhatsApp bagunçado nem print perdido. Nasceu do projeto da Gigi (Lymphatic by Gigi),
mas foi desenhado desde a primeira tabela pra aguentar dezenas de clientes e, no
futuro, ser vendido pra outras agências. Meta: subir num domínio próprio sob
luhpanda.com.br quando estiver pronto — a URL do GitHub Pages abaixo é provisória.

**Nota técnica:** o rename foi só de marca/nome visível. Por baixo, Supabase ainda
usa os nomes antigos (`posta_ai` como schema, funções `posta_ai_*`, bucket
`posta-ai-media`) — são internos, invisíveis pro usuário, e renomear exigiria
migração de banco em produção sem necessidade real. Não renomear isso sem motivo forte.

## Onde está tudo

- **Repo local:** `/Users/luhpanda/Downloads/Luh Panda/aprovi-ai`
- **Remote:** `https://github.com/lucianapandolfo9-spec/aprovi-ai` (branch `main`, **repo público** — necessário pro GitHub Pages grátis; seguro porque a chave anon do Supabase é feita pra ficar exposta, e todo acesso passa por RLS + funções travadas, nunca pela chave)
- **URL publicada:** https://lucianapandolfo9-spec.github.io/aprovi-ai/ (provisória — vai migrar pra domínio próprio)
  - `index.html` — painel da Luciana (login, marcas, kanban, upload, edição)
  - `cliente.html?t=<token>` — tela do cliente (link secreto por marca, sem login)
- **Backend:** Supabase, projeto `arroba-certa` (`tscnqvuzlfagotirgjbz`) — **schema isolado `posta_ai`**, não mexe em nada do @certo. Motivo: conta free só permite 2 projetos Supabase ativos por org, já ocupados por `auditor-folha-capitalize` e `arroba-certa`.
- **Storage:** bucket `posta-ai-media` (público pra leitura; upload só autenticado como admin).

## Por que essa estrutura (decisões tomadas)

1. **Build vs. buy dividido em duas camadas.** Aprovação = ativo próprio (baixo custo, vendável). Publicação automática = infraestrutura chata (App Review da Meta, tokens, refresh) — não vale reinventar. Fase 1 é só aprovação; fase 2 pluga publicação.
2. **Metricool descartado por enquanto.** Só 1 marca conectada hoje (a pessoal da Luciana) — plano atual não comporta multi-marca. Entra quando tiver volume de cliente que justifique assinar.
3. **App próprio na Meta em vez de assinar Metricool.** Com poucos clientes, contas entram como *tester* do app em modo desenvolvimento — publica sem precisar de App Review. App Review só vira obrigatório ao atender conta de fora (agência terceira).
4. **`workspace_id`/multi-tenant desde a primeira tabela**, mesmo com um cliente só rodando hoje — é barato fazer agora, caro fazer depois. Estrutura aguenta 30+ clientes sem mudança de schema.
5. **Sem login pro cliente.** Link fixo secreto por marca (`brands.secret_token`), reenviado sempre o mesmo pelo WhatsApp. Zero fricção — decisão validada com a Gigi em mente ("ela não vai criar conta, ela tá colapsando às 21h40").
6. **Você agenda, o cliente só aprova.** Sem tela de calendário do lado dele — menos campo, menos confusão.
7. **Notificação de conteúdo novo:** nenhuma automática ainda (você manda o link na mão pelo WhatsApp). Ponto de encaixe pro n8n + Evolution já pré-cabeado (ver Roadmap).

## Modelo de dados (schema `posta_ai`)

```
workspaces        id, nome
brands            id, workspace_id, nome, handle, timezone, idioma, secret_token
caption_blocks    id, brand_id, tipo, conteudo, ativo        -- "assinatura padrão", editável pelo cliente
posts             id, brand_id, titulo_interno, formato, status, agendado_para
post_assets       id, post_id, ordem, tipo, url, thumb_url, duracao_seg
post_captions     id, post_id, versao, corpo, autor           -- histórico de toda edição de legenda
post_comments     id, post_id, autor, texto
post_events       id, post_id, de_status, para_status, autor  -- auditoria de toda mudança de status
```

**Legenda em duas partes:** corpo (`post_captions.corpo`, varia por post) + assinatura padrão
(`caption_blocks.conteudo`, fixa por marca, editável pelo cliente e propaga sozinha pra
todo post futuro). Mesma lógica do `CTAEnd.tsx` do projeto Remotion da Gigi, aplicada à legenda.

**Máquina de status:**
`rascunho → em_aprovação → aprovado | ajuste_pedido` (ajuste volta pro loop) `→ agendado → publicando → publicado | falhou`

## Segurança — como o acesso é controlado

**Nenhuma tabela é acessível direto via API — só via funções `SECURITY DEFINER` em `public`.**

- **Admin (você):** Supabase Auth (magic link por e-mail) + toda função admin checa
  `posta_ai_is_admin()` = `coalesce(auth.email(), '') = 'lucianapandolfo9@gmail.com'`.
- **Cliente:** sem login — token da URL (`?t=`) é validado dentro da função
  (`posta_ai_brand_from_token`) antes de qualquer leitura/escrita, e todo post é
  reconferido contra a marca do token (não dá pra um token de uma marca mexer em
  post de outra).
- **Storage:** bucket público de leitura; insert/update/delete só pro e-mail admin autenticado.

**⚠️ Bug de segurança real encontrado e corrigido na primeira sessão (29/jul/2026):**
`auth.email()` retorna `NULL` pra requisição anônima. `NULL = 'email'` também dá `NULL`,
e em PL/pgSQL `IF NOT NULL THEN raise exception` **não dispara** (NULL não é true nem
false) — isso deixava qualquer função admin passar direto sem login. Corrigido trocando
pra `coalesce(auth.email(), '') = 'email'`, que sempre resolve pra boolean de verdade.
**Lição:** todo check de auth em Postgres/PL-pgSQL precisa de `coalesce`/`is not distinct
from` — nunca comparação direta que pode virar NULL. Testado com curl direto na API
(bypassando a UI) simulando um atacante sem sessão — é assim que vale testar RLS/RPC
daqui pra frente, não só clicando na tela.

## Como usar hoje (fase 1)

1. Login em `index.html` com o e-mail admin (link mágico).
2. "+ Nova marca" pra cadastrar um cliente novo — copia o link secreto gerado e manda
   uma vez só pelo WhatsApp (fica fixo).
3. "+ Novo conteúdo" — pode selecionar **vários arquivos de uma vez** (vira carrossel
   automaticamente), escreve o corpo da legenda, cria como rascunho.
4. "Enviar pra aprovação" quando estiver pronto pro cliente ver.
5. Cliente abre o link, edita legenda/assinatura se quiser, aprova ou pede ajuste
   (com comentário).
6. **Botão "Abrir" em qualquer card, qualquer status** — mostra os arquivos com link
   de abrir/baixar, legenda editável (dá pra corrigir mesmo depois de aprovado),
   assinatura padrão de referência, e "Copiar legenda + assinatura" pra colar direto
   no Instagram na hora de postar manualmente. É o fluxo real de hoje: você pega o
   conteúdo aprovado aqui e sobe na mão, até a fase 2 automatizar isso.
7. "Agendar" (só depois de aprovado) — define data/hora no fuso da própria marca.

## Cliente-teste em produção

**Lymphatic by Gigi** é o primeiro caso real, rodando desde 29/jul/2026 — primeiro
conteúdo aprovado de ponta a ponta foi o recap do evento Juni Block Party.

## Roadmap — Fase 2 (publicação automática)

- `social_accounts` (token cifrado, validade) + `publish_jobs` (tentativa, id externo, erro) —
  únicas duas tabelas que faltam.
- Cadastrar app próprio no Meta for Developers; contas de cliente entram como
  *tester* (sem precisar de App Review enquanto for baixo volume).
- Pré-requisito por cliente: Instagram Business/Creator vinculado a uma Página do
  Facebook (no caso da Gigi, já é pendência existente do projeto dela no Notion —
  serve pras duas frentes de uma vez: anúncios pagos e aprovi.ai).
- Gatilho: mudança de status pra `aprovado` em `post_events` → webhook do Supabase
  → função de publicação.

## Roadmap — notificação via n8n (não construído ainda, de propósito)

Toda mudança de status já grava em `post_events`. Plugar n8n + Evolution é só apontar
um webhook do Supabase nessa tabela — zero refatoração, nenhuma tabela nova.

## Regras que não podem quebrar

- **Fuso sempre no nível da marca** (`brands.timezone`), nunca configuração global —
  Gigi é `America/Los_Angeles`, você é `America/Recife`.
- **Sem auto-aprovação por tempo.** A decisão final é sempre do cliente — nunca
  adicionar "aprova sozinho depois de X dias".
- Ao adicionar qualquer função nova que faça checagem de admin/permissão: usar
  `coalesce()` — ver o bug de segurança documentado acima antes de repetir o padrão.
