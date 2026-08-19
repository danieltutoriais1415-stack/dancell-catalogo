import { list, put } from '@vercel/blob';

const PREFIX = 'dancell/products-';
const IMAGE_PREFIX = 'dancell/images/';
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


/* =========================
   AUTORIZAÇÃO
========================= */

function authorized(req) {
  const pin = String(
    req.headers['x-admin-pin'] || ''
  );

  return pin === ADMIN_PIN;
}


/* =========================
   NORMALIZAR PRODUTO
========================= */

function normalizeProduct(product = {}) {
  return {
    id:
      product.id ??
      Date.now(),

    name:
      String(
        product.name ??
        ''
      ).trim(),

    brand:
      String(
        product.brand ??
        product.category ??
        ''
      ).trim(),

    category:
      String(
        product.category ??
        product.brand ??
        'Outros'
      ).trim(),

    price:
      String(
        product.price ??
        'Consulte'
      ).trim(),

    installment:
      String(
        product.installment ??
        ''
      ).trim(),

    description:
      String(
        product.description ??
        product.desc ??
        ''
      ).trim(),

    image:
      String(
        product.image ??
        ''
      ).trim()
  };
}


/* =========================
   LER PRODUTOS
========================= */

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

  const latest =
    [...result.blobs]
      .sort(
        (a, b) =>
          new Date(b.uploadedAt) -
          new Date(a.uploadedAt)
      )[0];

  const response =
    await fetch(
      latest.url,
      {
        cache: 'no-store'
      }
    );

  if (!response.ok) {
    return starter;
  }

  const data =
    await response.json();

  return Array.isArray(data)
    ? data
    : starter;
}


/* =========================
   SALVAR PRODUTOS
========================= */

