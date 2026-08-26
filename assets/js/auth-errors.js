(function initializeAuthErrorMessages(global) {
    'use strict';

    const codeOf = error => String(error?.code || '').trim().toLowerCase();
    const statusOf = error => Number(error?.status) || 0;

    const signup = error => {
        const code = codeOf(error);
        const status = statusOf(error);

        if (code === 'over_email_send_rate_limit' || status === 429) {
            return 'Doğrulama e-postası gönderme sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin.';
        }
        if (code === 'email_address_invalid') {
            return 'Bu e-posta adresi kabul edilmedi. Lütfen farklı ve geçerli bir e-posta adresi kullanın.';
        }
        if (code === 'weak_password') {
            return 'Bu şifre yeterince güçlü değil. Lütfen daha güçlü bir şifre seçin.';
        }
        if (code === 'user_already_exists' || code === 'email_exists') {
            return 'Bu e-posta adresiyle zaten bir hesap bulunuyor. Giriş yapmayı deneyin.';
        }
        if (code === 'unexpected_failure' || status >= 500) {
            return 'Hesap veritabanında oluşturulamadı. Sorun kaydedildi; lütfen daha sonra tekrar deneyin.';
        }
        return 'Hesap oluşturulamadı. Bilgilerinizi kontrol edip tekrar deneyin.';
    };

    const api = Object.freeze({ signup });
    global.AuthErrorMessages = api;
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
}(typeof window === 'object' ? window : globalThis));
