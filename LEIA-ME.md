# Higher or Lower — Médias de Acesso (v2)

Ficheiros: `index.html`, `style.css`, `script.js`, `data.js` (1108 cursos com nota, vagas e colocados), `config.js` (leaderboard), `supabase.sql`, `extrair.py` (gera o `data.js` a partir do PDF da DGES).

O jogo funciona logo ao abrir o `index.html`. Sem configurar o Supabase, o leaderboard fica escondido.

## Ligar o leaderboard global (Supabase, grátis)

1. Cria uma conta em supabase.com → **New project** (região: Europe West, por exemplo).
2. No projeto: **SQL Editor → New query** → cola o conteúdo de `supabase.sql` → **Run**.
3. **Project Settings → API** (ou **API Keys**): copia o **Project URL** e a chave **anon** / **publishable**.
4. Cola os dois valores em `config.js`.
5. Abre o jogo, faz uma partida e submete: a pontuação deve aparecer em **Table Editor → pontuacoes**.

Nota: a chave anon é pública (qualquer site com leaderboard grátis funciona assim). As regras do SQL impedem que alguém altere ou apague pontuações, mas não impedem que alguém envie um número inventado. Se aparecer uma pontuação falsa, apaga-a no Table Editor.

## Publicar (GitHub Pages ou Netlify)

- **Netlify Drop:** arrasta a pasta para app.netlify.com/drop.
- **GitHub Pages:** cria um repositório, envia os ficheiros e ativa **Settings → Pages → Deploy from branch (main)**.

## Atualizar os dados (ex.: 2.ª fase ou próximo ano)

`pip install pdfplumber`, põe o PDF como `medias.pdf` e ajusta os caminhos no topo de `extrair.py`. Depois corre `python extrair.py`.
