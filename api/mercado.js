// api/mercado.js — Vercel Serverless Function
// Proxy para Yahoo Finance + Riesgo Pais (evita CORS desde el navegador)

const ACCIONES = [
  'GGAL.BA','YPF.BA','PAMP.BA','BBAR.BA','TXAR.BA',
    'ALUA.BA','CRES.BA','LOMA.BA','SUPV.BA','BMA.BA',
      'CEPU.BA','TECO2.BA'
      ];
      const CEDEARS = [
        'AAPL.BA','MSFT.BA','MELI.BA','GOOGL.BA',
          'AMZN.BA','TSLA.BA','META.BA'
          ];
          const INDICES = ['^MERV'];

          const NOMBRES = {
            'GGAL.BA': 'Galicia', 'YPF.BA': 'YPF', 'PAMP.BA': 'Pampa Energia',
              'BBAR.BA': 'BBVA Argentina', 'TXAR.BA': 'Ternium Argentina',
                'ALUA.BA': 'Aluar', 'CRES.BA': 'Cresud', 'LOMA.BA': 'Loma Negra',
                  'SUPV.BA': 'Supervielle', 'BMA.BA': 'Banco Macro',
                    'CEPU.BA': 'Central Puerto', 'TECO2.BA': 'Telecom Argentina',
                      'AAPL.BA': 'Apple', 'MSFT.BA': 'Microsoft', 'MELI.BA': 'MercadoLibre',
                        'GOOGL.BA': 'Alphabet', 'AMZN.BA': 'Amazon',
                          'TSLA.BA': 'Tesla', 'META.BA': 'Meta'
                          };

                          module.exports = async (req, res) => {
                            res.setHeader('Access-Control-Allow-Origin', '*');
                              res.setHeader('Access-Control-Allow-Methods', 'GET');
                                res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');

                                  try {
                                      const symbols = [...ACCIONES, ...CEDEARS, ...INDICES].join(',');
                                          const yhUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&lang=en&region=US`;

                                              // Fetch Yahoo Finance y Riesgo Pais en paralelo
                                                  const [yhRes, rpRes] = await Promise.allSettled([
                                                        fetch(yhUrl, {
                                                                headers: {
                                                                          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                                                                    'Accept': 'application/json,text/plain,*/*',
                                                                                              'Accept-Language': 'en-US,en;q=0.9',
                                                                                                        'Referer': 'https://finance.yahoo.com',
                                                                                                                }
                                                                                                                      }),
                                                                                                                            fetch('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimos/1')
                                                                                                                                ]);

                                                                                                                                    // Procesar Riesgo Pais
                                                                                                                                        let riesgoPais = null;
                                                                                                                                            if (rpRes.status === 'fulfilled' && rpRes.value.ok) {
                                                                                                                                                  const rpData = await rpRes.value.json();
                                                                                                                                                        if (Array.isArray(rpData) && rpData.length > 0) {
                                                                                                                                                                riesgoPais = rpData[0].valor;
                                                                                                                                                                      }
                                                                                                                                                                          }

                                                                                                                                                                              // Procesar Yahoo Finance
                                                                                                                                                                                  if (yhRes.status !== 'fulfilled' || !yhRes.value.ok) {
                                                                                                                                                                                        throw new Error('Yahoo Finance no disponible');
                                                                                                                                                                                            }
                                                                                                                                                                                                const yhData = await yhRes.value.json();
                                                                                                                                                                                                    const quotes = (yhData.quoteResponse && yhData.quoteResponse.result) || [];

                                                                                                                                                                                                        // Mapear por simbolo
                                                                                                                                                                                                            const bySymbol = {};
                                                                                                                                                                                                                quotes.forEach(q => { bySymbol[q.symbol] = q; });

                                                                                                                                                                                                                    // Construir arrays
                                                                                                                                                                                                                        const acciones = ACCIONES.map(sym => {
                                                                                                                                                                                                                              const q = bySymbol[sym];
                                                                                                                                                                                                                                    if (!q) return null;
                                                                                                                                                                                                                                          return {
                                                                                                                                                                                                                                                  ticker: sym.replace('.BA', ''),
                                                                                                                                                                                                                                                          name: NOMBRES[sym] || sym,
                                                                                                                                                                                                                                                                  price: q.regularMarketPrice || 0,
                                                                                                                                                                                                                                                                          change: q.regularMarketChangePercent || 0
                                                                                                                                                                                                                                                                                };
                                                                                                                                                                                                                                                                                    }).filter(Boolean);

                                                                                                                                                                                                                                                                                        const cedears = CEDEARS.map(sym => {
                                                                                                                                                                                                                                                                                              const q = bySymbol[sym];
                                                                                                                                                                                                                                                                                                    if (!q) return null;
                                                                                                                                                                                                                                                                                                          return {
                                                                                                                                                                                                                                                                                                                  ticker: sym.replace('.BA', ''),
                                                                                                                                                                                                                                                                                                                          name: NOMBRES[sym] || sym,
                                                                                                                                                                                                                                                                                                                                  price: q.regularMarketPrice || 0,
                                                                                                                                                                                                                                                                                                                                          change: q.regularMarketChangePercent || 0
                                                                                                                                                                                                                                                                                                                                                };
                                                                                                                                                                                                                                                                                                                                                    }).filter(Boolean);

                                                                                                                                                                                                                                                                                                                                                        // MERVAL
                                                                                                                                                                                                                                                                                                                                                            const mervalQuote = bySymbol['^MERV'];
                                                                                                                                                                                                                                                                                                                                                                const merval = mervalQuote ? mervalQuote.regularMarketPrice : null;

                                                                                                                                                                                                                                                                                                                                                                    res.status(200).json({
                                                                                                                                                                                                                                                                                                                                                                          acciones,
                                                                                                                                                                                                                                                                                                                                                                                cedears,
                                                                                                                                                                                                                                                                                                                                                                                      bonos: [],
                                                                                                                                                                                                                                                                                                                                                                                            tasas: [],
                                                                                                                                                                                                                                                                                                                                                                                                  merval,
                                                                                                                                                                                                                                                                                                                                                                                                        riesgoPais
                                                                                                                                                                                                                                                                                                                                                                                                            });

                                                                                                                                                                                                                                                                                                                                                                                                              } catch (error) {
                                                                                                                                                                                                                                                                                                                                                                                                                  res.status(500).json({ error: error.message });
                                                                                                                                                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                                                                                                                                                    };