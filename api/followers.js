import fetch from "node-fetch";

// Pega as variáveis de ambiente do Vercel
const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
let TOKEN = process.env.TWITCH_TOKEN;
const VERCEL_TOKEN = process.env.VERCEL_PERSONAL_TOKEN; // seu token pessoal do Vercel
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID; // ID do projeto Vercel

// Função para gerar um novo App Access Token da Twitch
async function gerarNovoToken() {
  const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`, {
    method: "POST"
  });
  const data = await res.json();
  return data.access_token;
}

// Função para atualizar a variável do Vercel
async function atualizarTokenVercel(novoToken) {
  await fetch(`https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      key: "TWITCH_TOKEN",
      value: novoToken,
      type: "encrypted"
    })
  });
  TOKEN = novoToken;
}

export default async function handler(req, res) {
  const canal = req.query.channel;
  if (!canal) return res.status(400).json({ error: "Channel required" });

  try {
    // Se não existe TOKEN, gera e salva
    if (!TOKEN) {
      const novoToken = await gerarNovoToken();
      await atualizarTokenVercel(novoToken);
    }

    // Busca ID do usuário
    const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${canal}`, {
      headers: { "Client-ID": CLIENT_ID, "Authorization": `Bearer ${TOKEN}` }
    });
    const userData = await userRes.json();
    const userId = userData.data[0]?.id;
    if (!userId) return res.status(404).json({ error: "Canal não encontrado" });

    // Busca seguidores
    const followersRes = await fetch(`https://api.twitch.tv/helix/users/follows?to_id=${userId}&first=100`, {
      headers: { "Client-ID": CLIENT_ID, "Authorization": `Bearer ${TOKEN}` }
    });
    const followersData = await followersRes.json();
    const nicks = followersData.data.map(f => f.from_name);
    res.json(nicks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar seguidores" });
  }
}
