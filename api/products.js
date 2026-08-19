import { list, put } from '@vercel/blob';

const PREFIX = 'dancell/products-';
const ADMIN_PIN ='06109899';
const starter = [
  { id: 1, name: 'Redmi Note 15', category: 'Xiaomi', price: 'Consulte', installment: 'Peça sua condição de pagamento', desc: 'Desempenho, bateria e ótimo custo-benefício.', image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=900&q=80' },
  { id: 2, name: 'iPhone 13 128GB', category: 'iPhone', price: 'Consulte', installment: 'Parcelamento disponível', desc: 'Qualidade Apple com excelente conjunto de câmeras.', image: 'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?auto=format&fit=crop&w=900&q=80' },
  { id: 3, name: 'Caixa de Som Bluetooth', category: 'Acessórios', price: 'Consulte', installment: 'Fale conosco pelo WhatsApp', desc: 'Som potente e portátil para o dia a dia.', image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80' }
];

function authorized(req) {
  return req.headers['x-admin-pin'] === ADMIN_PIN;
}

async function readProducts() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return starter;
  const result = await list({ prefix: PREFIX, limit: 100 });
  if (!result.blobs?.length) return starter;
  const latest = [...result.blobs].sort((a,b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
  const r = await fetch(latest.url, { cache: 'no-store' });
  if (!r.ok) return starter;
  const data = await r.json();
  return Array.isArray(data) ? data : starter;
}

async function writeProducts(products) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const err = new Error('STORAGE_NOT_CONFIGURED');
    err.code = 'STORAGE_NOT_CONFIGURED';
    throw err;
  }
  await put(`${PREFIX}${Date.now()}.json`, JSON.stringify(products), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: true
  });
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ products: await readProducts(), online: Boolean(process.env.BLOB_READ_WRITE_TOKEN) });
    }

    if (req.method === 'POST' && req.query?.action === 'login') {
      return authorized(req) ? res.status(200).json({ ok: true }) : res.status(401).json({ error: 'PIN incorreto' });
    }

    if (!authorized(req)) return res.status(401).json({ error: 'Não autorizado' });

    if (req.method === 'PUT') {
      const products = Array.isArray(req.body?.products) ? req.body.products : null;
      if (!products) return res.status(400).json({ error: 'Lista inválida' });
      await writeProducts(products.slice(0, 500));
      return res.status(200).json({ ok: true, products });
    }

    res.setHeader('Allow', 'GET, POST, PUT');
    return res.status(405).json({ error: 'Método não permitido' });
  } catch (e) {
    if (e?.code === 'STORAGE_NOT_CONFIGURED' || String(e?.message).includes('STORAGE_NOT_CONFIGURED')) {
      return res.status(503).json({ error: 'O banco online ainda não foi conectado na Vercel.' });
    }
    console.error(e);
    return res.status(500).json({ error: 'Erro interno do catálogo' });
  }
}
