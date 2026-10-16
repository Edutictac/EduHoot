"""Run in Authentik's Django shell; all fixture writes are rolled back."""
from uuid import uuid4
from django.db import transaction
from authentik.core.models import User
from authentik.core.sources.mapper import SourceMapper
from authentik.core.tests.utils import RequestFactory
from authentik.sources.oauth.models import OAuthSource, UserOAuthSourceConnection

with transaction.atomic():
    source = OAuthSource.objects.get(slug='google', provider_type='google')
    identifier = 'eduhoot-regression-' + uuid4().hex
    user = User.objects.create(username=identifier, email=identifier + '@example.invalid')
    connection = UserOAuthSourceConnection.objects.create(source=source, identifier=identifier, user=user)
    request = RequestFactory().get('/source/oauth/callback/google/')
    mapper = SourceMapper(source)

    def profile(**extra):
        return mapper.build_object_properties(
            object_type=User, request=request, user=None,
            info={'id': identifier, 'email': user.email, 'name': identifier, **extra},
            client=None, token={})

    for claim in ['verified_email', 'email_verified']:
        user.attributes = {}
        user.save(update_fields=['attributes'])
        properties = profile(**{claim: True})
        user.refresh_from_db()
        assert user.attributes['edutictac_verified_email'] == user.email
        assert properties['attributes']['edutictac_verified_email'] == user.email

    for value in [False, 'true', None]:
        user.attributes = {}
        user.save(update_fields=['attributes'])
        properties = profile(verified_email=value)
        user.refresh_from_db()
        assert not user.attributes.get('edutictac_verified_email')
        assert not properties['attributes']['edutictac_verified_email']

    user.attributes = {}
    user.save(update_fields=['attributes'])
    profile(email='other@example.invalid', verified_email=True)
    user.refresh_from_db()
    assert not user.attributes.get('edutictac_verified_email')

    # The first Google link to a pre-existing native account must persist too.
    connection.delete()
    profile(verified_email=True)
    user.refresh_from_db()
    assert user.attributes['edutictac_verified_email'] == user.email
    transaction.set_rollback(True)
print('Google verification regression checks passed; fixture writes rolled back.')
