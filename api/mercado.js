// api/mercado.js — Vercel Serverless Function
// Usa yahoo-finance2 (maneja crumb/cookie internamente) + argentinadatos.com

const yahooFinance = require('yahoo-finance2').default;

const ACCIONES = [
  'GGAL.BA','YPF.BA','PAMP.BA','BBAR.BA','TXAR.BA',
    'ALUA.BA','CRES.BA','LOMA.BA','SUPV.BA','BMA.BA',
      'CEPU.BA','TECO2.BA'
      ];
      const CEDEARS = [
        'AAPL.BA','MSFT.BA','MELI.BA','GOOGL.BA',
          'AMZN.BA','TSLA.BA','META.BA'
          ];

          const NOMBRES = {
            'GGAL.BA':'Galicia','YPF.BA':'YPF','PAMP.BA':'Pampa Energia',
              'BBAR.BA':'BBVA Argentina','TXAR.BA':'Ternium Argentina',
                'ALUA.BA':'Aluar','CRES.BA':'Cresud','LOMA.BA':'Loma Negra',
                  'SUPV.BA':'Supervielle','BMA.BA':'Banco Macro',
                    'CEPU.BA':'Central Puerto','TECO2.BA':'Telecom Argentina',
                      'AAPL.BA':'Apple','MSFT.BA':'Microsoft','MELI.BA':'MercadoLibre',
                        'GOOGL.BA':'Alphabet','AMZN.BA':'Amazon','TSLA.BA':'Tesla','META.BA':'Meta'
                        };

                        module.exports = async (req, res) => {
                          res.setHeader('Access-Control-Allow-Origin', '*');
                            res.setHeader('Access-Control-Allow-Methods', 'GET');
                              res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');

                                try {
                                    const allSymbols = [...ACCIONES, ...CEDEARS, '^MERV'];

                                        // yahoo-finance2 maneja autenticacion internamente
                                            const [quotesResult, rpResult] = await Promise.allSettled([
                                                  yahooFinance.quote(allSymbols),
                                                        fetch('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimos/1')
                                                            ]);

                                                                // Riesgo Pais
                                                                    let riesgoPais = null;
                                                                        if (rpResult.status === 'fulfilled' && rpResult.value.ok) {
                                                                              const rpData = await rpResult.value.json();
                                                                                    if (Array.isArray(rpData) && rpData.length > 0) {
                                                                                            riesgoPais = rpData[0].valor;
                                                                                                  }
                                                                                                      }

                                                                                                          // Quotes
                                                                                                              if (quotesResult.status !== 'fulfilled') {
                                                                                                                    throw new Error('Yahoo Finance no disponible: ' + quotesResult.reason);
                                                                                                                        }

                                                                                                                            const quotes = Array.isArray(quotesResult.value)
                                                                                                                                  ? quotesResult.value
                                                                                                                                        : [quotesResult.value];

                                                                                                                                            const bySymbol = {};
                                                                                                                                                quotes.forEach(q => { if (q && q.symbol) bySymbol[q.symbol] = q; });

                                                                                                                                                    const mapQuote = sym => {
                                                                                                                                                          const q = bySymbol[sym];
                                                                                                                                                                if (!q) return null;
                                                                                                                                                                      return {
                                                                                                                                                                              ticker: sym.replace('.BA',''),
                                                                                                                                                                                      name: NOMBRES[sym] || sym,
                                                                                                                                                                                              price: q.regularMarketPrice || 0,
                                                                                                                                                                                                      change: q.regularMarketChangePercent || 0
                                                                                                                                                                                                            };
                                                                                                                                                                                                                };

                                                                                                                                                                                                                    const acciones = ACCIONES.map(mapQuote).filter(Boolean);
                                                                                                                                                                                                                        const cedears  = CEDEARS.map(mapQuote).filter(Boolean);

                                                                                                                                                                                                                            const mervalQ  = bySymbol['^MERV'];
                                                                                                                                                                                                                                const merval   = mervalQ ? mervalQ.regularMarketPrice : null;

                                                                                                                                                                                                                                    res.status(200).json({ acciones, cedears, bonos: [], tasas: [], merval, riesgoPais });

                                                                                                                                                                                                                                      } catch (error) {
                                                                                                                                                                                                                                          res.status(500).json({ error: error.message });
                                                                                                                                                                                                                                            }
                                                                                                                                                                                                                                            };