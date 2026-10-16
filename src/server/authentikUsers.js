async function linkAuthentikUser(users, profile, issuer) {
  const email = String(profile.email || '').toLowerCase().trim();
  const subject = String(profile.sub || '').trim();
  if (!email || !subject || profile.email_verified !== true) {
    throw new Error('Authentik debe devolver identidad y correo verificado.');
  }
  const identity = { authentikIssuer: issuer, authentikId: subject };
  const linked = await users.findOne(identity);
  const existing = linked || await users.findOne({ email });
  const now = new Date();
  if (existing) {
    if (!linked && existing.authentikId &&
        (existing.authentikId !== subject || (existing.authentikIssuer && existing.authentikIssuer !== issuer))) {
      throw new Error('El correo ya está vinculado a otra identidad. Contacta con info@sasogu.es.');
    }
    const update = { ...identity, authentikVerifiedEmail: true, lastLoginAt: now, updatedAt: now };
    if (!existing.nickname) update.nickname = profile.name || profile.preferred_username || '';
    const result = await users.updateOne({
      _id: existing._id,
      authentikId: existing.authentikId || { $exists: false }
    }, { $set: update, $addToSet: { authProviders: 'authentik' } });
    if (result.matchedCount !== 1) throw new Error('La vinculación ha cambiado. Vuelve a iniciar sesión.');
    return { ...existing, ...update };
  }
  const user = {
    ...identity, email, authentikVerifiedEmail: true, authProviders: ['authentik'],
    role: 'editor', nickname: profile.name || profile.preferred_username || '',
    createdAt: now, lastLoginAt: now
  };
  const result = await users.insertOne(user);
  return { ...user, _id: result.insertedId };
}

module.exports = { linkAuthentikUser };
