// Registre de partides de l'usuari amb sessió: llistat i descàrrega de l'informe (només les pròpies).
const express = require('express');

module.exports = function createGameHistoryRouter({ gameHistory }) {
  const router = express.Router();

  router.get('/api/partidas', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado.' });
    try {
      return res.json(await gameHistory.listForOwner(req.user.id));
    } catch (err) {
      return res.status(500).json({ error: 'No se pudieron cargar las partidas.' });
    }
  });

  router.get('/api/partidas/:id/report.csv', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado.' });
    try {
      const found = await gameHistory.csvForOwner(req.user.id, req.params.id);
      if (!found) return res.status(404).json({ error: 'Partida no encontrada.' });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${found.fileName}"`);
      return res.send(found.csv);
    } catch (err) {
      return res.status(500).json({ error: 'No se pudo generar el informe.' });
    }
  });

  return router;
};
