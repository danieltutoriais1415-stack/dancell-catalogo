import { list, put } from '@vercel/blob';

const PREFIX = 'dancell/products-';
const IMAGE_PREFIX = 'dancell/images/';
const ADMIN_PIN = '06109899';


/* =====================================================
   PRODUTOS INICIAIS
===================================================== */

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


/* =====================================================
   CONFIGURAÇÃO DO VERCEL BLOB
===================================================== */

function blobOptions() {

  const storeId =
    process.env.IMAGES_STORE_ID;

  /*
    O seu Blob pode usar OIDC automaticamente.

    Se existir um token, também utilizamos.
    Aceitamos os dois nomes para evitar conflito.
  */

  const token =
    process.env.IMAGES_READ_WRITE_TOKEN ||
    process.env.IMAGES_TOKEN ||
    '';

  if (!storeId) {

    const error =
      new Error('STORAGE_NOT_CONFIGURED');

    error.code =
      'STORAGE_NOT_CONFIGURED';

    throw error;
  }

  const options = {
    storeId
  };

  if (token) {
    options.token = token;
  }

  return options;
}


/* =====================================================
   AUTORIZAÇÃO
===================================================== */

function authorized(req) {

  const pin =
    String(
      req.headers['x-admin-pin'] || ''
    );

  return pin === ADMIN_PIN;
}


/* =====================================================
   NORMALIZAR PRODUTO
===================================================== */

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
