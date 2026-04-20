// api/mercado.js - DEBUG: muestra errores para diagnosticar
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
          var debugErrs = [];

          async function fetchChart(symbol) {
            var encoded = encodeURIComponent(symbol);
              var url = 'https://query2.finance.yahoo.com/v8/finance/chart/' + encoded + '?range=1d&interval=1d&includePrePost=false';
                try {
                    var res = await fetch(url, {
                          headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': 'https://finance.yahoo.com/' }
                              });
                                  if (!res.ok) { debugErrs.push(symbol + ':HTTP' + res.status); return null; }
                                      var data = await res.json();
                                          var result = data.chart && data.chart.result && data.chart.result[0];
                                              if (!result) { debugErrs.push(symbol + ':no_result'); return null; }
                                                  var meta = result.meta;
                                                      var price = meta.regularMarketPrice;
                                                          var prev = meta.chartPreviousClose || meta.previousClose || price;
                                                              var change = prev ? ((price - prev) / prev * 100) : 0;
                                                                  return { price: price, change: change };
                                                                    } catch(e) {
                                                                        debugErrs.push(symbol + ':' + e.message);
                                                                            return null;
                                                                              }
                                                                              }

                                                                              module.exports = async function(req, res) {
                                                                                debugErrs = [];
                                                                                  res.setHeader('Access-Control-Allow-Origin', '*');
                                                                                    res.setHeader('Access-Control-Allow-Methods', 'GET');
                                                                                      res.setHeader('Cache-Control', 'no-store');
                                                                                        try {
                                                                                            var allSymbols = ACCIONES.concat(CEDEARS).concat(['^MERV']);
                                                                                                var fetchPromises = allSymbols.map(function(sym) { return fetchChart(sym); });
                                                                                                    var rpPromise = fetch('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais/ultimos/1');
                                                                                                        var results = await Promise.allSettled(fetchPromises);
                                                                                                            var rpRes = await rpPromise;
                                                                                                                var riesgoPais = null;
                                                                                                                    var rpErr = null;
                                                                                                                        if (rpRes.ok) {
                                                                                                                              var rpData = await rpRes.json();
                                                                                                                                    if (Array.isArray(rpData) && rpData.length > 0) riesgoPais = rpData[0].valor;
                                                                                                                                        } else { rpErr = 'RP:HTTP' + rpRes.status; }
                                                                                                                                            function mapResult(sym, idx) {
                                                                                                                                                  var r = results[idx];
                                                                                                                                                        if (r.status !== 'fulfilled' || !r.value) return null;
                                                                                                                                                              return { ticker: sym.replace('.BA',''), name: NOMBRES[sym] || sym, price: r.value.price, change: r.value.change };
                                                                                                                                                                  }
                                                                                                                                                                      var acciones = ACCIONES.map(function(sym, i) { return mapResult(sym, i); }).filter(function(x) { return x !== null; });
                                                                                                                                                                          var cedears  = CEDEARS.map(function(sym, i) { return mapResult(sym, ACCIONES.length + i); }).filter(function(x) { return x !== null; });
                                                                                                                                                                              var mervIdx  = ACCIONES.length + CEDEARS.length;
                                                                                                                                                                                  var mervR    = results[mervIdx];
                                                                                                                                                                                      var merval   = (mervR.status === 'fulfilled' && mervR.value) ? mervR.value.price : null;
                                                                                                                                                                                          res.status(200).json({ acciones: acciones, cedears: cedears, bonos: [], tasas: [], merval: merval, riesgoPais: riesgoPais, _debug: debugErrs.slice(0,5), _rpErr: rpErr });
                                                                                                                                                                                            } catch (error) {
                                                                                                                                                                                                res.status(500).json({ error: error.message, _debug: debugErrs.slice(0,5) });
                                                                                                                                                                                                  }
                                                                                                                                                                                                  };