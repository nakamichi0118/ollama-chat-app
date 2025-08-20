require('dotenv').config();
const express = require('express');
const cors = require('cors');
const corsOptions = require('./cors-config');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const EnhancedKnowledgeLoader = require('./knowledge-loader-enhanced');
const AiyuPersonality = require('./aiyu-personality');
const pdf = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 3001;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://ollama:11434';

// ナレッジローダー初期化（起動時はドキュメントを読み込まない）
let knowledgeLoader = null;

// アイユーくん人格設定初期化
const aiyuPersonality = new AiyuPersonality();

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

let genAI = null;
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        providers: {
            ollama: true,
            gemini: !!process.env.GEMINI_API_KEY,
            openai: !!process.env.OPENAI_API_KEY
        }
    });
});

app.get('/api/models', async (req, res) => {
    const models = [];
    
    if (process.env.GEMINI_API_KEY) {
        // models.push({ name: 'gemini-2.0-flash', provider: 'gemini', description: 'Google Gemini 2.0 Flash (最新・高速)' }); // まだ利用不可
        models.push({ name: 'gemini-1.5-pro', provider: 'gemini', description: 'Google Gemini 1.5 Pro' });
        models.push({ name: 'gemini-1.5-flash', provider: 'gemini', description: 'Google Gemini 1.5 Flash' });
    }
    
    if (process.env.OPENAI_API_KEY) {
        models.push({ name: 'gpt-3.5-turbo', provider: 'openai', description: 'GPT-3.5 Turbo' });
        models.push({ name: 'gpt-4', provider: 'openai', description: 'GPT-4' });
        models.push({ name: 'gpt-4-turbo', provider: 'openai', description: 'GPT-4 Turbo (高速版)' });
        models.push({ name: 'gpt-4o', provider: 'openai', description: 'GPT-4o (最新・高速)' });
        models.push({ name: 'gpt-4o-mini', provider: 'openai', description: 'GPT-4o Mini (軽量版)' });
    }
    
    try {
        const response = await axios.get(`${OLLAMA_HOST}/api/tags`);
        if (response.data && response.data.models) {
            response.data.models.forEach(model => {
                models.push({ 
                    name: model.name, 
                    provider: 'ollama', 
                    description: `Ollama ${model.name} (ローカル)` 
                });
            });
        }
    } catch (error) {
        console.log('Ollama not available');
    }
    
    res.json({ models });
});

// ナレッジAPI（管理画面用）
app.get('/api/knowledge', async (req, res) => {
    // ナレッジローダーがnullの場合は空を返す
    if (!knowledgeLoader) {
        return res.json({
            documents: [],
            statistics: { totalDocuments: 0, totalSize: 0 }
        });
    }
    // 必要な時のみドキュメントを読み込む
    if (knowledgeLoader.documents.length === 0) {
        await knowledgeLoader.loadDocuments();
    }
    const stats = knowledgeLoader.getStatistics();
    res.json({
        documents: knowledgeLoader.documents.map(doc => ({
            id: doc.id,
            title: doc.title,
            type: doc.type,
            size: doc.size,
            preview: doc.content.substring(0, 100) + '...'
        })),
        statistics: stats
    });
});

// ナレッジアップロードAPI
app.post('/api/knowledge/upload', async (req, res) => {
    const { filename, content } = req.body;
    
    if (!filename || !content) {
        return res.status(400).json({ error: 'ファイル名と内容が必要です' });
    }
    
    try {
        const fs = require('fs').promises;
        const path = require('path');
        const filePath = path.join('./knowledge', filename);
        
        await fs.writeFile(filePath, content, 'utf-8');
        await knowledgeLoader.loadDocuments();
        
        res.json({ 
            success: true, 
            message: `${filename}を追加しました`,
            totalDocuments: knowledgeLoader.documents.length 
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'アップロードに失敗しました' });
    }
});

