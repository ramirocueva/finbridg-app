// api/mercado.js - probe Ambito correct endpoints
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function probe(url) {
  try {
      var r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json,*/*', 'Referer': 'https://mercados.ambito.com/' } });
          var text = await r.text();
              return { status: r.status, body: text.slice(0, 200) };
                } catch(e) { return { status: 0, err: e.message }; }
                }

                module.exports = async function(req, res) {
                  res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Cache-Control', 'no-store');
                      var results = await Promise.all([
                          probe('https://mercados.ambito.com/dolar/oficial/variacion'),
                              probe('https://mercados.ambito.com//accion/GGAL/variacion'),
                                  probe('https://mercados.ambito.com/accion/GGAL/variacion'),
                                      probe('https://mercados.ambito.com//accion/GGAL/cotizacion'),
                                          probe('https://mercados.ambito.com/portfolio'),
                                              probe('https://mercados.ambito.com/merval/grafico/anual/datos'),
                                                ]);
                                                  var keys = ['ambito_dolar','ambito_accion_v1','ambito_accion_v2','ambito_accion_cotiz','ambito_portfolio','ambito_merval'];
                                                    var out = {};
                                                      keys.forEach(function(k,i){ out[k] = results[i]; });
                                                        res.status(200).json(out);
                                                        };