import { list, put } from '@vercel/blob';

const ADMIN_PIN = '06109899';
const PRODUCTS_PREFIX = 'dancell/products-';
const IMAGES_PREFIX = 'dancell/images/';

const starter = [
  {
    id: 1,
    name: 'Redmi Note 15',
    brand: 'Xiaomi',
    category: 'Xiaomi',
    price: 'Consulte',
    installment: 'Peça sua condição de pagamento',
    description: 'Desempenho, bateria e ótimo custo-benefício.',
    image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=900&q=80'
  },
  {
    id: 2,
    name: 'iPhone 13 128GB',
    brand: 'iPhone',
    category: 'iPhone',
    price: 'Consulte',
    installment: 'Parcelamento disponível',
    description: 'Qualidade Apple com excelente conjunto de câmeras.',
    image: 'https://images.unsplash.com/photo-1605236453806-6ff36851218e?auto=format&fit=crop&w=900&q=80'
  },
  {
    id: 3,
    name: 'Caixa de Som Bluetooth',
    brand: 'Acessórios',
    category: 'Acessórios',
    price: 'Consulte',
    installment: 'Fale conosco pelo WhatsApp',
    description: 'Som potente e portátil para o dia a dia.',
    image: 'https://images.unsplash.com/photo-1589003077984-894e133dabab?auto=format&fit=crop&w=900&q=80'
  }
];

function blobOptions() {
  const storeId = process.env.IMAGES_STORE_ID;

  const token =
    process.env.IMAGES_READ_WRITE_TOKEN ||
    process.env.IMAGES_TOKEN;

  if (!storeId) {
    throw new Error('STORAGE_NOT_CONFIGURED');
  }

  const options = { storeId };

  if (token) {
    options.token = token;
  }

  return options;
}

function authorized(req) {
  return String(req.headers['x-admin-pin'] || '') === ADMIN_PIN;
}

function normalizeProduct(p = {}) {
  return {
    id: p.id ?? Date.now(),
    name: String(p.name ?? '').trim(),
    brand: String(p.brand ?? p.category ?? '').trim(),
    category: String(p.category ?? p.brand ?? 'Outros').trim(),
    price: String(p.price ?? 'Consulte').trim(),
    installment: String(p.installment ?? '').trim(),
    description: String(p.description ?? p.desc ?? '').trim(),
    image: String(p.image ?? '').trim()
  };
}

async function readProducts() {
  const result = await list({
    prefix: PRODUCTS_PREFIX,
    limit: 100,
    ...blobOptions()
  });

  if (!result.blobs?.length) {
    return starter;
  }

  const latest = [...result.blobs].sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
  )[0];

  const response = await fetch(latest.url, {
    cache: 'no-store'
  });

  if (!response.ok) {
    return starter;
  }

  const data = await response.json();

  return Array.isArray(data) ? data : starter;
}

async function writeProducts(products) {
  await put(
    `${PRODUCTS_PREFIX}${Date.now()}.json`,
    JSON.stringify(products),
    {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: true,
      ...blobOptions()
    }
  );
}

async function saveImage(image) {
  if (!image) return '';

  if (
    image.startsWith('https://') ||
    image.startsWith('http://')
  ) {
    return image;
  }

  const match = image.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
  );

  if (!match) {
    throw new Error('INVALID_IMAGE');
  }

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');

  if (buffer.length > 4 * 1024 * 1024) {
    throw new Error('IMAGE_TOO_LARGE');
  }

  let ext = 'jpg';

  if (mimeType === 'image/png') ext = 'png';
  if (mimeType === 'image/webp') ext = 'webp';
  if (mimeType === 'image/gif') ext = 'gif';

  const blob = await put(
    `${IMAGES_PREFIX}${Date.now()}.${ext}`,
    buffer,
    {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: true,
      ...blobOptions()
    }
  );

  return blob.url;
}

async function prepareProduct(product) {
  const p = normalizeProduct(product);
  p.image = await saveImage(p.image);
  return p;
}

export default async function handler(req, res) {
  try {

    if (req.method === 'GET') {
      const products = await readProducts();

      return res.status(200).json({
        products,
        online: true
      });
    }

    if (
      req.method === 'POST' &&
      req.query?.action === 'login'
    ) {
      if (!authorized(req)) {
        return res.status(401).json({
          ok: false,
          error: 'PIN incorreto'
        });
      }

      return res.status(200).json({
        ok: true
      });
    }

    if (!authorized(req)) {
      return res.status(401).json({
        ok: false,
        error: 'Não autorizado'
      });
    }

    if (req.method !== 'PUT') {
      return res.status(405).json({
        ok: false,
        error: 'Método não permitido'
      });
    }

    const body = req.body || {};
    const current = await readProducts();

    if (body.action === 'create') {
      const product = await prepareProduct({
        ...body.product,
        id: body.product?.id ?? Date.now()
      });

      if (!product.name) {
        return res.status(400).json({
          ok: false,
          error: 'Nome do produto é obrigatório'
        });
      }

      const next = [product, ...current].slice(0, 500);

      await writeProducts(next);

      return res.status(200).json({
        ok: true,
        products: next
      });
    }

    if (body.action === 'update') {
      const product = await prepareProduct(body.product);

      const id = String(product.id);
      let found = false;

      const next = current.map(item => {
        if (String(item.id) === id) {
          found = true;

          return {
            ...item,
            ...product
          };
        }

        return item;
      });

      if (!found) {
        return res.status(404).json({
          ok: false,
          error: 'Produto não encontrado'
        });
      }

      await writeProducts(next);

      return res.status(200).json({
        ok: true,
        products: next
      });
    }

    if (body.action === 'delete') {
      const id = String(body.id ?? '');

      const next = current.filter(
        item => String(item.id) !== id
      );

      await writeProducts(next);

      return res.status(200).json({
        ok: true,
        products: next
      });
    }

    return res.status(400).json({
      ok: false,
      error: 'Ação inválida'
    });

  } catch (error) {

    console.error('DAN CELL API:', error);

    if (error.message === 'STORAGE_NOT_CONFIGURED') {
      return res.status(503).json({
        ok: false,
        error: 'Armazenamento não configurado.'
      });
    }

    if (error.message === 'INVALID_IMAGE') {
      return res.status(400).json({
        ok: false,
        error: 'Imagem inválida.'
      });
    }

    if (error.message === 'IMAGE_TOO_LARGE') {
      return res.status(413).json({
        ok: false,
        error: 'A imagem é muito grande.'
      });
    }

    return res.status(500).json({
      ok: false,
      error: error.message || 'Erro interno do catálogo'
    });
  }
         }