app.post('/api/chat', async (req, res) => {
    const { message, model = 'gemini-pro', history = [], userProfile, useKnowledge = false, files = [] } = req.body;
    
    console.log('======================================');
    console.log('Chat request received:');
    console.log('  useKnowledge:', useKnowledge, typeof useKnowledge);
    console.log('  model:', model);
    console.log('  message preview:', message.substring(0, 50));
    console.log('  files count:', files.length);
    
    // ファイルの詳細情報をログ出力
    if (files && files.length > 0) {
        console.log('  📎 File details:');
        files.forEach((file, index) => {
            console.log(`    File ${index + 1}:`);
            console.log(`      Name: ${file.name}`);
            console.log(`      Type: ${file.type}`);
            console.log(`      Size: ${file.size}`);
            console.log(`      Has data: ${file.data ? 'Yes' : 'No'}`);
            if (file.data) {
                console.log(`      Data preview: ${file.data.substring(0, 50)}...`);
            }
        });
    } else {
        console.log('  ⚠️ No files attached or files array is empty');
    }
    
    console.log('======================================');
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
        let enhancedMessage = message;
        
        // 添付ファイルがある場合、メッセージに追加
        if (files && files.length > 0) {
            console.log('Processing attached files...');
            let fileContext = '\n\n以下のファイルが添付されています：\n';
            for (const file of files) {
                console.log(`Processing file: ${file.name}`);
                if (file.type && (file.type.startsWith('text/') || file.type === 'application/json' || file.name.endsWith('.md') || file.name.endsWith('.txt'))) {
                    // テキストファイルの内容を追加
                    fileContext += `\n=== ファイル名: ${file.name} ===\n`;
                    fileContext += `ファイルタイプ: ${file.type || 'unknown'}\n`;
                    fileContext += `内容:\n${file.data}\n`;
                    fileContext += `=== ファイル終了 ===\n`;
                } else if (file.type && file.type.startsWith('image/')) {
                    // 画像ファイルの場合（Geminiなら処理可能）
                    fileContext += `\n[画像ファイル: ${file.name}]\n`;
                } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                    // PDFファイルの場合 - Base64データからテキストを抽出
                    console.log(`Processing PDF file: ${file.name}`);
                    fileContext += `\n=== PDFファイル: ${file.name} ===\n`;
                    
                    try {
                        let pdfContent = '';
                        
                        if (file.data && file.data.startsWith('data:')) {
                            // Base64データの場合
                            const base64Data = file.data.split(',')[1];
                            
                            if (!base64Data) {
                                throw new Error('Invalid PDF data format');
                            }
                            
                            console.log(`PDF Base64 data length: ${base64Data.length}`);
                            const pdfBuffer = Buffer.from(base64Data, 'base64');
                            console.log(`PDF Buffer size: ${pdfBuffer.length} bytes`);
                            
                            // pdf-parseでテキスト抽出
                            try {
                                const pdfData = await pdf(pdfBuffer);
                                pdfContent = pdfData.text || '';
                                console.log(`PDF text extracted successfully: ${pdfContent.length} characters`);
                                
                                if (pdfContent.length > 0) {
                                    // 特殊文字をエスケープして安全にする
                                    pdfContent = pdfContent
                                        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // 制御文字を除去
                                        .replace(/\s+/g, ' ') // 連続する空白を1つに
                                        .trim();
                                    
                                    fileContext += `内容 (${pdfContent.length}文字):\n${pdfContent.substring(0, 5000)}\n`;
                                    if (pdfContent.length > 5000) {
                                        fileContext += `\n... (残り ${pdfContent.length - 5000} 文字省略) ...\n`;
                                    }
                                } else {
                                    fileContext += `(PDFにテキストが含まれていません - 画像ベースのPDFの可能性があります)\n`;
                                    fileContext += `\n【ヒント】\n`;
                                    fileContext += `• このPDFは画像やスキャンデータのみで構成されている可能性があります\n`;
                                    fileContext += `• テキスト選択可能なPDFに変換してから再度お試しください\n`;
                                    fileContext += `• または、PDFの内容を画像として送信していただければ、Geminiモデルで読み取れる場合があります\n`;
                                }
                            } catch (parseError) {
                                console.error('PDF parse error:', parseError);
                                throw new Error(`PDF解析エラー: ${parseError.message}`);
                            }
                        } else {
                            fileContext += `(PDFデータ形式が不正です)\n`;
                        }
                        
                    } catch (pdfError) {
                        console.error(`PDF processing error for ${file.name}:`, pdfError);
                        console.error('Error stack:', pdfError.stack);
                        fileContext += `(PDFの読み込みに失敗しました: ${pdfError.message})\n`;
                        fileContext += `ヒント: PDFが画像ベースの場合、テキスト抽出ができない場合があります。\n`;
                    }
                    
                    fileContext += `=== ファイル終了 ===\n`;
                } else {
                    fileContext += `\n[ファイル: ${file.name} (タイプ: ${file.type || 'unknown'})]\n`;
                }
            }
            enhancedMessage += fileContext;
        }
        
        // useKnowledgeフラグがtrueの場合のみナレッジを検索
        if (useKnowledge === true) {
            console.log('Knowledge enabled - loading documents...');
            // ナレッジローダーを初期化
            if (!knowledgeLoader) {
                knowledgeLoader = new EnhancedKnowledgeLoader('./knowledge');
                knowledgeLoader.initialize();
            }
            // ナレッジドキュメントがまだ読み込まれていない場合は読み込む
            if (knowledgeLoader.documents.length === 0) {
                await knowledgeLoader.loadDocuments();
            }
            
            const relevantDocs = knowledgeLoader.searchDocuments(message);
            const knowledgeContext = knowledgeLoader.generateContext(relevantDocs);
            
            if (knowledgeContext) {
                enhancedMessage += knowledgeContext;
            }
        } else {
            console.log('Knowledge disabled - using plain message');
        }
        
        // ユーザープロファイル情報を追加（contextが空でない場合のみ）
        if (userProfile && userProfile.context && userProfile.context.trim() !== '') {
            console.log('Adding user profile context');
            enhancedMessage = `ユーザー情報: ${userProfile.name || '不明'}, ${userProfile.department || '不明'}, ${userProfile.context}\n\n${enhancedMessage}`;
        }
        
        const provider = getProviderFromModel(model);
        
        switch (provider) {
            case 'gemini':
                await handleGeminiChat(enhancedMessage, model, history, res, files);
                break;
            case 'openai':
                await handleOpenAIChat(enhancedMessage, model, history, res, files);
                break;
            case 'ollama':
                await handleOllamaChat(enhancedMessage, model, history, res, files);
                break;
            default:
                throw new Error('Unknown provider');
        }
    } catch (error) {
        console.error('Error in chat:', error.message);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
});

