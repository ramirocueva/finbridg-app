// api/mercado.js - probe multiple data sources
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function probe(label, url, opts) {
  try {
      var r = await fetch(url, opts || { headers: { 'User-Agent': UA, 'Accept': '*/*' } });
          var text = await r.text();
              return { status: r.status, body: text.slice(0, 150) };
                } catch(e) { return { status: 0, err: e.message }; }
                }

                module.exports = async function(req, res) {
                  res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Cache-Control', 'no-store');
                      var [stooqBa, stooqAr, byma, bolsar, ambito, ambitoMerv] = await Promise.all([
                          probe('stooq_ba', 'https://stooq.com/q/d/l/?s=ggal.ba&i=d'),
                              probe('stooq_ar', 'https://stooq.com/q/d/l/?s=ggal.ar&i=d'),
                                  probe('byma', 'https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/bnown/'),
                                      probe('bolsar', 'https://bolsar.info/listarCotizaciones.php?rubroId=2'),
                                          probe('ambito', 'https://mercados.ambito.com//accion/GGAL/ajax'),
                                              probe('ambitoMerv', 'https://mercados.ambito.com/merval/grafico/diario/datos'),
                                                ]);
                                                  res.status(200).json({ stooqBa, stooqAr, byma, bolsar, ambito, ambitoMerv });
                                                  };