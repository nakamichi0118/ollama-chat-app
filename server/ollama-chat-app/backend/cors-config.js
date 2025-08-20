// CORS configuration for multi-provider server

const corsOptions = {
    origin: function (origin, callback) {
        // 許可するオリジンのリスト
        const allowedOrigins = [
            'http://localhost:8080',
            'http://localhost:3000',
            'http://192.168.6.26:8080',
            'https://ai-chat-frontend-9g0.pages.dev',
            // Cloudflare Pagesのプレビュー環境も許可
            /^https:\/\/[a-zA-Z0-9-]+\.ai-chat-frontend-[a-zA-Z0-9]+\.pages\.dev$/
        ];
        
        // origin が undefined の場合（同一オリジンリクエスト）は許可
        if (!origin) {
            return callback(null, true);
        }
        
        // 許可リストに含まれているか、パターンにマッチするかチェック
        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed instanceof RegExp) {
                return allowed.test(origin);
            }
            return allowed === origin;
        });
        
        if (isAllowed) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(null, true); // 開発中は全て許可（本番では false にする）
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Length', 'X-Request-Id']
};

module.exports = corsOptions;