function getProviderFromModel(model) {
    if (model.startsWith('gemini') || model.includes('gemini')) return 'gemini';
    if (model.startsWith('gpt')) return 'openai';
    return 'ollama';
}

async function handleGeminiChat(message, model, history, res, files = []) {
    if (!genAI) {
        throw new Error('Gemini API key not configured');
    }
    
    try {
        // Geminiモデル名のマッピング（2.0/1.5シリーズサポート）
        const modelMap = {
            'gemini-2.0-flash': 'gemini-2.0-flash-exp',
            'gemini-1.5-pro': 'gemini-1.5-pro',
            'gemini-1.5-flash': 'gemini-1.5-flash',
            'gemini-flash': 'gemini-2.0-flash-exp'  // 最新に変更
        };
        
        let modelName = modelMap[model] || 'gemini-1.5-flash';
        console.log(`Using Gemini model: ${modelName}`);
        console.log(`Files to process: ${files ? files.length : 0}`);
        
        const geminiModel = genAI.getGenerativeModel({ model: modelName });
        
        // 会話履歴をプロンプトに含める
        let fullPrompt = '';
        
        // アイユーくんの人格設定を適用
        fullPrompt += aiyuPersonality.enhancePrompt(message);
        
        // 最近の会話履歴を追加（最新の5つ）
        const recentHistory = history.slice(-10);
        if (recentHistory.length > 0) {
            fullPrompt += '以下は最近の会話履歴です：\n';
            recentHistory.forEach(msg => {
                if (msg.role === 'user') {
                    fullPrompt += `ユーザー: ${msg.content}\n`;
                } else if (msg.role === 'assistant') {
                    fullPrompt += `アシスタント: ${msg.content}\n`;
                }
            });
            fullPrompt += '\n';
        }
        
        // 現在のメッセージ（ファイル内容が既に含まれている）
        fullPrompt += `ユーザー: ${message}\nアシスタント: `;
        
        // マルチモーダル入力の準備
        let parts = [];
        let hasImages = false;
        
        // 画像ファイルがある場合の処理
        if (files && files.length > 0) {
            console.log('Processing files for Gemini...');
            for (const file of files) {
                if (file.type && file.type.startsWith('image/') && file.data) {
                    // Base64画像データを処理
                    const base64Data = file.data.split(',')[1] || file.data;
                    parts.push({
                        inlineData: {
                            mimeType: file.type,
                            data: base64Data
                        }
                    });
                    console.log(`Added image to parts: ${file.name}`);
                    hasImages = true;
                }
            }
        }
        
        // テキストプロンプトを追加（画像がある場合は最後に、ない場合は単独で）
        parts.push({ text: fullPrompt });
        
        console.log(`Sending to Gemini API with ${parts.length} parts...`);
        const startTime = Date.now();
        
        try {
            // partsを使用してコンテンツを生成
            const result = await geminiModel.generateContent(parts);
            const response = await result.response;
            const text = response.text();
            
            console.log(`Got response in ${Date.now() - startTime}ms`);
            console.log(`Response preview: ${text.substring(0, 100)}...`);
            
            // アイユーくんの人格を適用（「ワン」の追加判定）
            const enhancedText = aiyuPersonality.processResponse(message, text);
            console.log(`Personality applied: ${enhancedText.substring(0, 100)}...`);
            
            // レスポンスを送信
            res.write(`data: ${JSON.stringify({ content: enhancedText })}\n\n`);
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
        } catch (apiError) {
            console.error('Gemini API error:', apiError);
            console.error('Error details:', apiError.message);
            throw apiError;
        }
    } catch (error) {
        console.error('Gemini chat error:', error);
        // エラーメッセージをクライアントに送信
        res.write(`data: ${JSON.stringify({ error: 'Gemini APIエラー: ' + error.message })}\n\n`);
        res.end();
    }
}