async function writeProducts(products) {

  if (!process.env.BLOB_READ_WRITE_TOKEN) {

    const error =
      new Error(
        'STORAGE_NOT_CONFIGURED'
      );

    error.code =
      'STORAGE_NOT_CONFIGURED';

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


/* =========================
   SALVAR FOTO NO BLOB
========================= */

async function saveImage(image) {

  if (!image) {
    return '';
  }

  /*
    Se já for uma URL normal,
    mantém como está.
  */
  if (
    image.startsWith('http://') ||
    image.startsWith('https://')
  ) {
    return image;
  }

  /*
    Só processa imagens Base64
    enviadas pelo celular.
  */
  if (!image.startsWith('data:image/')) {
    return image;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {

    const error =
      new Error(
        'STORAGE_NOT_CONFIGURED'
      );

    error.code =
      'STORAGE_NOT_CONFIGURED';

    throw error;
  }

  const match =
    image.match(
      /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
    );

  if (!match) {

    throw new Error(
      'INVALID_IMAGE'
    );

  }

  const mimeType =
    match[1];

  const base64Data =
    match[2];

  const buffer =
    Buffer.from(
      base64Data,
      'base64'
    );

  /*
    Limite de segurança:
    aproximadamente 4 MB.
  */
  if (
    buffer.length >
    4 * 1024 * 1024
  ) {

    throw new Error(
      'IMAGE_TOO_LARGE'
    );

  }

  let extension = 'jpg';

  if (
    mimeType === 'image/png'
  ) {
    extension = 'png';
  }

  else if (
    mimeType === 'image/webp'
  ) {
    extension = 'webp';
  }

  else if (
    mimeType === 'image/gif'
  ) {
    extension = 'gif';
  }

  else if (
    mimeType === 'image/jpeg'
  ) {
    extension = 'jpg';
  }

  const fileName =
    `${IMAGE_PREFIX}${Date.now()}.${extension}`;

  const blob =
    await put(
      fileName,
      buffer,
      {
        access: 'public',
        contentType: mimeType,
        addRandomSuffix: true
      }
    );

  return blob.url;
}


/* =========================
   PREPARAR PRODUTO
========================= */

async function prepareProduct(product = {}) {

  const normalized =
    normalizeProduct(product);

  normalized.image =
    await saveImage(
      normalized.image
    );

  return normalized;
}


/* =========================
   API
========================= */

export default async function handler(
  req,
  res
) {

  try {

    /* =====================
       GET
    ===================== */

    if (
      req.method === 'GET'
    ) {

      const products =
        await readProducts();

      return res
        .status(200)
        .json({
          products,
          online: Boolean(
            process.env
              .BLOB_READ_WRITE_TOKEN
          )
        });
    }


    /* =====================
       LOGIN
    ===================== */

    if (
      req.method === 'POST' &&
      req.query?.action === 'login'
    ) {

      if (
        authorized(req)
      ) {

        return res
          .status(200)
          .json({
            ok: true
          });

      }

      return res
        .status(401)
        .json({
          ok: false,
          error: 'PIN incorreto'
        });
    }


    /* =====================
       PROTEÇÃO
    ===================== */

    if (
      !authorized(req)
    ) {

      return res
        .status(401)
        .json({
          ok: false,
          error: 'Não autorizado'
        });

    }


    /* =====================
       PUT
    ===================== */

    if (
      req.method === 'PUT'
    ) {

      const body =
        req.body || {};

      const current =
        await readProducts();


      /* =================
         SALVAR LISTA
      ================= */

      if (
        Array.isArray(
          body.products
        )
      ) {

        const limited =
          body.products
            .slice(0, 500);

        const next = [];

        for (
          const product
          of limited
        ) {

          next.push(
            await prepareProduct(
              product
            )
          );

        }

        await writeProducts(
          next
        );

        return res
          .status(200)
          .json({
            ok: true,
            products: next
          });

      }


      /* =================
         CRIAR
      ================= */

      if (
        body.action ===
        'create'
      ) {

        const product =
          await prepareProduct({
            ...body.product,

            id:
              body.product?.id ??
              Date.now()
          });

        if (
          !product.name
        ) {

          return res
            .status(400)
            .json({
              ok: false,
              error:
                'Nome do produto é obrigatório'
            });

        }

        const next = [
          product,
          ...current
        ].slice(
          0,
          500
        );

        await writeProducts(
          next
        );

        return res
          .status(200)
          .json({
            ok: true,
            products: next
          });

      }


      /* =================
         EDITAR
      ================= */

      if (
        body.action ===
        'update'
      ) {

        const product =
          await prepareProduct(
            body.product
          );

        if (
          !product.name
        ) {

          return res
            .status(400)
            .json({
              ok: false,
              error:
                'Nome do produto é obrigatório'
            });

        }

        const id =
          String(
            product.id
          );

        let found =
          false;

        const next =
          current.map(
            item => {

              if (
                String(
                  item.id
                ) === id
              ) {

                found =
                  true;

                return {
                  ...item,
                  ...product
                };

              }

              return item;

            }
          );

        if (
          !found
        ) {

          return res
            .status(404)
            .json({
              ok: false,
              error:
                'Produto não encontrado'
            });

        }

        await writeProducts(
          next
        );

        return res
          .status(200)
          .json({
            ok: true,
            products: next
          });

      }


      /* =================
         EXCLUIR
      ================= */

      if (
        body.action ===
        'delete'
      ) {

        const id =
          String(
            body.id ??
            ''
          );

        const next =
          current.filter(
            item =>
              String(
                item.id
              ) !== id
          );

        await writeProducts(
          next
        );

        return res
          .status(200)
          .json({
            ok: true,
            products: next
          });

      }


      return res
        .status(400)
        .json({
          ok: false,
          error: 'Ação inválida'
        });

    }


    /* =====================
       MÉTODO INVÁLIDO
    ===================== */

    res.setHeader(
      'Allow',
      'GET, POST, PUT'
    );

    return res
      .status(405)
      .json({
        ok: false,
        error:
          'Método não permitido'
      });


  } catch (error) {

    console.error(
      'ERRO DAN CELL:',
      error
    );


    if (
      error.code ===
      'STORAGE_NOT_CONFIGURED'
    ) {

      return res
        .status(503)
        .json({
          ok: false,
          error:
            'O banco online ainda não foi configurado no Vercel.'
        });

    }


    if (
      error.message ===
      'IMAGE_TOO_LARGE'
    ) {

      return res
        .status(413)
        .json({
          ok: false,
          error:
            'A foto é muito grande. Escolha uma imagem menor.'
        });

    }


    if (
      error.message ===
      'INVALID_IMAGE'
    ) {

      return res
        .status(400)
        .json({
          ok: false,
          error:
            'A imagem selecionada é inválida.'
        });

    }


    return res
      .status(500)
      .json({
        ok: false,
        error:
          error?.message ||
          'Erro interno do catálogo'
      });

  }

}
