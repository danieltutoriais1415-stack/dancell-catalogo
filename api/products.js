import { list, put } from '@vercel/blob';

const PREFIX = 'dancell/products-';
const ADMIN_PIN = '06109899';

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

function authorized(req) {
  const pin = String(req.headers['x-admin-pin'] || '');
  return pin === ADMIN_PIN;
}

async function readProducts() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return starter;
  }

  const result = await list({
    prefix: PREFIX,
    limit: 100
  });

  if (!result.blobs?.length) {
    return starter;
  }

  const latest = [...result.blobs].sort(
    (a, b) =>
      new Date(b.uploadedAt) -
      new Date(a.uploadedAt)
  )[0];

  const response = await fetch(
    latest.url,
    { cache: 'no-store' }
  );

  if (!response.ok) {
    return starter;
  }

  const data = await response.json();

  return Array.isArray(data)
    ? data
    : starter;
}

async function writeProducts(products) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const error = new Error('STORAGE_NOT_CONFIGURED');
    error.code = 'STORAGE_NOT_CONFIGURED';
    throw error;
  }

  await put(
    `${PREFIX}${Date.now()}.json`,
    JSON.stringify(products),
    {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: true
    }
  );
}

function normalizeProduct(product = {}) {
  return {
    id: product.id ?? Date.now(),
    name: String(product.name ?? '').trim(),
    brand: String(
      product.brand ??
      product.category ??
      ''
    ).trim(),
    category: String(
      product.category ??
      product.brand ??
      'Outros'
    ).trim(),
    price: String(
      product.price ??
      'Consulte'
    ).trim(),
    installment: String(
      product.installment ??
      ''
    ).trim(),
    description: String(
      product.description ??
      product.desc ??
      ''
    ).trim(),
    image: String(
      product.image ??
      ''
    ).trim()
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const products = await readProducts();

      return res.status(200).json({
        products,
        online: Boolean(
          process.env.BLOB_READ_WRITE_TOKEN
        )
      });
    }

    if (
      req.method === 'POST' &&
      req.query?.action === 'login'
    ) {
      if (authorized(req)) {
        return res.status(200).json({
          ok: true
        });
      }

      return res.status(401).json({
        ok: false,
        error: 'PIN incorreto'
      });
    }

    if (!authorized(req)) {
      return res.status(401).json({
        ok: false,
        error: 'Não autorizado'
      });
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      const current = await readProducts();

      if (Array.isArray(body.products)) {
        const next = body.products
          .slice(0, 500)
          .map(normalizeProduct);

        await writeProducts(next);

        return res.status(200).json({
          ok: true,
          products: next
        });
      }

      if (body.action === 'create') {
        const product = normalizeProduct({
          ...body.product,
          id: body.product?.id ?? Date.now()
        });

        if (!product.name) {
          return res.status(400).json({
            ok: false,
            error: 'Nome do produto é obrigatório'
          });
        }

        const next = [
          product,
          ...current
        ].slice(0, 500);

        await writeProducts(next);

        return res.status(200).json({
          ok: true,
          products: next
        });
      }

      if (body.action === 'update') {
        const product = normalizeProduct(
          body.product
        );

        if (!product.name) {
          return res.status(400).json({
            ok: false,
            error: 'Nome do produto é obrigatório'
          });
        }

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
    }

    res.setHeader(
      'Allow',
      'GET, POST, PUT'
    );

    return res.status(405).json({
      ok: false,
      error: 'Método não permitido'
    });

  } catch (error) {
    console.error(error);

    if (
      error.code ===
      'STORAGE_NOT_CONFIGURED'
    ) {
      return res.status(503).json({
        ok: false,
        error: 'O banco online ainda não foi configurado no Vercel.'
      });
    }

    return res.status(500).json({
      ok: false,
      error: 'Erro interno do catálogo'
    });
  }
                            }