async function handleOpenAIChat(message, model, history, res, files = []) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }
    
    const messages = [
        { role: 'system', content: aiyuPersonality.enhancePrompt(message) },
        ...history.map(msg => ({ role: msg.role, content: msg.content })),
        { role: 'user', content: message }
    ];
    
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: model,
        messages: messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2048
    }, {
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        responseType: 'stream'
    });
    
    response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                    res.end();
                } else {
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices[0]?.delta?.content || '';
                        if (content) {
                            res.write(`data: ${JSON.stringify({ content })}\n\n`);
                        }
                    } catch (e) {
                        console.error('Error parsing OpenAI response:', e);
                    }
                }
            }
        }
    });
}

async function handleOllamaChat(message, model, history, res, files = []) {
    const prompt = formatPrompt(message, history);
    
    const response = await axios.post(`${OLLAMA_HOST}/api/generate`, {
        model: model,
        prompt: prompt,
        stream: true,
        options: {
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 2048
        }
    }, {
        responseType: 'stream'
    });
    
    response.data.on('data', (chunk) => {
        try {
            const lines = chunk.toString().split('\n').filter(line => line.trim());
            for (const line of lines) {
                const data = JSON.parse(line);
                if (data.response) {
                    res.write(`data: ${JSON.stringify({ content: data.response })}\n\n`);
                }
                if (data.done) {
                    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                    res.end();
                }
            }
        } catch (error) {
            console.error('Error parsing Ollama response:', error);
        }
    });
}

function formatPrompt(message, history) {
    // アイユーくんの人格設定を適用
    let prompt = aiyuPersonality.enhancePrompt(message) + '\n\n';
    
    const recentHistory = history.slice(-6);
    
    for (const msg of recentHistory) {
        if (msg.role === 'user') {
            prompt += `User: ${msg.content}\n`;
        } else if (msg.role === 'assistant') {
            prompt += `Assistant: ${msg.content}\n`;
        }
    }
    
    prompt += `User: ${message}\nAssistant: `;
    return prompt;
}

// 議事録文字起こしAPI
app.post('/api/meeting/transcribe', async (req, res) => {
    const { audio, meetingInfo, speakers, transcripts: clientTranscripts } = req.body;
    
    try {
        // クライアントから送られた文字起こしデータを使用
        let transcripts = clientTranscripts || [];
        
        // 音声ファイルがある場合の処理（将来的にWhisper APIを使用）
        if (audio && !clientTranscripts) {
            // TODO: Whisper APIやGoogle Speech-to-Textを使用
            console.log('音声ファイルの処理は未実装');
            transcripts = [
                { speaker: '話者1', text: '音声認識機能は開発中です', timestamp: new Date().toISOString() }
            ];
        }
        
        // 議事録の自動生成
        const minutes = {
            title: meetingInfo.title || '会議議事録',
            dateTime: meetingInfo.dateTime || new Date().toISOString(),
            participants: meetingInfo.participants || [],
            agenda: ['議題1', '議題2'],
            discussion: '本日の議論内容をここに記載',
            decisions: ['決定事項1', '決定事項2'],
            actionItems: [
                { task: 'タスク1', assignee: '担当者1', deadline: '2025-01-15' },
                { task: 'タスク2', assignee: '担当者2', deadline: '2025-01-20' }
            ],
            nextMeeting: '次回: 2025-01-15 14:00'
        };
        
        res.json({
            success: true,
            transcripts: transcripts,
            minutes: minutes
        });
        
    } catch (error) {
        console.error('Transcription error:', error);
        res.status(500).json({
            success: false,
            error: '文字起こしに失敗しました'
        });
    }
});

