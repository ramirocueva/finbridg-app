// api/mercado.js - Live Argentine market data via Ambito Financiero + argentinadatos.com

function parseAmbitoNum(str) {
    if (!str || str === '-' || str === '') return 0;
    return parseFloat(String(str).replace(/\./g, '').replace(',', '.')) || 0;
}

function parseAmbitoChange(str) {
    if (!str || str === '-' || str === '') return 0;
    return parseFloat(String(str).replace('%', '').replace(',', '.').trim()) || 0;
}

module.exports = async function(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    const headers = {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, */*',
          'Referer': 'https://www.ambito.com/'
    };

    const [accionesRes, cedearsRes, bolsasRes, riesgoRes] = await Promise.allSettled([
          fetch('https://mercados.ambito.com/acciones/lideres', { headers }),
          fetch('https://mercados.ambito.com/mercados/cedears', { headers }),
          fetch('https://mercados.ambito.com/mercados/bolsas', { headers }),
          fetch('https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais')
        ]);

    // Acciones: array of arrays [ticker, variacion, nombre, class, ultimo, cierre, volumen, fecha]
    let acciones = [];
    if (accionesRes.status === 'fulfilled' && accionesRes.value.ok) {
          try {
                  const raw = await accionesRes.value.json();
                  acciones = raw.map(item => ({
                            ticker: item[0],
                            name: item[2],
                            price: parseAmbitoNum(item[4]),
                            change: parseAmbitoChange(item[1])
                  })).filter(a => a.price > 0);
          } catch(e) {}
    }

    // CEDEARs: array of objects {nombre, ultimo, variacion, class-variacion}
    let cedears = [];
    if (cedearsRes.status === 'fulfilled' && cedearsRes.value.ok) {
          try {
                  const raw = await cedearsRes.value.json();
                  cedears = raw.map(item => ({
                            ticker: item.nombre,
                            name: item.nombre,
                            price: parseAmbitoNum(item.ultimo),
                            change: parseAmbitoChange(item.variacion)
                  })).filter(c => c.price > 0);
          } catch(e) {}
    }

    // MERVAL: bolsas array, find item with nombre === 'Merval'
    let merval = null;
    if (bolsasRes.status === 'fulfilled' && bolsasRes.value.ok) {
          try {
                  const raw = await bolsasRes.value.json();
                  const item = raw.find(i => i.nombre === 'Merval');
                  if (item) merval = parseAmbitoNum(item.ultimo);
          } catch(e) {}
    }

    // Riesgo Pais: array of {fecha, valor} - take last entry
    let riesgoPais = null;
    if (riesgoRes.status === 'fulfilled' && riesgoRes.value.ok) {
          try {
                  const raw = await riesgoRes.value.json();
                  if (Array.isArray(raw) && raw.length > 0) {
                            const last = raw[raw.length - 1];
                            riesgoPais = last.valor ?? last;
                  } else if (typeof raw === 'number') {
                            riesgoPais = raw;
                  }
          } catch(e) {}
    }

    res.status(200).json({ acciones, cedears, merval, riesgoPais });
};
