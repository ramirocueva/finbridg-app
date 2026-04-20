// api/mercado.js - Vercel Serverless Function
// Usa Stooq.com CSV API (funciona desde servidores, no requiere auth)

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

          async function fetchStooq(symbol) {
            var s = symbol.toLowerCase().replace('^', '%5E');
              var url = 'https://stooq.com/q/d/l/?s=' + s + '&i=d';
                try {
                    var res = await fetch(url, {
                          headers: { 'User-Agent': UA, 'Accept': 'text/plain,text/csv,*/*' }
                              });
                                  if (!res.ok) return null;
                                      var text = await res.text();
                                          var lines = text.trim().split('\n');
                                              // lines[0] = header: Date,Open,High,Low,Close,Volume
                                                  if (lines.length < 2) return null;
                                                      var last = lines[lines.length - 1].split(',');
                                                          if (last.length < 5) return null;
                                                              var price = parseFloat(last[4]);
                                                                  if (!price || isNaN(price)) return null;
                                                                      var change = 0;
                                                                          if (lines.length >= 3) {
                                                                                var prev = lines[lines.length - 2].split(',');
                                                                                      var prevPrice = parseFloat(prev[4]);
                                                                                            if (prevPrice && !isNaN(prevPrice)) {
                                                                                                    change = (price - prevPrice) / prevPrice * 100;
                                                                                                          }
                                                                                                              }
                                                                                                                  return { price: price, change: change };
                                                                                                                    } catch(e) {
                                                                                                                        return null;
                                                                                                                          }
                                                                                                                          }

                                                                                                                          module.exports = async function(req, res) {
                                                                                                                            res.setHeader('Access-Control-Allow-Origin', '*');
                                                                                                                              res.setHeader('Access-Control-Allow-Methods', 'GET');
                                                                                                                                res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=120');
                                                                                                                                  try {
                                                                                                                                      var allSymbols = ACCIONES.concat(CEDEARS);
                                                                                                                                          var stockPromises = allSymbols.map(function(sym) { return fetchStooq(sym); });
                                                                                                                                              var mervalPromise = fetchStooq('^SPMERV');
                                                                                                                                                  var rpPromise = fetch('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais');

                                                                                                                                                      var stockResults = await Promise.allSettled(stockPromises);
                                                                                                                                                          var mervalResult = await mervalPromise;
                                                                                                                                                              var rpRes = await rpPromise;

                                                                                                                                                                  var riesgoPais = null;
                                                                                                                                                                      if (rpRes.ok) {
                                                                                                                                                                            var rpData = await rpRes.json();
                                                                                                                                                                                  if (Array.isArray(rpData) && rpData.length > 0) {
                                                                                                                                                                                          var last = rpData[rpData.length - 1];
                                                                                                                                                                                                  riesgoPais = last.valor !== undefined ? last.valor : (last.value !== undefined ? last.value : null);
                                                                                                                                                                                                        } else if (rpData && rpData.valor !== undefined) {
                                                                                                                                                                                                                riesgoPais = rpData.valor;
                                                                                                                                                                                                                      }
                                                                                                                                                                                                                          }

                                                                                                                                                                                                                              function mapResult(sym, idx) {
                                                                                                                                                                                                                                    var r = stockResults[idx];
                                                                                                                                                                                                                                          if (r.status !== 'fulfilled' || !r.value) return null;
                                                                                                                                                                                                                                                return {
                                                                                                                                                                                                                                                        ticker: sym.replace('.BA',''),
                                                                                                                                                                                                                                                                name: NOMBRES[sym] || sym,
                                                                                                                                                                                                                                                                        price: r.value.price,
                                                                                                                                                                                                                                                                                change: r.value.change
                                                                                                                                                                                                                                                                                      };
                                                                                                                                                                                                                                                                                          }

                                                                                                                                                                                                                                                                                              var acciones = ACCIONES.map(function(sym, i) { return mapResult(sym, i); }).filter(function(x) { return x !== null; });
                                                                                                                                                                                                                                                                                                  var cedears  = CEDEARS.map(function(sym, i) { return mapResult(sym, ACCIONES.length + i); }).filter(function(x) { return x !== null; });
                                                                                                                                                                                                                                                                                                      var merval   = mervalResult ? mervalResult.price : null;

                                                                                                                                                                                                                                                                                                          res.status(200).json({ acciones: acciones, cedears: cedears, bonos: [], tasas: [], merval: merval, riesgoPais: riesgoPais });
                                                                                                                                                                                                                                                                                                            } catch (error) {
                                                                                                                                                                                                                                                                                                                res.status(500).json({ error: error.message });
                                                                                                                                                                                                                                                                                                                  }
                                                                                                                                                                                                                                                                                                                  };