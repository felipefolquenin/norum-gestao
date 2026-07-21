# NORUM Engenharia — Sistema de Gestão Predial

Guia para colocar o sistema no ar com banco de dados real, **tudo pelo navegador**,
sem instalar nada no seu computador.

A ordem importa: primeiro o banco (Supabase), depois a publicação (Vercel).
Tempo estimado: 20 a 30 minutos.

---

## PARTE 1 — Banco de dados (Supabase)

1. Acesse **supabase.com** e crie uma conta (pode usar login do GitHub).
2. Clique em **New project**. Dê um nome (ex.: `norum`), crie uma **senha do banco**
   (anote em lugar seguro) e escolha a região **South America (São Paulo)**. Clique em
   **Create new project** e aguarde ~2 minutos.
3. No menu lateral, abra **SQL Editor** → **New query**.
4. Abra o arquivo `supabase-schema.sql` (está nesta pasta), copie TODO o conteúdo,
   cole no editor e clique em **Run**. Deve aparecer "Success". Isso cria as tabelas,
   as regras de integridade e as permissões de acesso.
5. Crie seu usuário de acesso: menu **Authentication** → **Users** → **Add user** →
   **Create new user**. Informe seu **e-mail** e uma **senha**. (Esse será o login do sistema.)
   - Marque a opção de e-mail já confirmado, se aparecer, para poder entrar direto.
6. Pegue as chaves de conexão: menu **Project Settings** (engrenagem) → **API**.
   Copie e guarde estes dois valores:
   - **Project URL** (algo como `https://xxxx.supabase.co`)
   - **anon public** (uma chave longa) — use SOMENTE a "anon public", nunca a "service_role".

---

## PARTE 2 — Subir o código no GitHub

1. Acesse **github.com** e crie uma conta (se ainda não tiver).
2. Clique em **New repository**. Nome: `norum`. Deixe **Public**. NÃO marque nada extra.
   Clique em **Create repository**.
3. Na página do repositório vazio, clique no link **uploading an existing file**
   (ou botão **Add file → Upload files**).
4. Arraste para lá **todos os arquivos e pastas desta pasta** (inclusive a pasta `src`
   e o `index.html`, `package.json` etc.). Não envie as pastas `node_modules` nem `dist`
   (elas não existem aqui — ótimo, é assim mesmo).
5. Clique em **Commit changes**.

---

## PARTE 3 — Publicar na Vercel

1. Acesse **vercel.com** e clique em **Sign up** / **Log in** usando **Continue with GitHub**.
2. Clique em **Add New...** → **Project**.
3. Encontre o repositório `norum` na lista e clique em **Import**.
4. Antes de finalizar, abra a seção **Environment Variables** e adicione as duas chaves
   da Parte 1 (passo 6):
   - Nome: `VITE_SUPABASE_URL`  → Valor: sua Project URL
   - Nome: `VITE_SUPABASE_ANON_KEY`  → Valor: sua anon public key
5. Clique em **Deploy**. Aguarde cerca de 1 minuto.
6. Pronto! A Vercel mostra o endereço do site (algo como `norum.vercel.app`).
   Abra, faça login com o e-mail e senha que você criou no Supabase, e use o sistema.

---

## Depois: domínio próprio (opcional)

Na Vercel, dentro do projeto: **Settings → Domains** → adicione um domínio
(ex.: `gestao.norum.com.br`) e siga as instruções de DNS.

## Para criar mais usuários

Sempre em **Supabase → Authentication → Users → Add user**. Cada pessoa da equipe
recebe um e-mail e senha e acessa o mesmo sistema, com os mesmos dados.

## Observações

- Os dados agora ficam no banco (Supabase) e são os mesmos em qualquer computador ou celular.
- A camada gratuita do Supabase e da Vercel cobre bem um sistema deste porte, sem custo.
- Se aparecer "Usuário ou senha inválidos", confira se criou o usuário na Parte 1, passo 5.
- Se as telas abrirem vazias e der erro de dados, confira se rodou o `supabase-schema.sql`
  inteiro (Parte 1, passo 4) e se as duas variáveis de ambiente estão certas na Vercel.
