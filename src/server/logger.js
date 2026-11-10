const winston = require('winston');
const Transport = require('winston-transport');
const { getLogsCollection, getSettingsCollection } = require('./data/repositories');

const LOG_LEVELS = ['error', 'warn', 'info', 'debug'];
const DEFAULT_LEVEL = 'info';

let cachedLevel = DEFAULT_LEVEL;

async function loadLevelFromSettings() {
  try {
    const settings = await getSettingsCollection();
    const doc = await settings.findOne({ _id: 'logging' });
    if (doc && LOG_LEVELS.includes(doc.level)) {
      cachedLevel = doc.level;
      logger.level = cachedLevel;
    }
  } catch (err) {
    // Si encara no hi ha connexió a Mongo a l'arrencada, es queda amb el
    // nivell per defecte fins que algú torne a cridar setLevel/reload.
    console.error('[logger] no s\'ha pogut llegir el nivell de appSettings', err && err.message ? err.message : err);
  }
}

// Escriu cada entrada com a document a la col·lecció capped `appLogs`
// (circularitat nativa de Mongo). No bloqueja el bucle d'events: els
// errors d'escriptura només es reporten a consola, mai trenquen la
// petició/esdeveniment que estava generant el log.
class MongoCappedTransport extends Transport {
  log(info, callback) {
    setImmediate(() => this.emit('logged', info));
    const { level, message, timestamp, tag, pin, hostId, playerId, ...meta } = info;
    getLogsCollection()
      .then((collection) => collection.insertOne({
        level,
        message,
        tag: tag || null,
        pin: pin || null,
        hostId: hostId || null,
        playerId: playerId || null,
        meta: Object.keys(meta).length ? meta : null,
        createdAt: timestamp ? new Date(timestamp) : new Date()
      }))
      .catch((err) => {
        console.error('[logger] no s\'ha pogut persistir el log a Mongo', err && err.message ? err.message : err);
      });
    callback();
  }
}

const logger = winston.createLogger({
  level: cachedLevel,
  levels: winston.config.npm.levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, tag }) => {
          const tagPart = tag ? `[${tag}] ` : '';
          return `${timestamp} ${level}: ${tagPart}${message}`;
        })
      )
    }),
    new MongoCappedTransport()
  ]
});

function setLevel(level) {
  if (!LOG_LEVELS.includes(level)) {
    throw new Error(`Nivell de log invàlid: ${level}`);
  }
  cachedLevel = level;
  logger.level = level;
}

module.exports = {
  logger,
  setLevel,
  reloadLevel: loadLevelFromSettings,
  LOG_LEVELS,
  DEFAULT_LEVEL
};

loadLevelFromSettings();
