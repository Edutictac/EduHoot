const express = require('express');
const fs = require('fs');
const path = require('path');

module.exports = function createGamesRouter({ games, finishedSessionReports, liveSessionToCsv, FINISHED_SESSION_REPORT_DIR }) {
  const router = express.Router();

  router.get('/api/validate-pin/:pin', (req, res) => {
    const rawPin = (req.params.pin || '').trim();
    if (!rawPin) {
      return res.json({ valid: false });
    }
    const game = games.getGameByPin(rawPin);
    res.json({ valid: !!game });
  });

  router.get('/api/live-games/:pin/report.csv', async (req, res) => {
    const pin = (req.params.pin || '').toString();
    const hostId = (req.query.hostId || '').toString();
    console.log('[report.csv] pin=' + pin + ', hostId=' + hostId);
    if (!pin || !hostId) {
      return res.status(400).json({ error: 'Faltan PIN o hostId.' });
    }

    const game = games.getGameByPin(pin);
    let csv = '';
    const cached = finishedSessionReports.get(pin);
    if (cached && cached.csv) {
      // Partida ya finalizada: usamos siempre la foto congelada en cacheFinishedSessionReport,
      // aunque el objeto de partida siga en memoria unos segundos más (scheduleGameCleanup).
      // Recalcular en vivo aquí volvería a consultar players.getPlayers(), que para entonces
      // puede haber perdido jugadores ya desconectados, dejando el informe con un solo "ganador".
      console.log('[report.csv] found in memory cache');
      // Tras GameOver el host puede reconectar con un socket (hostId) nuevo mientras el objeto
      // de partida sigue vivo unos segundos más: aceptamos tanto el hostId congelado en el
      // momento del GameOver como el hostId actual de esa partida en memoria. Cualquier otro
      // valor se rechaza para no servir el informe (nombres y notas del alumnado) a quien solo
      // conozca el PIN.
      const matchesCachedHost = !!cached.hostId && hostId === cached.hostId;
      const matchesLiveHost = !!(game && game.hostId === hostId);
      if (!matchesCachedHost && !matchesLiveHost) {
        return res.status(403).json({ error: 'No autorizado para descargar este informe.' });
      }
      csv = cached.csv;
    } else if (game) {
      console.log('[report.csv] game found in memory, sin cache aun: generando en vivo');
      if (game.hostId !== hostId) {
        return res.status(403).json({ error: 'No autorizado para descargar este informe.' });
      }
      csv = liveSessionToCsv(game);
    } else {
      console.log('[report.csv] game NOT in memory, checking disk');
      const pinSafe = String(pin).replace(/[^a-z0-9-_]+/gi, '_');
      const reportPath = path.join(FINISHED_SESSION_REPORT_DIR, `${pinSafe}.csv`);
      const metaPath = path.join(FINISHED_SESSION_REPORT_DIR, `${pinSafe}.json`);
      console.log('[report.csv] trying to read from disk: ' + reportPath);
      try {
        csv = fs.readFileSync(reportPath, 'utf8');
        console.log('[report.csv] file read from disk, length=' + csv.length);
      } catch (err) {
        console.log('[report.csv] file not found: ' + err.message);
        return res.status(404).json({ error: 'Partida no encontrada o ya finalizada.' });
      }
      let storedHostId = '';
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        storedHostId = String((meta && meta.hostId) || '');
      } catch (metaErr) {
        // Informe escrito antes de introducir el sidecar, o sidecar ya expirado: no podemos
        // verificar la autoría, así que lo dejamos pasar como hasta ahora.
        storedHostId = '';
      }
      if (storedHostId && storedHostId !== hostId) {
        return res.status(403).json({ error: 'No autorizado para descargar este informe.' });
      }
    }

    const safePin = String(pin).replace(/[^a-z0-9-_]+/gi, '_');
    const fileName = `informe-partida-${safePin}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send('﻿' + csv);
  });

  return router;
};