// 議事録生成API
app.post('/api/meeting/generate', async (req, res) => {
    const { meetingInfo, transcripts } = req.body;
    
    try {
        // AIを使った議事録生成
        let prompt = `以下の会議の文字起こしから議事録を作成してください。\n\n`;
        prompt += `会議名: ${meetingInfo.title}\n`;
        prompt += `日時: ${meetingInfo.dateTime}\n`;
        prompt += `参加者: ${meetingInfo.participants.join(', ')}\n\n`;
        prompt += `文字起こし:\n`;
        
        transcripts.forEach(t => {
            prompt += `${t.speaker}: ${t.text}\n`;
        });
        
        // Gemini APIで議事録生成（利用可能な場合）
        let generatedMinutes = null;
        
        if (genAI && process.env.GEMINI_API_KEY) {
            try {
                const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
                const result = await model.generateContent(prompt + '\n\n議事録形式で要約してください。');
                const response = await result.response;
                const text = response.text();
                
                // レスポンスを構造化
                generatedMinutes = parseMinutesFromAI(text, meetingInfo);
            } catch (error) {
                console.error('Gemini API error:', error);
            }
        }
        
        // フォールバック：簡易的な議事録生成
        if (!generatedMinutes) {
            generatedMinutes = {
                title: meetingInfo.title || '会議議事録',
                dateTime: meetingInfo.dateTime || new Date().toISOString(),
                participants: meetingInfo.participants || [],
                agenda: extractAgenda(transcripts),
                discussion: summarizeDiscussion(transcripts),
                decisions: extractDecisions(transcripts),
                actionItems: extractActionItems(transcripts),
                nextMeeting: '次回日程は別途調整'
            };
        }
        
        res.json({
            success: true,
            minutes: generatedMinutes
        });
        
    } catch (error) {
        console.error('Minutes generation error:', error);
        res.status(500).json({
            success: false,
            error: '議事録の生成に失敗しました'
        });
    }
});

// ヘルパー関数：AIレスポンスから議事録を構造化
function parseMinutesFromAI(text, meetingInfo) {
    // AIの出力をパースして構造化（簡易実装）
    return {
        title: meetingInfo.title,
        dateTime: meetingInfo.dateTime,
        participants: meetingInfo.participants,
        agenda: text.match(/議題[：:]\s*(.+)/g)?.map(a => a.replace(/議題[：:]/, '').trim()) || ['議題1'],
        discussion: text.match(/議論[：:]\s*([\s\S]+?)(?=決定|$)/)?.[1]?.trim() || text.substring(0, 200),
        decisions: text.match(/決定[：:]\s*(.+)/g)?.map(d => d.replace(/決定[：:]/, '').trim()) || ['決定事項1'],
        actionItems: [
            { task: 'フォローアップ必要', assignee: '担当者', deadline: '未定' }
        ],
        nextMeeting: text.match(/次回[：:]\s*(.+)/)?.[1] || '別途調整'
    };
}

// ヘルパー関数：議題抽出
function extractAgenda(transcripts) {
    const agenda = [];
    transcripts.forEach(t => {
        if (t.text.includes('議題') || t.text.includes('について')) {
            agenda.push(t.text.substring(0, 50));
        }
    });
    return agenda.length > 0 ? agenda : ['本日の議題'];
}

// ヘルパー関数：議論要約
function summarizeDiscussion(transcripts) {
    const summary = transcripts.slice(0, 5).map(t => `${t.speaker}: ${t.text}`).join('\n');
    return summary || '議論内容の要約';
}

// ヘルパー関数：決定事項抽出
function extractDecisions(transcripts) {
    const decisions = [];
    transcripts.forEach(t => {
        if (t.text.includes('決定') || t.text.includes('承認') || t.text.includes('合意')) {
            decisions.push(t.text);
        }
    });
    return decisions.length > 0 ? decisions : ['決定事項を確認中'];
}

// ヘルパー関数：アクションアイテム抽出
function extractActionItems(transcripts) {
    const actions = [];
    transcripts.forEach(t => {
        if (t.text.includes('お願い') || t.text.includes('タスク') || t.text.includes('TODO')) {
            actions.push({
                task: t.text.substring(0, 50),
                assignee: t.speaker,
                deadline: '未定'
            });
        }
    });
    return actions.length > 0 ? actions : [{ task: 'アクションアイテムなし', assignee: '-', deadline: '-' }];
}

