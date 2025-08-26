/**
 * リサーチ機能マネージャー
 * 日付、ニュース、最新情報の取得を担当
 */

class ResearchManager {
    constructor() {
        this.enableWebSearch = true; // WebSearchツールが利用可能
    }

    /**
     * ユーザーのメッセージがリサーチを必要とするかどうかを判定
     * @param {string} message - ユーザーのメッセージ
     * @returns {object} - リサーチ情報 {needsResearch: boolean, type: string, query: string}
     */
    analyzeMessage(message) {
        const lowercaseMessage = message.toLowerCase();
        
        // 日付関連の判定
        const datePatterns = [
            /今日の日付|今日は何日|今日は/,
            /現在の日付|今の日付/,
            /今日|きょう/,
            /今年|今月|今週/,
            /年|月|日|曜日/
        ];
        
        // ニュース関連の判定
        const newsPatterns = [
            /最新のニュース|最新ニュース|ニュース/,
            /今日のニュース|最近のニュース/,
            /何かニュースは|ニュースを教えて/,
            /最新の情報|最新情報/,
            /最近の出来事|最近起こったこと/
        ];
        
        // 一般的な検索が必要な判定
        const searchPatterns = [
            /最新の.*について|.*の最新情報/,
            /.*は今どうなって|.*の現状/,
            /.*の最近の.*|最近の.*/,
            /調べて|検索して|教えて.*最新/
        ];

        // 日付チェック
        if (datePatterns.some(pattern => pattern.test(lowercaseMessage))) {
            return {
                needsResearch: true,
                type: 'date',
                query: 'current date today',
                info: '日付情報を取得します'
            };
        }

        // ニュースチェック  
        if (newsPatterns.some(pattern => pattern.test(lowercaseMessage))) {
            return {
                needsResearch: true,
                type: 'news',
                query: '最新ニュース 日本 今日',
                info: '最新ニュースを検索します'
            };
        }

        // 一般検索チェック
        if (searchPatterns.some(pattern => pattern.test(lowercaseMessage))) {
            // キーワードを抽出
            const keywords = this.extractKeywords(message);
            if (keywords.length > 0) {
                return {
                    needsResearch: true,
                    type: 'search',
                    query: keywords.join(' ') + ' 最新情報 2025',
                    info: `${keywords.join(', ')}について最新情報を検索します`
                };
            }
        }

        return {
            needsResearch: false,
            type: null,
            query: null,
            info: null
        };
    }

    /**
     * メッセージからキーワードを抽出
     * @param {string} message - メッセージ
     * @returns {Array} - キーワード配列
     */
    extractKeywords(message) {
        // 基本的なキーワード抽出（改良の余地あり）
        const stopWords = ['について', 'の', 'は', 'が', 'を', 'に', 'で', 'と', 'から', 'まで', 'より', 'けど', 'だけど', 'でも', 'しかし', '最新', '情報', '教えて', '調べて', '検索'];
        const words = message.split(/\s+|、|。/).filter(word => 
            word.length > 1 && !stopWords.includes(word)
        );
        return words.slice(0, 3); // 最大3つのキーワード
    }

    /**
     * 現在の日付情報を取得
     * @returns {string} - 日付情報
     */
    getCurrentDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const date = now.getDate();
        const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
        const dayName = dayNames[now.getDay()];
        
        return `今日は${year}年${month}月${date}日（${dayName}）です。`;
    }

    /**
     * リサーチ情報を元の質問と組み合わせる
     * @param {string} originalMessage - 元の質問
     * @param {string} researchData - リサーチで取得したデータ
     * @param {string} type - リサーチタイプ
     * @returns {string} - 強化されたプロンプト
     */
    enhanceMessage(originalMessage, researchData, type) {
        switch (type) {
            case 'date':
                return `${originalMessage}\n\n【現在の日付情報】\n${this.getCurrentDate()}\n\n上記の日付情報を参考にして回答してください。`;
                
            case 'news':
                return `${originalMessage}\n\n【最新ニュース情報】\n${researchData}\n\n上記の最新ニュース情報を参考にして、分かりやすく要約して回答してください。`;
                
            case 'search':
                return `${originalMessage}\n\n【最新情報】\n${researchData}\n\n上記の最新情報を参考にして回答してください。`;
                
            default:
                return originalMessage;
        }
    }

    /**
     * WebSearchを使用してリサーチを実行
     * @param {string} query - 検索クエリ
     * @param {string} type - リサーチタイプ
     * @returns {Promise<string>} - リサーチ結果
     */
    async performWebSearch(query, type) {
        // ここでWebSearchツールを使用
        // 実際の実装では外部のWebSearch APIを呼び出す
        try {
            console.log(`🔍 WebSearch実行: ${query}`);
            
            // 日付の場合は直接返す
            if (type === 'date') {
                return this.getCurrentDate();
            }

            // 模擬的なレスポンス（実際にはWebSearch APIを呼び出す）
            const mockResponse = this.getMockResponse(query, type);
            return mockResponse;
            
        } catch (error) {
            console.error('WebSearch error:', error);
            return '最新情報の取得に失敗しました。一般的な情報で回答いたします。';
        }
    }

    /**
     * 模擬レスポンス（開発用）
     * @param {string} query - クエリ
     * @param {string} type - タイプ
     * @returns {string} - 模擬レスポンス
     */
    getMockResponse(query, type) {
        switch (type) {
            case 'news':
                return `【最新ニュース（${this.getCurrentDate()}）】
                
1. 経済: 日経平均株価は前日比で上昇
2. 技術: AI技術の新展開に関する発表
3. 政治: 国会での最新の議論状況
4. 社会: 地域活性化に関する取り組み

※これは模擬データです。実際のWebSearch APIが接続されると、リアルタイムの情報を取得できます。`;

            default:
                return `【${query}に関する情報】
                
最新の動向や情報については、WebSearch機能が正式に接続された際に、リアルタイムで取得できます。
現在は模擬的な応答となっています。

※実際のWebSearch APIの実装により、最新の正確な情報を提供できるようになります。`;
        }
    }
}

module.exports = ResearchManager;