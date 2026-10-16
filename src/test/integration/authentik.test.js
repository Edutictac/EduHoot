const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');
const { linkAuthentikUser } = require('../../server/authentikUsers');

let mongo, client, users, quizzes;
const issuer = 'https://id.example/application/o/eduhoot';
const profile = { sub: 'teacher-1', email: 'teacher@example.org', email_verified: true };
before(async () => {
  mongo = await MongoMemoryServer.create();
  client = await MongoClient.connect(mongo.getUri());
  users = client.db('migration').collection('users');
  quizzes = client.db('migration').collection('quizzes');
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ authentikIssuer: 1, authentikId: 1 }, { unique: true,
    partialFilterExpression: { authentikIssuer: { $type: 'string' }, authentikId: { $type: 'string' } } });
});
after(async () => { await client?.close(); await mongo?.stop(); });

test('links an existing account without changing ownership or admin permissions', async () => {
  const inserted = await users.insertOne({ email: profile.email, role: 'admin', authProviders: ['google'] });
  await quizzes.insertOne({ ownerId: inserted.insertedId.toString(), name: 'Existing quiz' });
  const linked = await linkAuthentikUser(users, profile, issuer);
  assert.equal(linked._id.toString(), inserted.insertedId.toString());
  assert.equal(linked.role, 'admin');
  assert.equal(await quizzes.countDocuments({ ownerId: linked._id.toString() }), 1);
  assert.deepEqual((await users.findOne({ _id: linked._id })).authProviders, ['google', 'authentik']);
});

test('uses subject after linking, even if the identity provider changes email', async () => {
  const linked = await linkAuthentikUser(users, { ...profile, email: 'changed@example.org' }, issuer);
  assert.equal(linked.email, profile.email);
  assert.equal(await users.countDocuments(), 1);
});

test('rejects unverified or missing email verification and missing subject', async () => {
  for (const invalid of [{ ...profile, email_verified: false }, { ...profile, email_verified: undefined }, { ...profile, sub: '' }]) {
    await assert.rejects(linkAuthentikUser(users, invalid, issuer));
  }
});

test('cannot replace an existing link using the same email', async () => {
  await assert.rejects(linkAuthentikUser(users, { ...profile, sub: 'attacker' }, issuer));
  await assert.rejects(linkAuthentikUser(users, profile, 'https://other.example'));
  assert.equal((await users.findOne({ email: profile.email })).authentikId, profile.sub);
});

test('simultaneous first logins create only one editor account', async () => {
  const newcomer = { ...profile, sub: 'new-teacher', email: 'new@example.org' };
  const results = await Promise.allSettled([linkAuthentikUser(users, newcomer, issuer), linkAuthentikUser(users, newcomer, issuer)]);
  assert.ok(results.some(r => r.status === 'fulfilled'));
  assert.equal(await users.countDocuments({ email: newcomer.email }), 1);
  assert.equal((await users.findOne({ email: newcomer.email })).role, 'editor');
});