// ========================================
// 管理者API エンドポイント
// ========================================

// BOX接続テスト
app.post('/api/admin/box/connect', async (req, res) => {
    const { clientId, clientSecret, folderId } = req.body;
    
    console.log('BOX connection test requested');
    
    // 実際のBOX API実装では、ここでBOX SDKを使って認証
    // 現在はモック実装
    if (!clientId || !clientSecret) {
        return res.status(400).json({
            success: false,
            error: 'クライアントIDとシークレットが必要です'
        });
    }
    
    // モック応答（実際の実装では BOX API を呼び出し）
    // ダミーの成功応答を即座に返す
    res.json({
        success: true,
        message: 'BOXに正常に接続しました',
        folder: {
            id: folderId || 'root',
            name: '社内共有フォルダ',
            itemCount: 12
        }
    });
});

// BOXファイル一覧取得
app.get('/api/admin/box/files/:folderId', async (req, res) => {
    const { folderId } = req.params;
    
    // モックデータ
    res.json({
        success: true,
        files: [
            { id: '1', name: '社内規定_2024.pdf', size: 2400000, modified: '2024-01-15' },
            { id: '2', name: '製品マニュアル_v3.pdf', size: 5300000, modified: '2024-01-10' },
            { id: '3', name: 'FAQ集.md', size: 160000, modified: '2024-01-20' },
            { id: '4', name: '営業資料.pptx', size: 8900000, modified: '2024-01-25' }
        ]
    });
});

// BOXファイル同期
app.post('/api/admin/box/sync', async (req, res) => {
    const { fileIds } = req.body;
    
    // モック実装
    res.json({
        success: true,
        message: `${fileIds.length}個のファイルを同期しました`,
        syncedFiles: fileIds
    });
});

// システム設定保存
app.post('/api/admin/settings', async (req, res) => {
    const { geminiApiKey, openaiApiKey, defaultModel, boxSettings } = req.body;
    
    // 実際の実装では、.envファイルを更新するか、データベースに保存
    console.log('Saving system settings...');
    
    // 環境変数を動的に更新（次回起動時に反映）
    if (geminiApiKey) {
        process.env.GEMINI_API_KEY = geminiApiKey;
    }
    if (openaiApiKey) {
        process.env.OPENAI_API_KEY = openaiApiKey;
    }
    
    res.json({
        success: true,
        message: '設定を保存しました'
    });
});

// システム統計取得
app.get('/api/admin/stats', async (req, res) => {
    // モック統計データ
    res.json({
        totalChats: Math.floor(Math.random() * 1000) + 100,
        activeUsers: Math.floor(Math.random() * 50) + 10,
        apiCalls: Math.floor(Math.random() * 5000) + 1000,
        modelUsage: {
            'gemini-1.5-flash': 45,
            'gemini-1.5-pro': 25,
            'gpt-3.5-turbo': 20,
            'gpt-4': 10
        },
        recentActivity: [
            { time: '10:30', user: 'User001', action: 'チャット開始' },
            { time: '10:25', user: 'User002', action: 'PDF添付' },
            { time: '10:20', user: 'User003', action: 'ナレッジ検索' }
        ]
    });
});

// ナレッジファイル削除
app.delete('/api/admin/knowledge/:fileId', async (req, res) => {
    const { fileId } = req.params;
    
    // 実際の実装では、ファイルシステムから削除
    console.log(`Deleting knowledge file: ${fileId}`);
    
    res.json({
        success: true,
        message: 'ファイルを削除しました'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('\n========================================');
    console.log(`✅ Backend server running on port ${PORT}`);
    console.log('========================================');
    console.log('Available providers:');
    if (process.env.GEMINI_API_KEY) {
        console.log('  ✓ Gemini API (API Key: ***' + process.env.GEMINI_API_KEY.slice(-4) + ')');
    } else {
        console.log('  ✗ Gemini API (No API Key)');
    }
    if (process.env.OPENAI_API_KEY) {
        console.log('  ✓ OpenAI API (API Key: ***' + process.env.OPENAI_API_KEY.slice(-4) + ')');
    } else {
        console.log('  ✗ OpenAI API (No API Key)');
    }
    console.log('  ✓ Ollama (local)');
    console.log('========================================\n');
});