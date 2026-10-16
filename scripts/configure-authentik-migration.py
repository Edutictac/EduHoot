"""Run inside Authentik's Django shell after backing up its database.

The generated client secret is written directly to the remote EduHoot env
by the caller; this script never prints it.
"""
from authentik.core.models import Application
from authentik.flows.models import Flow, FlowStageBinding
from authentik.policies.expression.models import ExpressionPolicy
from authentik.policies.models import PolicyBinding
from authentik.providers.oauth2.models import OAuth2Provider, ScopeMapping
from authentik.sources.oauth.models import OAuthSource, OAuthSourcePropertyMapping
from authentik.stages.email.models import EmailStage
from authentik.stages.consent.models import ConsentStage
from authentik.stages.user_login.models import UserLoginStage
from django.db import transaction
import secrets

with transaction.atomic():
    google = OAuthSource.objects.get(slug='google', enabled=True)
    source_mapping, _ = OAuthSourcePropertyMapping.objects.update_or_create(
        name='EduTicTac Google verified email', defaults={'expression': '''
email = str(info.get("email", "")).lower().strip()
verified = info.get("email_verified", info.get("verified_email", False)) is True
# The authentication flow for an existing source account has no UserWriteStage.
# Persist this trusted Google claim here, including existing-link callbacks.
if verified and email:
    from authentik.core.models import User
    from authentik.sources.oauth.models import UserOAuthSourceConnection
    identifier = str(info.get("sub", info.get("id", "")))
    connection = UserOAuthSourceConnection.objects.filter(
        source__slug="google", identifier=identifier
    ).select_related("user").first() if identifier else None
    user = connection.user if connection else None
    if user is None:
        candidates = list(User.objects.filter(email__iexact=email, is_active=True)[:2])
        if len(candidates) == 1:
            user = candidates[0]
    if user and user.email.lower().strip() == email:
        user.attributes["edutictac_verified_email"] = email
        user.save(update_fields=["attributes"])
return {"attributes": {"edutictac_verified_email": email if verified else ""}}
'''})
    google.user_property_mappings.add(source_mapping)

    email_mapping, _ = ScopeMapping.objects.update_or_create(
        name='EduHoot verified email', defaults={'scope_name': 'email', 'expression': '''
email = request.user.email.lower().strip()
return {"email": email, "email_verified": bool(email) and request.user.attributes.get("edutictac_verified_email", "") == email}
'''})
    flow, _ = Flow.objects.get_or_create(slug='eduhoot-authorization', defaults={
        'name': 'Accés a EduHoot', 'title': 'Confirma el teu correu per a accedir a EduHoot',
        'designation': 'authorization', 'authentication': 'require_authenticated'})
    email_stage, _ = EmailStage.objects.get_or_create(name='EduHoot email verification', defaults={
        'use_global_settings': True, 'activate_user_on_success': False,
        'subject': 'Confirma el teu correu per a EduHoot', 'template': 'email/account_confirmation.html'})
    email_binding, _ = FlowStageBinding.objects.get_or_create(target=flow, stage=email_stage, defaults={
        'order': 0, 'evaluate_on_plan': False, 're_evaluate_policies': True})
    check, _ = ExpressionPolicy.objects.update_or_create(name='EduHoot needs email verification', defaults={'expression': '''
user = request.user
request.context["flow_plan"].context["pending_user"] = user
email = user.email.lower().strip()
return not (email and user.attributes.get("edutictac_verified_email", "") == email)
'''})
    PolicyBinding.objects.get_or_create(target=email_binding, policy=check, defaults={'order': 0})
    record_stage, _ = ConsentStage.objects.get_or_create(name='EduHoot record email verification')
    record_binding, _ = FlowStageBinding.objects.get_or_create(target=flow, stage=record_stage, defaults={
        'order': 1, 'evaluate_on_plan': False, 're_evaluate_policies': True})
    record, _ = ExpressionPolicy.objects.update_or_create(name='EduHoot record verified address', defaults={'expression': '''
user = request.context.get("pending_user", request.user)
token = request.context.get("is_restored")
if user and user.pk and user.email and token and token.user_id == user.pk:
    user.attributes["edutictac_verified_email"] = user.email.lower().strip()
    user.save(update_fields=["attributes"])
return False
'''})
    PolicyBinding.objects.get_or_create(target=record_binding, policy=record, defaults={'order': 0})
    login_stage, _ = UserLoginStage.objects.get_or_create(name='EduHoot verified email login', defaults={
        'session_duration': 'hours=8', 'remember_me_offset': 'seconds=0'})
    FlowStageBinding.objects.get_or_create(target=flow, stage=login_stage, defaults={
        'order': 2, 'evaluate_on_plan': False, 're_evaluate_policies': False})
    reference = OAuth2Provider.objects.get(application__slug='edutictac-prompt')
    provider, created = OAuth2Provider.objects.get_or_create(name='EduHoot', defaults={
        'client_id': 'eduhoot.edutictac.es', 'client_secret': secrets.token_urlsafe(48),
        'client_type': 'confidential', 'authorization_flow': flow,
        'invalidation_flow': reference.invalidation_flow,
        'signing_key': reference.signing_key, 'sub_mode': reference.sub_mode,
        'grant_types': ['authorization_code'],
        '_redirect_uris': [{'url': 'https://eduhoot.edutictac.es/api/auth/authentik/callback',
                            'matching_mode': 'strict', 'redirect_uri_type': 'authorization'}]})
    provider.property_mappings.set([
        ScopeMapping.objects.get(scope_name='openid'),
        ScopeMapping.objects.get(scope_name='profile'), email_mapping])
    Application.objects.get_or_create(slug='eduhoot', defaults={
        'name': 'EduHoot', 'provider': provider, 'meta_launch_url': 'https://eduhoot.edutictac.es/create/'})
print('EduHoot provider ready; secret retained in Authentik.')
