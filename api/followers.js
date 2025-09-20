import fetch from "node-fetch";

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
let TOKEN = process.env.TWITCH_TOKEN; // pode estar vazio

// Função para gerar App Access Token (em memória, sem atualizar Vercel)
async function gerarTokenMemoria() {
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" }
  );

  const data = await res.json();
  if (!data.access_token) {
    console.error("Erro ao gerar token:", data);
    throw new Error("Não foi possível gerar token da Twitch");
  }

  TOKEN = data.access_token;
  return TOKEN;
}

// Buscar seguidores
async function buscarSeguidores(canal) {
  if (!TOKEN) {
    console.log("Token inexistente, gerando novo em memória...");
    await gerarTokenMemoria();
    console.log("Token gerado:", TOKEN);
  }

  // Busca ID do usuário
  const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${canal}`, {
    headers: { "Client-ID": CLIENT_ID, "Authorization": `Bearer ${TOKEN}` }
  });

  if (userRes.status === 401) {
    console.log("Token inválido, gerando novo...");
    await gerarTokenMemoria();
    return buscarSeguidores(canal);
  }

  const userData = await userRes.json();
  const userId = userData.data?.[0]?.id;
  if (!userId) throw new Error("Canal não encontrado");

  // Buscar seguidores
  const followersRes = await fetch(`https://api.twitch.tv/helix/users/follows?to_id=${userId}&first=100`, {
    headers: { "Client-ID": CLIENT_ID, "Authorization": `Bearer ${TOKEN}` }
  });

  const followersData = await followersRes.json();
  if (!followersData.data) throw new Error("Erro ao buscar seguidores");

  return followersData.data.map(f => f.from_name);
}

// Handler da API
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
