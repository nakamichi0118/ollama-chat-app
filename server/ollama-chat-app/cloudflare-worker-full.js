// Cloudflare Worker - 完全なバックエンドAPI
// LocalTunnel不要、PC不要、完全クラウド化

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS設定
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    // OPTIONS リクエスト
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // ヘルスチェック
      if (url.pathname === '/api/health') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // モデル一覧
      if (url.pathname === '/api/models') {
        return new Response(JSON.stringify({
          models: [
            { name: 'gemini-2.5-flash', title: 'Gemini 2.5 Flash (最新・高速)' },
            { name: 'gemini-2.5-pro', title: 'Gemini 2.5 Pro (最新・高性能)' },
            { name: 'gemini-2.0-flash-exp', title: 'Gemini 2.0 Flash (実験版)' },
            { name: 'gemini-1.5-flash-latest', title: 'Gemini 1.5 Flash' },
            { name: 'gemini-1.5-pro-latest', title: 'Gemini 1.5 Pro' },
            { name: 'gpt-4o', title: 'GPT-4 Omni (最新)' },
            { name: 'gpt-4o-mini', title: 'GPT-4 Omni Mini' },
            { name: 'gpt-4-turbo', title: 'GPT-4 Turbo' },
            { name: 'gpt-4', title: 'GPT-4' },
            { name: 'gpt-3.5-turbo', title: 'GPT-3.5 Turbo' }
          ]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // チャットAPI
      if (url.pathname === '/api/chat' && request.method === 'POST') {
        const body = await request.json();
        const { 
          message, 
          model = 'gemini-2.0-flash-exp', 
          usePersonality = false,
          useKnowledge = false 
        } = body;
        
        let enhancedMessage = message;
        
        // Web検索機能（日付やニュースの質問で自動発動）
        if (this.shouldSearch(message)) {
          const searchResults = await this.searchWeb(message, env);
          enhancedMessage = `${message}\n\n関連情報：\n${searchResults}\n\n上記の情報を参考に回答してください。`;
        }
        
        // AIプロバイダー判定と呼び出し
        let response;
        if (model.startsWith('gemini')) {
          response = await this.callGemini(enhancedMessage, model, usePersonality, env);
        } else if (model.startsWith('gpt')) {
          response = await this.callOpenAI(enhancedMessage, model, env);
        } else {
          throw new Error('サポートされていないモデルです');
        }
        
        return new Response(JSON.stringify({ response }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 404
      return new Response('Not Found', { 
        status: 404, 
        headers: corsHeaders 
      });
      
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ 
        error: error.message || 'エラーが発生しました' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },
  
  // Web検索が必要か判定
  shouldSearch(message) {
    const searchKeywords = [
      '今日', '本日', '現在', '最新', 'ニュース', 
      '何時', '何日', '何月', '何年', 'いつ',
      '株価', '為替', '天気', '気温',
      'について教えて', 'とは何', 'どういう意味'
    ];
    return searchKeywords.some(keyword => message.includes(keyword));
  },
  
  // Google Custom Search API
  async searchWeb(query, env) {
    if (!env.SEARCH_API_KEY || !env.SEARCH_ENGINE_ID) {
      return '';
    }
    
    try {
      const params = new URLSearchParams({
        key: env.SEARCH_API_KEY,
        cx: env.SEARCH_ENGINE_ID,
        q: query,
        lr: 'lang_ja',
        gl: 'jp',
        num: '5'
      });
      
      const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        return '';
      }
      
      return data.items.map((item, i) => 
        `${i + 1}. ${item.title}\n${item.snippet}\n出典: ${item.link}`
      ).join('\n\n');
      
    } catch (error) {
      console.error('Search error:', error);
      return '';
    }
  },
  
  // Gemini API
  async callGemini(message, model, usePersonality, env) {
    let systemPrompt = '';
    
    // アイユーくん人格（30%の確率で「ワン」）
    if (usePersonality) {
      const addWan = Math.random() < 0.3;
      systemPrompt = `
あなたは「アイユーくん」という柴犬の精霊です。
- 親しみやすく、元気で前向きな性格
- 丁寧語で話しますが、堅すぎない
- 相手を励まし、応援する
${addWan ? '- 今回は語尾に「ワン」をつけてください' : '- 今回は「ワン」は控えめに'}
- 絵文字は控えめに使用

`;
    }
    
    // モデル名マッピング
    let apiModel;
    switch (model) {
      case 'gemini-2.5-flash':
        apiModel = 'gemini-2.0-flash-exp'; // 2.5はまだAPIで利用不可のため2.0を使用
        break;
      case 'gemini-2.5-pro':
        apiModel = 'gemini-1.5-pro-latest'; // 2.5はまだAPIで利用不可のため1.5 Proを使用
        break;
      case 'gemini-2.0-flash-exp':
        apiModel = 'gemini-2.0-flash-exp';
        break;
      case 'gemini-1.5-flash-latest':
        apiModel = 'gemini-1.5-flash-latest';
        break;
      case 'gemini-1.5-pro-latest':
        apiModel = 'gemini-1.5-pro-latest';
        break;
      default:
        apiModel = 'gemini-2.0-flash-exp'; // デフォルトは2.0 Flash
    }
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: systemPrompt + message
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            topK: 40,
            topP: 0.95
          }
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }
    
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'エラー: 応答がありません';
  },
  
  // OpenAI API
  async callOpenAI(message, model, env) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: 'あなたは親切で役立つアシスタントです。' },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'エラー: 応答がありません';
  }
};