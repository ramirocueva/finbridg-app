// api/mercado.js - Vercel Serverless Function (sin dependencias npm)
// Cookie + crumb flow para Yahoo Finance v7

const ACCIONES = ['GGAL.BA','YPF.BA','PAMP.BA','BBAR.BA','TXAR.BA','ALUA.BA','CRES.BA','LOMA.BA','SUPV.BA','BMA.BA','CEPU.BA','TECO2.BA'];
const CEDEARS  = ['AAPL.BA','MSFT.BA','MELI.BA','GOOGL.BA','AMZN.BA','TSLA.BA','META.BA'];
const NOMBRES  = {
  'GGAL.BA':'Galicia','YPF.BA':'YPF','PAMP.BA':'Pampa Energia','BBAR.BA':'BBVA Argentina',
    'TXAR.BA':'Ternium Argentina','ALUA.BA':'Aluar','CRES.BA':'Cresud','LOMA.BA':'Loma Negra',
      'SUPV.BA':'Supervielle','BMA.BA':'Banco Macro','CEPU.BA':'Central Puerto','TECO2.BA':'Telecom Argentina',
        'AAPL.BA':'Apple','MSFT.BA':'Microsoft','MELI.BA':'MercadoLibre','GOOGL.BA':'Alphabet',
          'AMZN.BA':'Amazon','TSLA.BA':'Tesla','META.BA':'Meta'
          };

          const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

          async function getYahooCrumb() {
            const sessionRes = await fetch('https://fc.yahoo.com', {
                headers: { 'User-Agent': UA, 'Accept': 'text/html' },
                    redirect: 'follow',
                      });
                        const rawCookie = sessionRes.headers.get('set-cookie') || '';
                          const bMatch = rawCookie.match(/\bB=[^;]+/);
                            const cookie = bMatch ? bMatch[0] : '';

                              const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
                                  headers: { 'User-Agent': UA, 'Cookie': cookie },
                                    });
                                      if (!crumbRes.ok) throw new Error('Crumb HTTP ' + crumbRes.status);
                                        const crumb = await crumbRes.text();
                                          if (!crumb || crumb.includes('<')) throw new Error('Crumb invalido');
                                            return { cookie, crumb };
                                            }

                                            module.exports = async (req, res) => {
                                              res.setHeader('Access-Control-Allow-Origin', '*');
                                                res.setHeader('Access-Control-Allow-Methods', 'GET');
                                                  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');

                                                    try {
                                                        const symbols = [...ACCIONES, ...CEDEARS, '^MERV'].join(',');

                                                            const [authResult, rpResult] = await Promise.allSettled([
                                                                  getYahooCrumb(),
                                                                        fetch('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimos/1'),
                                                                            ]);

                                                                                let riesgoPais = null;
                                                                                    if (rpResult.status === 'fulfilled' && rpResult.value.ok) {
                                                                                          const rpData = await rpResult.value.json();
                                                                                                if (Array.isArray(rpData) && rpData.length > 0) riesgoPais = rpData[0].valor;
                                                                                                    }

                                                                                                        if (authResult.status !== 'fulfilled') throw new Error('Auth: ' + authResult.reason);
                                                                                                            const { cookie, crumb } = authResult.value;

                                                                                                                const yhUrl = 'https://query2.finance.yahoo.com/v7/finance/quote?symbols=' +
                                                                                                                      encodeURIComponent(symbols) + '&crumb=' + encodeURIComponent(crumb) + '&lang=en&region=US';

                                                                                                                          const yhRes = await fetch(yhUrl, {
                                                                                                                                headers: { 'User-Agent': UA, 'Cookie': cookie, 'Accept': 'application/json', 'Referer': 'https://finance.yahoo.com' },
                                                                                                                                    });
                                                                                                                                        if (!yhRes.ok) throw new Error('Yahoo Finance HTTP ' + yhRes.status);
                                                                                                                                            const yhData = await yhRes.json();
                                                                                                                                                const quotes = (yhData.quoteResponse && yhData.quoteResponse.result) || [];

                                                                                                                                                    const bySymbol = {};
                                                                                                                                                        quotes.forEach(function(q) { if (q && q.symbol) bySymbol[q.symbol] = q; });

                                                                                                                                                            function mapQ(sym) {
                                                                                                                                                                  var q = bySymbol[sym];
                                                                                                                                                                        if (!q) return null;
                                                                                                                                                                              return { ticker: sym.replace('.BA',''), name: NOMBRES[sym] || sym, price: q.regularMarketPrice || 0, change: q.regularMarketChangePercent || 0 };
                                                                                                                                                                                  }

                                                                                                                                                                                      var acciones = ACCIONES.map(mapQ).filter(Boolean);
                                                                                                                                                                                          var cedears  = CEDEARS.map(mapQ).filter(Boolean);
                                                                                                                                                                                              var mervalQ  = bySymbol['^MERV'];
                                                                                                                                                                                                  var merval   = mervalQ ? mervalQ.regularMarketPrice : null;

                                                                                                                                                                                                      res.status(200).json({ acciones: acciones, cedears: cedears, bonos: [], tasas: [], merval: merval, riesgoPais: riesgoPais });

                                                                                                                                                                                                        } catch (error) {
                                                                                                                                                                                                            res.status(500).json({ error: error.message });
                                                                                                                                                                                                              }
                                                                                                                                                                                                              };