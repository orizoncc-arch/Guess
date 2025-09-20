import fetch from "node-fetch";

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
let TOKEN = process.env.TWITCH_TOKEN;

const VERCEL_TOKEN = process.env.VERCEL_PERSONAL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;

// Função para gerar App Access Token
async function gerarNovoToken() {
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" }
  );
  const data = await res.json();
  if (!data.access_token) throw new Error("Não foi possível gerar token da Twitch");
  return data.access_token;
}

// Função para atualizar variável do Vercel
async function atualizarTokenVercel(novoToken) {
  const url = `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env`;
  const body = {
    key: "TWITCH_TOKEN",
    value: novoToken,
    type: "encrypted"
  };

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Erro ao atualizar token no Vercel:", text);
    throw new Error("Falha ao atualizar token no Vercel");
  }

  TOKEN = novoToken; // Atualiza variável local
}

// Função para buscar seguidores
async function buscarSeguidores(canal) {
  // Verifica se existe token, se não gera
  if (!TOKEN) {
    console.log("Token inexistente, gerando...");
    const novoToken = await gerarNovoToken();
    await atualizarTokenVercel(novoToken);
    console.log("Token gerado e salvo no Vercel");
  }

  // Busca ID do usuário
  const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${canal}`, {
    headers: { "Client-ID": CLIENT_ID, "Authorization": `Bearer ${TOKEN}` }
  });

  if (userRes.status === 401) {
    console.log("Token inválido, gerando novo...");
    const novoToken = await gerarNovoToken();
    await atualizarTokenVercel(novoToken);
    return buscarSeguidores(canal); // tenta novamente
  }

  const userData = await userRes.json();
  const userId = userData.data?.[0]?.id;
  if (!userId) throw new Error("Canal não encontrado");

  // Busca seguidores
  const followersRes = await fetch(`https://api.twitch.tv/helix/users/follows?to_id=${userId}&first=100`, {
    headers: { "Client-ID": CLIENT_ID, "Authorization": `Bearer ${TOKEN}` }
  });

  const followersData = await followersRes.json();
  if (!followersData.data) throw new Error("Erro ao buscar seguidores");

  return followersData.data.map(f => f.from_name);
}

// Função principal do serverless
export default async function handler(req, res) {
  const canal = req.query.channel;
  if (!canal) return res.status(400).json({ error: "Channel required" });

  try {
    console.log("Buscando seguidores do canal:", canal);
    const nicks = await buscarSeguidores(canal);
    res.status(200).json(nicks);
  } catch (err) {
    console.error("Erro na API /followers:", err.message);
    res.status(500).json({ error: err.message });
  }
}
