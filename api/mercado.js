// api/mercado.js - Vercel Serverless Function
// Cookie + crumb flow correcto para Yahoo Finance

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
            // Paso 1: obtener cookies de la homepage de Yahoo Finance
              const r1 = await fetch('https://finance.yahoo.com/?lang=en-US&region=US', {
                  headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
                      redirect: 'follow',
                        });

                          // Extraer todas las cookies (Node 18+ tiene getSetCookie, sino usamos get)
                            var allCookies = '';
                              try {
                                  var cookieArr = r1.headers.getSetCookie();
                                      allCookies = cookieArr.map(function(c) { return c.split(';')[0]; }).join('; ');
                                        } catch(e) {
                                            var raw = r1.headers.get('set-cookie') || '';
                                                allCookies = raw.split(',').map(function(c) { return c.split(';')[0].trim(); }).filter(function(c) { return c.indexOf('=') > -1; }).join('; ');
                                                  }

                                                    // Paso 2: obtener crumb con esas cookies
                                                      var r2 = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
                                                          headers: { 'User-Agent': UA, 'Cookie': allCookies, 'Accept': '*/*', 'Referer': 'https://finance.yahoo.com' },
                                                            });
                                                              if (!r2.ok) throw new Error('Crumb HTTP ' + r2.status);
                                                                var crumb = await r2.text();
                                                                  if (!crumb || crumb.indexOf('<') > -1 || crumb.length < 4) throw new Error('Crumb invalido: ' + crumb.slice(0, 30));
                                                                    return { cookie: allCookies, crumb: crumb };
                                                                    }

                                                                    module.exports = async function(req, res) {
                                                                      res.setHeader('Access-Control-Allow-Origin', '*');
                                                                        res.setHeader('Access-Control-Allow-Methods', 'GET');
                                                                          res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');

                                                                            try {
                                                                                var symbols = ACCIONES.concat(CEDEARS).concat(['^MERV']).join(',');

                                                                                    var results = await Promise.allSettled([
                                                                                          getYahooCrumb(),
                                                                                                fetch('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimos/1'),
                                                                                                    ]);
                                                                                                        var authResult = results[0];
                                                                                                            var rpResult   = results[1];

                                                                                                                var riesgoPais = null;
                                                                                                                    if (rpResult.status === 'fulfilled' && rpResult.value.ok) {
                                                                                                                          var rpData = await rpResult.value.json();
                                                                                                                                if (Array.isArray(rpData) && rpData.length > 0) riesgoPais = rpData[0].valor;
                                                                                                                                    }

                                                                                                                                        if (authResult.status !== 'fulfilled') throw new Error('Auth: ' + authResult.reason);
                                                                                                                                            var cookie = authResult.value.cookie;
                                                                                                                                                var crumb  = authResult.value.crumb;

                                                                                                                                                    var yhUrl = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' +
                                                                                                                                                          encodeURIComponent(symbols) + '&crumb=' + encodeURIComponent(crumb) + '&lang=en&region=US';

                                                                                                                                                              var yhRes = await fetch(yhUrl, {
                                                                                                                                                                    headers: { 'User-Agent': UA, 'Cookie': cookie, 'Accept': 'application/json', 'Referer': 'https://finance.yahoo.com' },
                                                                                                                                                                        });
                                                                                                                                                                            if (!yhRes.ok) throw new Error('Yahoo HTTP ' + yhRes.status);
                                                                                                                                                                                var yhData = await yhRes.json();
                                                                                                                                                                                    var quotes = (yhData.quoteResponse && yhData.quoteResponse.result) || [];

                                                                                                                                                                                        var bySymbol = {};
                                                                                                                                                                                            quotes.forEach(function(q) { if (q && q.symbol) bySymbol[q.symbol] = q; });

                                                                                                                                                                                                function mapQ(sym) {
                                                                                                                                                                                                      var q = bySymbol[sym];
                                                                                                                                                                                                            if (!q) return null;
                                                                                                                                                                                                                  return { ticker: sym.replace('.BA',''), name: NOMBRES[sym] || sym, price: q.regularMarketPrice || 0, change: q.regularMarketChangePercent || 0 };
                                                                                                                                                                                                                      }

                                                                                                                                                                                                                          var acciones = ACCIONES.map(mapQ).filter(function(x){ return x !== null; });
                                                                                                                                                                                                                              var cedears  = CEDEARS.map(mapQ).filter(function(x){ return x !== null; });
                                                                                                                                                                                                                                  var mq = bySymbol['^MERV'];
                                                                                                                                                                                                                                      var merval = mq ? mq.regularMarketPrice : null;

                                                                                                                                                                                                                                          res.status(200).json({ acciones: acciones, cedears: cedears, bonos: [], tasas: [], merval: merval, riesgoPais: riesgoPais });

                                                                                                                                                                                                                                            } catch (error) {
                                                                                                                                                                                                                                                res.status(500).json({ error: error.message });
                                                                                                                                                                                                                                                  }
                                                                                                                                                                                                                                                  };