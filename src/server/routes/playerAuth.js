const express = require('express');

module.exports = function createPlayerAuthRouter({ commons, authRateLimiter }) {
  const router = express.Router();

  router.get('/config', (req, res) => {
    res.json({
      enabled: commons.isStudentIdentityEnabled(),
      required: commons.isStudentIdentityEnabled() && commons.EDUTICTAC_ID_AUTH_REQUIRED
    });
  });

  router.post('/student', authRateLimiter, async (req, res) => {
    if (!commons.isStudentIdentityEnabled()) {
      return res.status(503).json({ error: 'Identitat EduTicTac no configurada.' });
    }
    const publicCode = (req.body.public_code || '').toString().trim().toUpperCase();
    const pin = (req.body.pin || '').toString().trim();
    try {
      const identity = await commons.authenticateStudentIdentity(publicCode, pin);
      const join = commons.createStudentJoinToken(identity);
      return res.json({
        ok: true,
        public_code: join.publicCode,
        display_name: join.publicCode,
        avatar_icon: identity && identity.avatar_icon ? String(identity.avatar_icon) : '',
        join_token: join.token
      });
    } catch (err) {
      const status = err && err.statusCode === 429 ? 429 : 401;
      return res.status(status).json({ error: 'Codi o PIN incorrecte.' });
    }
  });

  router.post('/launch-token', authRateLimiter, async (req, res) => {
    if (!commons.isStudentIdentityEnabled() || !commons.EDUTICTAC_ID_APP_TOKEN) {
      return res.status(503).json({ error: 'Identitat EduTicTac no configurada.' });
    }
    const launchToken = (req.body.launch_token || '').toString().trim();
    if (!launchToken) {
      return res.status(400).json({ error: 'Falta el token de Commons.' });
    }
    try {
      const launch = await commons.consumeCommonsLaunchToken(launchToken);
      const assignment = launch.assignment || {};
      const identity = {
        ...(launch.identity || {}),
        assignment_id: assignment.id || '',
        activity_id: assignment.activity_id || ''
      };
      const join = commons.createStudentJoinToken(identity, commons.STUDENT_ACTIVITY_TOKEN_TTL_MS);
      return res.json({
        ok: true,
        public_code: join.publicCode,
        display_name: join.publicCode,
        avatar_icon: identity.avatar_icon || '',
        join_token: join.token,
        assignment
      });
    } catch (err) {
      const status = err && err.statusCode === 429 ? 429 : 401;
      return res.status(status).json({ error: 'Token de Commons no vàlid.' });
    }
  });

  return router;
};
