const test = require('node:test');
const assert = require('node:assert/strict');

const AuthErrorMessages = require('../assets/js/auth-errors.js');

test('explains Supabase signup email rate limits', () => {
    assert.equal(
        AuthErrorMessages.signup({ code: 'over_email_send_rate_limit', status: 429 }),
        'Doğrulama e-postası gönderme sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin.'
    );
});

test('distinguishes database failures from invalid form data', () => {
    assert.equal(
        AuthErrorMessages.signup({ code: 'unexpected_failure', status: 500 }),
        'Hesap veritabanında oluşturulamadı. Sorun kaydedildi; lütfen daha sonra tekrar deneyin.'
    );
});

test('does not expose unknown Supabase error details', () => {
    assert.equal(
        AuthErrorMessages.signup({ code: 'unknown', message: 'sensitive internal detail' }),
        'Hesap oluşturulamadı. Bilgilerinizi kontrol edip tekrar deneyin.'
    );
});
