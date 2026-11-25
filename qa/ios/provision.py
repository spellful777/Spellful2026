"""Create private, short-lived fixtures only for an explicitly requested live iOS test."""
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import time

def call(url, body=None, token=None):
    args = ['curl', '--fail', '--silent', '--show-error', '--max-time', '30', '-H', 'Accept: application/json', url]
    if body is not None:
        args += ['-H', 'Content-Type: application/json', '--data-binary', '@-']
    if token:
        args += ['-H', 'Authorization: Bearer ' + token]
    if url.startswith('https://spellful.com/'):
        args += ['-H', 'Origin: https://spellful.com']
    raw = subprocess.check_output(args, input=json.dumps(body).encode())
    return json.loads(raw)

def items(value):
    return value if isinstance(value, list) else value.get('hydra:member', value.get('member', []))

def provision(domain, index):
    mail = 'https://api.mail.tm'
    auth = 'https://spellful.com/api/auth'
    email = 'spellful-ios-qa-' + secrets.token_hex(8) + '@' + domain
    mailbox = {'address': email, 'password': secrets.token_urlsafe(24)}
    account = {'email': email, 'password': secrets.token_urlsafe(24)}
    call(mail + '/accounts', mailbox)
    token = call(mail + '/token', mailbox)['token']
    call(auth + '/sign-up/email', {**account, 'name': 'Spellful iOS QA ' + str(index)})
    for _ in range(45):
        for msg in items(call(mail + '/messages', token=token)):
            body = call(mail + '/messages/' + msg['id'], token=token)
            code = re.search(r'(?<!\d)\d{6}(?!\d)', body.get('text', ''))
            if code:
                call(auth + '/email-otp/verify-email', {'email': email, 'otp': code[0]})
                return account
        time.sleep(5)
    raise RuntimeError('Email verification did not arrive for iOS QA account')

os.umask(0o077)
fixtures = Path(os.environ['SPELLFUL_QA_FIXTURES'])
accounts = []
domain = items(call('https://api.mail.tm/domains'))[0]['domain']
for index in range(2):
    accounts.append(provision(domain, index + 1))
    fixtures.write_text(json.dumps(accounts))
